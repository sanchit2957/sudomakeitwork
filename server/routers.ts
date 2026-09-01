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
  getAllRoleAccessCodes,
  getAllUsers,
  getEmergencyContactsByUserId,
  getRoleAccessCode,
  getRoleCodeVersion,
  getUserByEmail,
  getUserByOpenId,
  setRoleAccessCode,
  upsertEmergencyContact,
  upsertUser,
  verifyRoleAccessCode,
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

function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, "password">;
function sanitizeUser<T extends Record<string, any>>(user: null | undefined): null;
function sanitizeUser<T extends Record<string, any>>(user: T | null | undefined): Omit<T, "password"> | null;
function sanitizeUser<T extends Record<string, any>>(user: T | null | undefined): Omit<T, "password"> | null {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export const appRouter = router({
  system: systemRouter,
  ai: aiRouter,
  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    getPublicConfig: publicProcedure.query(() => ({
      adminContactNumber: ENV.adminContactNumber,
    })),
    checkSessionVersion: publicProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) {
        return {
          valid: true,
          authenticated: false,
          role: null,
          codeVersion: null,
          currentVersion: null,
          adminContactNumber: ENV.adminContactNumber,
        };
      }
      if (user.role === "admin" || user.role === "user") {
        return {
          valid: true,
          authenticated: true,
          role: user.role,
          codeVersion: null,
          currentVersion: null,
          adminContactNumber: ENV.adminContactNumber,
        };
      }
      const roleToCheck = user.role === "medical" ? "hospital" : user.role;
      const currentVersion = await getRoleCodeVersion(roleToCheck);
      const sessionVersion = (user as any).codeVersion;
      const isValid = (user as any).loginMethod === "test" || (sessionVersion !== undefined && sessionVersion === currentVersion);
      return {
        valid: isValid,
        authenticated: true,
        role: user.role,
        codeVersion: sessionVersion ?? null,
        currentVersion,
        adminContactNumber: ENV.adminContactNumber,
      };
    }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().optional(),
          password: z.string().optional(),
          role: z.enum(["admin", "rescuer", "hospital", "medical", "user"]).optional(),
          governmentCode: z.string().optional(),
          supabaseToken: z.string().optional(),
          isNative: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // If Supabase token is provided, verify against Supabase server-side
        if (input.supabaseToken) {
          const { verifySupabaseToken } = await import("./_core/supabase");
          const sbUser = await verifySupabaseToken(input.supabaseToken);
          if (sbUser && sbUser.email) {
            const emailVal = sbUser.email.trim().toLowerCase();
            const requestedRole = input.role ? (input.role === "medical" ? "hospital" : input.role) : undefined;
            // Look up by email only. The getUserByOpenId(sbUser.id) fallback was incorrect:
            // sbUser.id is the raw Supabase UUID but our openId format is "${role}-${uuid}".
            // That incorrect lookup generated a wasted DB query that would never match.
            let dbUser = await getUserByEmail(emailVal, requestedRole);
            const roleVal = requestedRole || resolveVerifiedRole(emailVal, dbUser?.role);
            const openId = `${roleVal}-${sbUser.id}`.slice(0, 64);
            if (!dbUser) {
              const nameVal = sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || emailVal.split("@")[0];
              await upsertUser({
                openId,
                name: nameVal,
                email: emailVal,
                role: roleVal,
                loginMethod: "supabase-auth",
                lastSignedIn: new Date(),
              });
              dbUser = await getUserByEmail(emailVal, roleVal);
            } else {
              await upsertUser({ ...dbUser, openId: dbUser.openId || openId, role: roleVal, lastSignedIn: new Date() });
              dbUser = await getUserByEmail(emailVal, roleVal);
            }

            if (dbUser) {
              if (dbUser.status === "disabled") {
                throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been disabled. Please contact an administrator." });
              }

              let codeVersion: number | undefined;
              if (roleVal === "rescuer" || roleVal === "hospital") {
                codeVersion = await getRoleCodeVersion(roleVal);
              }

              if (roleVal === "rescuer") {
                await ensureRescuerProfile(dbUser.id, sbUser.user_metadata?.callSign || "Field Unit");
              } else if (roleVal === "hospital") {
                await ensureHospitalStaffProfile(dbUser.id);
              }

              const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || "User", codeVersion });
              const cookieOptions = getSessionCookieOptions(ctx.req);
              ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
              return {
                success: true,
                user: sanitizeUser(dbUser),
                sessionToken: input.isNative ? sessionToken : undefined,
              };
            }
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP verification token." });
        }

        if (!input.email || !input.password) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email and password are required." });
        }
        
        const emailInput = input.email.trim().toLowerCase();
        const targetRole = input.role
          ? (input.role === "medical" ? "hospital" : input.role)
          : undefined;

        let user: any = null;
        if (targetRole) {
          user = await getUserByEmail(emailInput, targetRole);
          if (!user && (targetRole === "hospital" || targetRole === "rescuer")) {
            const adminUser = await getUserByEmail(emailInput, "admin");
            if (adminUser) user = adminUser;
          }
        } else {
          // If no role specified, check if there's a user role matching password, or fallback
          const userCitizen = await getUserByEmail(emailInput, "user");
          if (userCitizen && userCitizen.password && verifyPassword(input.password.trim(), userCitizen.password)) {
            user = userCitizen;
          } else {
            user = await getUserByEmail(emailInput);
          }
        }

        if (!user || !user.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        const isAuthorized =
          !targetRole ||
          user.role === targetRole ||
          user.role === "admin" ||
          (targetRole === "hospital" && user.role === "medical");

        if (!isAuthorized) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        if (user.status === "disabled") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been disabled. Please contact an administrator." });
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

        let codeVersion: number | undefined;
        if (user.role === "rescuer" || user.role === "hospital") {
          if (!input.governmentCode || !input.governmentCode.trim()) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: `A valid Government Access Code is required to log in to the ${user.role === "rescuer" ? "Rescuer" : "Hospital"} portal.`,
            });
          }
          const isCodeValid = await verifyRoleAccessCode(user.role, input.governmentCode);
          if (!isCodeValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: `Invalid Government Access Code for ${user.role === "rescuer" ? "Rescuer" : "Hospital"} portal.`,
            });
          }
          codeVersion = await getRoleCodeVersion(user.role);

          // Ensure linked profiles exist
          if (user.role === "hospital") {
            await ensureHospitalStaffProfile(user.id);
          } else if (user.role === "rescuer") {
            await ensureRescuerProfile(user.id, "Field Unit");
          }
        }

        await upsertUser({ ...user, lastSignedIn: new Date() });

        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "User", codeVersion });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          success: true,
          user: sanitizeUser(user),
          sessionToken: input.isNative ? sessionToken : undefined,
        };
      }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Invalid email address"),
          password: z.string().min(1, "Password is required"),
          role: z.enum(["admin", "rescuer", "hospital", "medical", "user"]).default("user"),
          governmentCode: z.string().optional(),
          phone: z.string().optional(),
          callSign: z.string().optional(),
          supabaseUserId: z.string().optional(),
          supabaseToken: z.string().optional(),
          isNative: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const emailVal = input.email.trim().toLowerCase();
        const requestedRole = input.role === "medical" ? "hospital" : input.role;
        let assignedRole: "user" | "rescuer" | "hospital" = "user";
        let codeVersion: number | undefined;

        if (requestedRole === "rescuer" || requestedRole === "hospital") {
          if (!input.governmentCode || !input.governmentCode.trim()) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Government Access Code is required to register as ${requestedRole === "rescuer" ? "a Rescuer" : "Hospital Staff"}.`,
            });
          }
          const isCodeValid = await verifyRoleAccessCode(requestedRole, input.governmentCode);
          if (!isCodeValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: `Invalid Government Access Code for ${requestedRole === "rescuer" ? "Rescuer" : "Hospital"} registration.`,
            });
          }
          assignedRole = requestedRole;
          codeVersion = await getRoleCodeVersion(requestedRole);
        }

        const existing = await getUserByEmail(emailVal, assignedRole);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists for this role." });
        }

        const sanitizedEmail = emailVal.replace(/[^a-z0-9]/g, "-").slice(0, 36);
        const openId = input.supabaseUserId
          ? `${assignedRole}-${input.supabaseUserId}`.slice(0, 64)
          : `user-${assignedRole}-${sanitizedEmail}`.slice(0, 64);
        const hashedPassword = hashPassword(input.password.trim());
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: hashedPassword,
          role: assignedRole,
          status: "active",
          loginMethod: input.supabaseUserId ? "supabase-auth" : "platform-login",
          lastSignedIn: new Date(),
        });

        const dbUser = await getUserByEmail(emailVal, assignedRole);
        if (!dbUser) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user account." });
        }

        if (assignedRole === "rescuer") {
          await ensureRescuerProfile(dbUser.id, input.callSign || "Field Unit");
        } else if (assignedRole === "hospital") {
          await ensureHospitalStaffProfile(dbUser.id);
        }

        const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || "User", codeVersion });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
        return {
          success: true,
          user: sanitizeUser(dbUser),
          sessionToken: input.isNative ? sessionToken : undefined,
        };
      }),
    accessCodes: router({
      list: adminProcedure.query(async () => {
        return await getAllRoleAccessCodes();
      }),
      updateCode: adminProcedure
        .input(
          z.object({
            role: z.enum(["rescuer", "hospital"]),
            code: z.string().min(4, "Access code must be at least 4 characters"),
          })
        )
        .mutation(async ({ input, ctx }) => {
          return await setRoleAccessCode(input.role, input.code, ctx.user.id);
        }),
      regenerateCode: adminProcedure
        .input(
          z.object({
            role: z.enum(["rescuer", "hospital"]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
          const prefix = input.role === "rescuer" ? "RESC" : "HOSP";
          const generatedCode = `ASSAM-${prefix}-${randomSuffix}`;
          const res = await setRoleAccessCode(input.role, generatedCode, ctx.user.id);
          return {
            role: res.role,
            code: generatedCode,
            codeVersion: res.codeVersion,
            updatedAt: res.updatedAt,
          };
        }),
    }),
    createUser: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email("Invalid email address"),
          password: z.string().min(1),
          role: z.enum(["admin", "rescuer", "hospital", "medical", "user"]).default("user"),
          callSign: z.string().optional(),
          hospitalId: z.number().optional(),
          designation: z.string().optional(),
          phone: z.string().optional(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const emailVal = input.email.trim().toLowerCase();
        const assignedRole: "admin" | "rescuer" | "hospital" | "user" =
          input.role === "medical" ? "hospital" : input.role;

        const existing = await getUserByEmail(emailVal, assignedRole);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists for this role." });
        }

        const sanitizedEmail = emailVal.replace(/[^a-z0-9]/g, "-").slice(0, 36);
        const openId = `user-${assignedRole}-${sanitizedEmail}`.slice(0, 64);
        const hashedPassword = hashPassword(input.password.trim());
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: hashedPassword,
          role: assignedRole,
          status: "active",
          loginMethod: "platform-login",
        });

        const dbUser = await getUserByEmail(emailVal, assignedRole);
        if (dbUser) {
          if (assignedRole === "rescuer") {
            await ensureRescuerProfile(dbUser.id, input.callSign || "New Field Unit");
          } else if (assignedRole === "hospital") {
            await ensureHospitalStaffProfile(dbUser.id);
          }

          try {
            const { writeAudit } = await import("./rescue.db");
            await writeAudit(
              ctx.user.id,
              "USER_CREATED",
              "user",
              dbUser.id,
              JSON.stringify({
                createdEmail: emailVal,
                assignedRole,
                reason: input.reason || "Provisioned by administrator",
              })
            );
          } catch {}
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
