import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getRoleCodeVersion } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

async function validateSessionCodeVersion(user: any) {
  if (!user || (user as any).loginMethod === "test" || user.role === "admin" || user.role === "user") {
    return;
  }
  const roleToCheck = user.role === "medical" ? "hospital" : user.role;
  if (roleToCheck === "rescuer" || roleToCheck === "hospital") {
    const currentVersion = await getRoleCodeVersion(roleToCheck);
    if ((user as any).codeVersion === undefined || (user as any).codeVersion !== currentVersion) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "ACCESS_CODE_REVOKED" });
    }
  }
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  const user = ctx.user;

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (user.status === "disabled") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been disabled. Please contact an administrator." });
  }

  await validateSessionCodeVersion(user);

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    if (ctx.user.status === 'disabled') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been disabled. Please contact an administrator." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const rescuerProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const user = opts.ctx.user;
    if (!user || (user.role !== "rescuer" && user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Rescuer access is required." });
    }
    await validateSessionCodeVersion(user);
    return opts.next({ ctx: { ...opts.ctx, user } });
  }),
);

export const hospitalProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const user = opts.ctx.user;
    if (!user || (user.role !== "hospital" && user.role !== "medical" && user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Authorized hospital operations access is required." });
    }
    await validateSessionCodeVersion(user);
    return opts.next({ ctx: { ...opts.ctx, user } });
  }),
);

export const hospitalOperationsProcedure = hospitalProcedure;
export const medicalOperationsProcedure = hospitalProcedure;

export const operationalProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const user = opts.ctx.user;
    if (!user || (user.role !== "rescuer" && user.role !== "hospital" && user.role !== "medical" && user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Operational access is required." });
    }
    await validateSessionCodeVersion(user);
    return opts.next({ ctx: { ...opts.ctx, user } });
  }),
);
