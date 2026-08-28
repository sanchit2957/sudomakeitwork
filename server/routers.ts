import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./auth.password";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  deleteEmergencyContact,
  ensureHospitalStaffProfile,
  ensureRescuerProfile,
  getAllUsers,
  getEmergencyContactsByUserId,
  getUserByEmail,
  getUserByOpenId,
  upsertEmergencyContact,
  upsertUser,
} from "./db";
import { rescueRouter } from "./routers/rescue";
import { ENV } from "./_core/env";
import { aiRouter } from "./routers/ai";

function resolveVerifiedRole(email: string, existingRole?: string): "user" | "rescuer" | "hospital" | "admin" {
  // Only grant admin if ADMIN_EMAIL environment variable is explicitly configured on the server
  if (ENV.adminEmail && ENV.adminEmail.trim() !== "" && email.toLowerCase().trim() === ENV.adminEmail.toLowerCase().trim()) {
    return "admin";
  }
  // Canonicalize legacy 'medical' role to 'hospital'
  if (existingRole === "medical" || existingRole === "hospital") {
    return "hospital";
  }
  if (existingRole === "rescuer" || existingRole === "admin") {
    return existingRole;
  }
  return "user";
}

function sanitizeUser<T extends Record<string, any>>(user: T | null): Omit<T, "password"> | null {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export const appRouter = router({
  system: systemRouter,
  ai: aiRouter,
  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().optional(),
          password: z.string().optional(),
          supabaseToken: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // If Supabase token is provided, verify against Supabase server-side
        if (input.supabaseToken) {
          const { verifySupabaseToken } = await import("./_core/supabase");
          const sbUser = await verifySupabaseToken(input.supabaseToken);
          if (sbUser && sbUser.email) {
            const emailVal = sbUser.email.trim().toLowerCase();
            let dbUser = (await getUserByOpenId(sbUser.id)) || (await getUserByEmail(emailVal));
            const roleVal = resolveVerifiedRole(emailVal, dbUser?.role);
            if (!dbUser) {
              const nameVal = sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || emailVal.split("@")[0];
              await upsertUser({
                openId: sbUser.id,
                name: nameVal,
                email: emailVal,
                role: roleVal,
                loginMethod: "supabase-auth",
                lastSignedIn: new Date(),
              });
              dbUser = await getUserByEmail(emailVal);
            } else {
              await upsertUser({ ...dbUser, openId: sbUser.id, role: roleVal, lastSignedIn: new Date() });
              dbUser = await getUserByEmail(emailVal);
            }

            if (dbUser) {
              if (roleVal === "rescuer") {
                await ensureRescuerProfile(dbUser.id, sbUser.user_metadata?.callSign || "Field Unit");
              } else if (roleVal === "hospital") {
                await ensureHospitalStaffProfile(dbUser.id);
              }

              const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || "User" });
              const cookieOptions = getSessionCookieOptions(ctx.req);
              ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
              return {
                success: true,
                user: sanitizeUser(dbUser),
                sessionToken,
              };
            }
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP verification token." });
        }

        if (!input.email || !input.password) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email and password are required." });
        }
        
        const emailInput = input.email.trim().toLowerCase();
        const user = await getUserByEmail(emailInput);
        if (!user || !user.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        const isValid = verifyPassword(input.password.trim(), user.password);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        // Canonicalize legacy medical role
        if (user.role === "medical") {
          user.role = "hospital" as any;
          await upsertUser({ ...user, role: "hospital" as any });
        }

        await upsertUser({ ...user, lastSignedIn: new Date() });

        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "User" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          success: true,
          user: sanitizeUser(user),
          sessionToken,
        };
      }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Invalid email address"),
          password: z.string().min(1, "Password is required"),
          role: z.enum(["admin", "rescuer", "medical", "user"]).default("user"),
          phone: z.string().optional(),
          callSign: z.string().optional(),
          supabaseUserId: z.string().optional(),
          supabaseToken: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const emailVal = input.email.trim().toLowerCase();
        const existing = await getUserByEmail(emailVal);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
        }
        const openId = input.supabaseUserId || `user-${emailVal.replace(/[^a-z0-9]/g, "-")}`;
        const hashedPassword = hashPassword(input.password.trim());
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: hashedPassword,
          role: "user", // Public registration ALWAYS assigns role: user
          loginMethod: input.supabaseUserId ? "supabase-auth" : "platform-login",
          lastSignedIn: new Date(),
        });
        const dbUser = await getUserByEmail(emailVal);
        if (!dbUser) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user account." });
        }
        const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || "User" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
        return {
          success: true,
          user: sanitizeUser(dbUser),
          sessionToken,
        };
      }),
    createUser: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().min(1),
          password: z.string().min(1),
          role: z.enum(["admin", "rescuer", "medical", "user"]),
          callSign: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const emailVal = input.email.trim();
        const openId = `user-${emailVal.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        const hashedPassword = hashPassword(input.password.trim());
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: hashedPassword,
          role: input.role,
          loginMethod: "platform-login",
        });

        const dbUser = await getUserByEmail(emailVal);
        if (dbUser) {
          if (input.role === "rescuer") {
            await ensureRescuerProfile(dbUser.id, input.callSign || "New Unit");
          } else if (input.role === "medical") {
            await ensureHospitalStaffProfile(dbUser.id);
          }
        }
        return { success: true, user: sanitizeUser(dbUser) };
      }),
    updateProfile: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name cannot be empty").optional(),
          phone: z.string().optional(),
          emergencyContact: z.string().optional(),
          bloodGroup: z.string().optional(),
          medicalNotes: z.string().optional(),
          homeDistrict: z.string().optional(),
          address: z.string().optional(),
          preferredLanguage: z.string().optional(),
          safetyNotifications: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to update your profile." });
        }
        const updated = {
          ...ctx.user,
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
          ...(input.emergencyContact !== undefined ? { emergencyContact: input.emergencyContact.trim() } : {}),
          ...(input.bloodGroup !== undefined ? { bloodGroup: input.bloodGroup.trim() } : {}),
          ...(input.medicalNotes !== undefined ? { medicalNotes: input.medicalNotes.trim() } : {}),
          ...(input.homeDistrict !== undefined ? { homeDistrict: input.homeDistrict.trim() } : {}),
          ...(input.address !== undefined ? { address: input.address.trim() } : {}),
          ...(input.preferredLanguage !== undefined ? { preferredLanguage: input.preferredLanguage.trim() } : {}),
          ...(input.safetyNotifications !== undefined ? { safetyNotifications: input.safetyNotifications } : {}),
          updatedAt: new Date(),
        };

        await upsertUser(updated);
        const refreshed = await getUserByOpenId(ctx.user.openId);
        return {
          success: true,
          user: sanitizeUser(refreshed || updated),
        };
      }),
    emergencyContacts: router({
      list: publicProcedure.query(async ({ ctx }) => {
        if (!ctx.user) return [];
        return await getEmergencyContactsByUserId(ctx.user.id);
      }),
      upsert: publicProcedure
        .input(
          z.object({
            id: z.number().optional(),
            name: z.string().min(1, "Contact name is required"),
            relation: z.string().min(1, "Relation is required"),
            phone: z.string().min(1, "Phone number is required"),
            alternatePhone: z.string().optional(),
            isPrimary: z.enum(["yes", "no"]).default("no"),
            notes: z.string().optional(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          if (!ctx.user) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to manage emergency contacts." });
          }
          return await upsertEmergencyContact({
            ...input,
            userId: ctx.user.id,
          });
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
          if (!ctx.user) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to delete emergency contacts." });
          }
          return await deleteEmergencyContact(input.id, ctx.user.id);
        }),
      getForUser: publicProcedure
        .input(z.object({ userId: z.number() }))
        .query(async ({ input, ctx }) => {
          if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "rescuer" && ctx.user.role !== "medical" && ctx.user.id !== input.userId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access restricted to emergency personnel (Admin, Rescuer, Medical)." });
          }
          return await getEmergencyContactsByUserId(input.userId);
        }),
    }),
    listUsers: adminProcedure.query(async () => {
      const all = await getAllUsers();
      return all.map(u => sanitizeUser(u));
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  rescue: rescueRouter,
});

export type AppRouter = typeof appRouter;
