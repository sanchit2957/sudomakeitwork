import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RequestDetails } from "./Track";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 7, name: "Victim" } }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ rescue: { emergency: { myDetailsByCode: { invalidate: () => undefined } } } }),
    rescue: { emergency: { myDetailsByCode: { useQuery: () => ({ data: null, isLoading: false, error: null }) }, updateMyDetails: { useMutation: () => ({ isPending: false, mutate: () => undefined, error: null }) } } },
  },
}));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

describe("rapid SOS post-alert UI", () => {
  it("presents a concise Add more details entry only while the SOS is active", () => {
    const active = renderToStaticMarkup(createElement(RequestDetails, { publicCode: "SOS-ABCDEFGH", active: true }));
    const resolved = renderToStaticMarkup(createElement(RequestDetails, { publicCode: "SOS-ABCDEFGH", active: false }));
    expect(active).toContain("Add more details");
    expect(active).toContain("People with you, help needed");
    expect(resolved).toBe("");
  });
});
