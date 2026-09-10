import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as geminiService from "./gemini.service";

vi.spyOn(geminiService, "generateSahayakResponse").mockResolvedValue({
  reply: "This is a mocked AI response",
  conversationId: "test-conv-id",
});

describe("AI tRPC Router (ai.chat)", () => {
  const createCaller = (ctx: any = {}) => appRouter.createCaller(ctx);

  it("handles chat input and returns a response structure", async () => {
    const caller = createCaller({
      user: null,
      req: { cookies: {}, headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await caller.ai.chat({
      message: "What are the emergency numbers in Assam?",
    });

    expect(result).toBeDefined();
    expect(typeof result.reply).toBe("string");
    expect(result.reply.length).toBeGreaterThan(0);
  }, 60000);

  it("rejects empty messages with validation error", async () => {
    const caller = createCaller({
      user: null,
      req: { cookies: {}, headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(caller.ai.chat({ message: "" })).rejects.toThrow();
  });

  it("accepts chat history array with role and content", async () => {
    const caller = createCaller({
      user: null,
      req: { cookies: {}, headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await caller.ai.chat({
      message: "Can you help me find a hospital?",
      history: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi, I am Sahayak AI. How can I help you?" },
      ],
    });

    expect(result).toBeDefined();
    expect(typeof result.reply).toBe("string");
  }, 60000);

  it("accepts optional userLocation coordinates and forwards them", async () => {
    const caller = createCaller({
      user: null,
      req: { cookies: {}, headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await caller.ai.chat({
      message: "Where is the nearest hospital with an ICU bed?",
      userLocation: { lat: 26.1445, lng: 91.7362 },
    });

    expect(result).toBeDefined();
    expect(geminiService.generateSahayakResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Where is the nearest hospital with an ICU bed?",
        userLocation: { lat: 26.1445, lng: 91.7362 },
      })
    );
  });
});
