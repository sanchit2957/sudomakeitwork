import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildSahayakSystemInstruction,
  generateSahayakResponse,
  LOCALE_NAMES,
  realDataTools,
  SAHAYAK_SYSTEM_INSTRUCTIONS,
} from "./gemini.service";

describe("Sahayak AI Gemini Service & Real-Data Tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("contains all 20 critical safety rules in system instructions", () => {
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Always prioritize immediate human safety");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Never claim that a rescuer has been dispatched");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Never claim that an SOS request was created");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Never invent hospitals");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Never make a medical diagnosis");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Never encourage users to walk, swim, or drive through dangerous flood water");
  });

  it("builds language-aware system instructions while preserving all safety rules", () => {
    expect(buildSahayakSystemInstruction("en")).toBe(SAHAYAK_SYSTEM_INSTRUCTIONS);
    expect(buildSahayakSystemInstruction(undefined)).toBe(SAHAYAK_SYSTEM_INSTRUCTIONS);

    const assamesePrompt = buildSahayakSystemInstruction("as");
    expect(assamesePrompt).toContain("Assamese (অসমীয়া)");
    expect(assamesePrompt).toContain("CRITICAL LANGUAGE DIRECTIVE");
    expect(assamesePrompt).toContain("Always prioritize immediate human safety");
    expect(assamesePrompt).toContain("Never encourage users to walk, swim, or drive through dangerous flood water");

    const hindiPrompt = buildSahayakSystemInstruction("hi");
    expect(hindiPrompt).toContain("Hindi (हिन्दी)");
    expect(hindiPrompt).toContain("CRITICAL LANGUAGE DIRECTIVE");
    expect(hindiPrompt).toContain("Always prioritize immediate human safety");

    const bengaliPrompt = buildSahayakSystemInstruction("bn");
    expect(bengaliPrompt).toContain("Bengali (বাংলা)");
    expect(bengaliPrompt).toContain("Always prioritize immediate human safety");
  });

  it("retrieves real weather and flood risk data for Assam districts", async () => {
    const data = await realDataTools.getCurrentWeatherAndFloodRisk({ district: "Kamrup Metro" });
    expect(data.success).toBe(true);
    expect(data.coordinates).toBeDefined();
    expect(data.riverGauge).toBeDefined();
  });

  it("finds registered hospitals with bed and oxygen availability", async () => {
    const data = await realDataTools.findNearbyHospitals({ query: "Hospital" });
    expect(data.success).toBe(true);
    expect(Array.isArray(data.hospitals)).toBe(true);
  });

  it("retrieves official Assam disaster helplines including 112 and 1070", async () => {
    const data = await realDataTools.getEmergencyHelplines();
    expect(data.success).toBe(true);
    expect(data.helplines.nationalEmergency).toBe("112");
    expect(data.helplines.stateEmergencyOperationsCentre).toContain("1070");
    expect(data.helplines.ambulanceService).toBe("108");
  });

  it("provides platform assistance guidance for SOS and Voice Notes", async () => {
    const sosGuide = await realDataTools.getPlatformAssistanceGuide({ topic: "sos" });
    expect(sosGuide.success).toBe(true);
    expect(sosGuide.instructions).toContain("SOS button");

    const voiceGuide = await realDataTools.getPlatformAssistanceGuide({ topic: "voice_note" });
    expect(voiceGuide.success).toBe(true);
    expect(voiceGuide.instructions).toContain("Voice Note");
  });

  it("returns localized safe emergency fallback when GEMINI_API_KEY is not set or errors", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const enResponse = await generateSahayakResponse({ message: "Where can I find higher ground?", language: "en" });
    expect(enResponse.reply).toContain("Sahayak AI is temporarily unable to connect");
    expect(enResponse.reply).toContain("112");
    expect(enResponse.reply).toContain("1070");

    const asResponse = await generateSahayakResponse({ message: "সহায়তা লাগে", language: "as" });
    expect(asResponse.reply).toContain("সহায়ক AI সাময়িকভাৱে সংযোগ কৰিবলৈ অসমৰ্থ");
    expect(asResponse.reply).toContain("SOS");
    expect(asResponse.reply).toContain("১১২");
    expect(asResponse.reply).toContain("১০৭০");

    const hiResponse = await generateSahayakResponse({ message: "मदद चाहिए", language: "hi" });
    expect(hiResponse.reply).toContain("सहायक AI अस्थायी रूप से कनेक्ट करने में असमर्थ है");
    expect(hiResponse.reply).toContain("SOS");
    expect(hiResponse.reply).toContain("112");
    expect(hiResponse.reply).toContain("1070");

    process.env.GEMINI_API_KEY = originalKey;
  });
});
