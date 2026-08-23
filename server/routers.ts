import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
        let dbUser;
        const emailInput = (input.email || "").trim().toLowerCase();
        const role = input.role || (emailInput === "admin" ? "admin" : "user");

        if (input.password !== undefined) {
          // Credential-based login
          if ((emailInput === "admin" || emailInput === "admin@assamrescue.gov.in") && input.password === "admin") {
            const openId = "user-admin";
            await upsertUser({
              openId,
              name: input.name || "Superadmin",
              email: "admin@assamrescue.gov.in",
              password: input.password,
              role: "admin",
              loginMethod: "platform-login",
              lastSignedIn: new Date(),
            });
            dbUser = await getUserByEmail("admin@assamrescue.gov.in");
          } else {
            const user = await getUserByEmail(emailInput);
            if (!user || user.password !== input.password) {
              throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username, email, or password." });
            }
            await upsertUser({ ...user, lastSignedIn: new Date() });
            dbUser = user;
          }
        } else {
          // Role-based or test login
          const openId = emailInput ? `user-${emailInput.replace(/[^a-z0-9]/g, "-")}` : `test-${role}-01`;
          await upsertUser({
            openId,
            name: input.name || `Test ${role}`,
            email: emailInput || `${role}@assamrescue.gov.in`,
            role,
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
          user: dbUser,
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
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: emailVal,
          password: input.password.trim(),
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
        return { success: true, user: dbUser };
      }),
    listUsers: adminProcedure.query(async () => {
      return await getAllUsers();
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
