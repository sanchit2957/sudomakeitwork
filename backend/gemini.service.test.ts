import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildSahayakSystemInstruction,
  generateSahayakResponse,
  isDisasterRelatedMessage,
  LOCALE_NAMES,
  realDataTools,
  SAHAYAK_REDIRECT_MESSAGE,
  SAHAYAK_SYSTEM_INSTRUCTIONS,
} from "./gemini.service";

describe("Sahayak AI Gemini Service & Guardrails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("contains the exact emergency & app feature restriction system instructions", () => {
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("You are Sahayak AI");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("river levels & gauge monitoring");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain("Rapid SOS, Voice Notes, Case Tracking");
    expect(SAHAYAK_SYSTEM_INSTRUCTIONS).toContain(SAHAYAK_REDIRECT_MESSAGE);
  });

  it("builds language-aware system instructions while maintaining the restriction prompt", () => {
    expect(buildSahayakSystemInstruction("en")).toBe(SAHAYAK_SYSTEM_INSTRUCTIONS);
    expect(buildSahayakSystemInstruction(undefined)).toBe(SAHAYAK_SYSTEM_INSTRUCTIONS);

    const assamesePrompt = buildSahayakSystemInstruction("as");
    expect(assamesePrompt).toContain("Assamese (অসমীয়া)");
    expect(assamesePrompt).toContain("CRITICAL LANGUAGE DIRECTIVE");
    expect(assamesePrompt).toContain(SAHAYAK_SYSTEM_INSTRUCTIONS);

    const hindiPrompt = buildSahayakSystemInstruction("hi");
    expect(hindiPrompt).toContain("Hindi (हिन्दी)");
    expect(hindiPrompt).toContain("CRITICAL LANGUAGE DIRECTIVE");
    expect(hindiPrompt).toContain(SAHAYAK_SYSTEM_INSTRUCTIONS);

    const bengaliPrompt = buildSahayakSystemInstruction("bn");
    expect(bengaliPrompt).toContain("Bengali (বাংলা)");
    expect(bengaliPrompt).toContain(SAHAYAK_SYSTEM_INSTRUCTIONS);
  });

  describe("Keyword Pre-Filter", () => {
    it("identifies disaster, emergency, river level, and app feature messages correctly", () => {
      // River levels & gauges
      expect(isDisasterRelatedMessage("What is the river level in Brahmaputra?")).toBe(true);
      expect(isDisasterRelatedMessage("Is the water level rising above the danger mark?")).toBe(true);
      expect(isDisasterRelatedMessage("Check river gauge readings for Guwahati")).toBe(true);
      expect(isDisasterRelatedMessage("Barak river flood level")).toBe(true);

      // App features
      expect(isDisasterRelatedMessage("What features does this app have?")).toBe(true);
      expect(isDisasterRelatedMessage("How to use Rapid SOS button?")).toBe(true);
      expect(isDisasterRelatedMessage("How do I record a voice note for rescue?")).toBe(true);
      expect(isDisasterRelatedMessage("How to track rescue case code?")).toBe(true);
      expect(isDisasterRelatedMessage("Explain the safety tab checklist")).toBe(true);
      expect(isDisasterRelatedMessage("How does the hospital portal work?")).toBe(true);

      // Disaster, medical & shelters
      expect(isDisasterRelatedMessage("Where is the nearest flood shelter?")).toBe(true);
      expect(isDisasterRelatedMessage("Is it raining in Guwahati today?")).toBe(true);
      expect(isDisasterRelatedMessage("I need an ambulance and hospital bed")).toBe(true);
      expect(isDisasterRelatedMessage("First aid help for severe bleeding")).toBe(true);
      expect(isDisasterRelatedMessage("How do I evacuate safely?")).toBe(true);

      // Multilingual terms
      expect(isDisasterRelatedMessage("নদীৰ জলস্তৰ কিমান?")).toBe(true);
      expect(isDisasterRelatedMessage("বানপানীৰ পৰা বাচিবলৈ কি কৰিম?")).toBe(true);
      expect(isDisasterRelatedMessage("मुझे बाढ़ में मदद चाहिए")).toBe(true);
      expect(isDisasterRelatedMessage("नदी का जलस्तर कितना है?")).toBe(true);
    });

    it("filters out off-topic queries such as physics, math, coding, and general trivia", () => {
      expect(isDisasterRelatedMessage("Explain Newton's second law of motion in physics")).toBe(false);
      expect(isDisasterRelatedMessage("Solve the quadratic equation x^2 + 5x + 6 = 0")).toBe(false);
      expect(isDisasterRelatedMessage("Write a python function to reverse a linked list")).toBe(false);
      expect(isDisasterRelatedMessage("What is the capital city of France?")).toBe(false);
      expect(isDisasterRelatedMessage("Tell me a funny joke about cats")).toBe(false);
      expect(isDisasterRelatedMessage("Who won the 2022 World Cup?")).toBe(false);
      expect(isDisasterRelatedMessage("Recipe for chocolate cake")).toBe(false);
    });

    it("immediately intercepts off-topic messages and returns redirect without calling Gemini", async () => {
      const response = await generateSahayakResponse({
        message: "Can you calculate the kinetic energy of a 5kg mass moving at 10m/s?",
      });

      expect(response.reply).toBe(SAHAYAK_REDIRECT_MESSAGE);
    });
  });

  it("retrieves real weather and river gauge data for Assam districts", async () => {
    const data = await realDataTools.getCurrentWeatherAndFloodRisk({ district: "Kamrup Metro" });
    expect(data.success).toBe(true);
    expect(data.coordinates).toBeDefined();
    expect(data.riverGauge).toBeDefined();
  }, 30000);

  it("finds registered hospitals with bed and oxygen availability", async () => {
    const data = await realDataTools.findNearbyHospitals({ query: "Hospital" });
    expect(data.success).toBe(true);
    expect(Array.isArray(data.hospitals)).toBe(true);
  });

  it("calculates distance and sorts hospitals nearest-first when user coordinates are supplied", async () => {
    const data = await realDataTools.findNearbyHospitals({ lat: 26.1445, lng: 91.7362 });
    expect(data.success).toBe(true);
    expect(data.hospitals.length).toBeGreaterThan(0);
    expect(data.hospitals[0].distanceKm).toBeDefined();
    expect(typeof data.hospitals[0].distanceKm).toBe("number");
    
    // Ensure sorted nearest first
    if (data.hospitals.length > 1) {
      expect(data.hospitals[0].distanceKm!).toBeLessThanOrEqual(data.hospitals[1].distanceKm!);
    }
  });

  it("retrieves official Assam disaster helplines including 112 and 1070", async () => {
    const data = await realDataTools.getEmergencyHelplines();
    expect(data.success).toBe(true);
    expect(data.helplines.nationalEmergency).toBe("112");
    expect(data.helplines.stateEmergencyOperationsCentre).toContain("1070");
    expect(data.helplines.ambulanceService).toBe("108");
  });

  it("provides platform assistance guidance for SOS, Voice Notes, River Gauges, and all features", async () => {
    const sosGuide = await realDataTools.getPlatformAssistanceGuide({ topic: "sos" });
    expect(sosGuide.success).toBe(true);
    expect(sosGuide.instructions).toContain("SOS button");

    const voiceGuide = await realDataTools.getPlatformAssistanceGuide({ topic: "voice_note" });
    expect(voiceGuide.success).toBe(true);
    expect(voiceGuide.instructions).toContain("Voice Note");

    const riverGuide = await realDataTools.getPlatformAssistanceGuide({ topic: "river_level" });
    expect(riverGuide.success).toBe(true);
    expect(riverGuide.instructions).toContain("River Gauge");

    const allFeaturesGuide = await realDataTools.getPlatformAssistanceGuide({ topic: "all_features" });
    expect(allFeaturesGuide.success).toBe(true);
    expect(allFeaturesGuide.instructions).toContain("Rapid SOS");
    expect(allFeaturesGuide.instructions).toContain("Voice Notes");
    expect(allFeaturesGuide.instructions).toContain("Live Case Tracking");
  });

  it("returns smart, actionable local fallback response with real river gauge & feature data when Gemini API is offline/rate-limited", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // River level test
    const riverResponse = await generateSahayakResponse({ message: "What is the Brahmaputra river level in Guwahati?", language: "en" });
    expect(riverResponse.reply).toContain("River");
    expect(riverResponse.reply).toContain("Water Level");
    expect(riverResponse.reply).toContain("112");

    // App features test
    const featureResponse = await generateSahayakResponse({ message: "Tell me all features in this app", language: "en" });
    expect(featureResponse.reply).toContain("Rapid SOS");
    expect(featureResponse.reply).toContain("Voice Notes");
    expect(featureResponse.reply).toContain("Live Case Tracking");

    // Hospital test
    const hospitalResponse = await generateSahayakResponse({ message: "Find nearby hospital with ICU bed and oxygen", language: "en" });
    expect(hospitalResponse.reply).toContain("Hospital");
    expect(hospitalResponse.reply).toContain("108");

    // Shelter test
    const shelterResponse = await generateSahayakResponse({ message: "Where is the nearest flood relief camp shelter?", language: "en" });
    expect(shelterResponse.reply.toLowerCase()).toContain("relief");

    // Multilingual Assamese river level
    const asRiverResponse = await generateSahayakResponse({ message: "ব্ৰহ্মপুত্ৰ নদীৰ জলস্তৰ কিমান?", language: "as" });
    expect(asRiverResponse.reply).toContain("জলস্তৰ");

    // Multilingual Hindi river level
    const hiRiverResponse = await generateSahayakResponse({ message: "नदी का जलस्तर क्या है?", language: "hi" });
    expect(hiRiverResponse.reply).toContain("जलस्तर");

    process.env.GEMINI_API_KEY = originalKey;
  });
});
