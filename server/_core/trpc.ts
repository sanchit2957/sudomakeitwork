import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  const user = ctx.user;

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

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
    if (!user || user.role !== "rescuer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Rescuer access is required." });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  }),
);

export const medicalOperationsProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const user = opts.ctx.user;
    if (!user || (user.role !== "medical" && user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Authorized medical operations access is required." });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  }),
);

export const operationalProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const user = opts.ctx.user;
    if (!user || (user.role !== "rescuer" && user.role !== "medical" && user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Operational access is required." });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  }),
);
