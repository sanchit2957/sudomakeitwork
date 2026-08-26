import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./_core/password";
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

function sanitizeUser(user: NonNullable<Awaited<ReturnType<typeof getUserByOpenId>>>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loginMethod: user.loginMethod,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignedIn: user.lastSignedIn,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? sanitizeUser(opts.ctx.user) : null),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().optional(),
          password: z.string().optional(),
          name: z.string().optional(),
          callSign: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let dbUser;
        const emailInput = (input.email || "").trim().toLowerCase();
        if (input.password !== undefined) {
          const user = await getUserByEmail(emailInput);
          if (!user || !user.password || !(await verifyPassword(input.password, user.password))) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username, email, or password." });
          }
          if (!user.password.startsWith("scrypt:")) {
            await upsertUser({ openId: user.openId, password: await hashPassword(input.password) });
          }
          await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
          dbUser = await getUserByOpenId(user.openId);
        } else {
          const openId = emailInput ? `user-${emailInput.replace(/[^a-z0-9]/g, "-")}` : "user-anonymous";
          await upsertUser({
            openId,
            name: input.name || "User",
            email: emailInput || "user@assamrescue.gov.in",
            role: "user",
            loginMethod: "platform-login",
            lastSignedIn: new Date(),
          });
          dbUser = await getUserByOpenId(openId);
        }

        if (!dbUser) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User account could not be loaded." });
        }

        const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || "User" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          success: true,
          user: sanitizeUser(dbUser),
        };
      }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Invalid email address"),
          password: z.string().min(1, "Password is required"),
          role: z.enum(["rescuer", "medical", "user"]).optional(),
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
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: await hashPassword(input.password.trim()),
          role: "user",
          loginMethod: "platform-login",
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
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: await hashPassword(input.password.trim()),
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
        return { success: true, user: dbUser ? sanitizeUser(dbUser) : null };
      }),
    listUsers: adminProcedure.query(async () => {
      return (await getAllUsers()).map(sanitizeUser);
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
