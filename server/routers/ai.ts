import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { generateSahayakResponse } from "../gemini.service";

const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkAiRateLimit(key: string) {
  const now = Date.now();
  const entry = aiRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    aiRateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (entry.count >= 20) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "AI request limit reached for this minute. Please wait a moment or dial 112 / 1070 for immediate emergency services.",
    });
  }
  entry.count++;
}

export const aiRouter = router({
  chat: publicProcedure
    .input(
      z.object({
        message: z
          .string()
          .min(1, "Please enter a message.")
          .max(2000, "Message is too long. Please keep it under 2000 characters."),
        language: z.string().optional(),
        conversationId: z.string().optional(),
        userLocation: z
          .object({
            lat: z.number(),
            lng: z.number(),
          })
          .nullable()
          .optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant", "system"]),
              content: z.string().max(2000),
            })
          )
          .max(10)
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.ip || "unknown";
      const rateLimitKey = ctx.user?.id ? `user-${ctx.user.id}` : `ip-${clientIp}`;
      checkAiRateLimit(rateLimitKey);

      const result = await generateSahayakResponse({
        message: input.message.trim(),
        language: input.language,
        conversationId: input.conversationId,
        userLocation: input.userLocation,
        history: input.history,
      });

      return {
        reply: result.reply,
        conversationId: result.conversationId,
      };
    }),
});

