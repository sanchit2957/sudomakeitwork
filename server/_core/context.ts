import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk, type AuthenticatedUser } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error: any) {
    // If it's an explicit unauthenticated state (missing/invalid cookie, user missing in DB)
    if (
      error?.name === "ForbiddenError" ||
      error?.status === 403 ||
      error?.statusCode === 403 ||
      error?.message?.includes("Invalid session") ||
      error?.message?.includes("User not found")
    ) {
      user = null;
    } else {
      // Re-throw transient database/system errors so TRPC fails gracefully with 500 rather than returning user: null
      console.error("[Context] Authentication encountered server/database error:", error?.message || error);
      throw error;
    }
  }

  if (!user) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
