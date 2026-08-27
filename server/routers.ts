import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./auth.password";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  ensureHospitalStaffProfile,
  ensureRescuerProfile,
  getAllUsers,
  getUserByEmail,
  getUserByOpenId,
  upsertUser,
} from "./db";
import { rescueRouter } from "./routers/rescue";

function sanitizeUser<T extends Record<string, any>>(user: T | null): Omit<T, "password"> | null {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().optional(),
          password: z.string().optional(),
          role: z.enum(["admin", "rescuer", "medical", "user"]).optional(),
          name: z.string().optional(),
          callSign: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!input.email || !input.password) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email and password are required." });
        }
        
        const emailInput = input.email.trim().toLowerCase();
        const user = await getUserByEmail(emailInput);
        
        if (!user || !verifyPassword(input.password, user.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }
        
        await upsertUser({ ...user, lastSignedIn: new Date() });
        const dbUser = user;

        const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || "User" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          success: true,
          user: sanitizeUser(dbUser),
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const emailVal = input.email.trim().toLowerCase();
        const existing = await getUserByEmail(emailVal);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
        }
        const openId = `user-${emailVal.replace(/[^a-z0-9]/g, "-")}`;
        const hashedPassword = hashPassword(input.password.trim());
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: hashedPassword,
          role: "user", // Registration always sets role to user; approval grants privileges
          loginMethod: "platform-login",
          lastSignedIn: new Date(),
        });
        const dbUser = await getUserByEmail(emailVal);
        if (!dbUser) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user account." });
        }
        if (input.role === "rescuer") {
          await ensureRescuerProfile(dbUser.id, input.callSign || input.name.trim());
        } else if (input.role === "medical") {
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
