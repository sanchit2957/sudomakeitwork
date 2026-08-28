import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { generateSahayakResponse } from "../gemini.service";

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
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant", "system"]),
              content: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await generateSahayakResponse({
        message: input.message.trim(),
        language: input.language,
        conversationId: input.conversationId,
        history: input.history,
      });

      return {
        reply: result.reply,
        conversationId: result.conversationId,
      };
    }),
});
