import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import UserProfile from "./UserProfile";
import UserMore from "./UserMore";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: "Anupam Deka",
      email: "citizen@assamrescue.gov.in",
      role: "user",
      phone: "+91 98640 12345",
      emergencyContact: "Manashi Deka (+91 94350 98765)",
      bloodGroup: "O+",
      medicalNotes: "Elderly family member on ground floor",
      homeDistrict: "Kamrup Metropolitan",
      address: "House 42, Lachit Nagar, Guwahati",
      preferredLanguage: "as",
      safetyNotifications: true,
    },
    loading: false,
    updateProfile: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      auth: {
        emergencyContacts: {
          list: { invalidate: vi.fn() },
        },
      },
    }),
    auth: {
      emergencyContacts: {
        list: {
          useQuery: () => ({
            data: [
              {
                id: 1,
                userId: 1,
                name: "Manashi Deka",
                relation: "Spouse",
                phone: "+91 94350 98765",
                alternatePhone: "+91 361 223344",
                isPrimary: "yes",
                notes: "Guwahati residential contact",
              },
            ],
            isLoading: false,
          }),
        },
        upsert: {
          useMutation: () => ({
            mutateAsync: vi.fn(),
            isPending: false,
          }),
        },
        delete: {
          useMutation: () => ({
            mutateAsync: vi.fn(),
            isPending: false,
          }),
        },
        getForUser: {
          useQuery: () => ({
            data: [],
            isLoading: false,
          }),
        },
      },
    },
  },
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "en",
    locale: "en",
    setLanguage: vi.fn(),
    setLocale: vi.fn(),
  }),
  localeOptions: [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "as", label: "Assamese", nativeLabel: "অসমীয়া" },
    { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  ],
}));

vi.mock("@/components/LanguageSelector", () => ({
  default: () => <div data-testid="language-selector" />,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/profile", vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe("UserProfile & UserMore UI Component", () => {
  it("renders the profile customization page with identity, medical, district, and emergency contacts manager", () => {
    const markup = renderToStaticMarkup(<UserProfile />);
    expect(markup).toContain("Profile Customization");
    expect(markup).toContain("Emergency Contacts (Rescue &amp; Hospital Sync)");
    expect(markup).toContain("Manashi Deka");
    expect(markup).toContain("Spouse");
    expect(markup).toContain("+91 94350 98765");
    expect(markup).toContain("Personal Identity &amp; Phone");
    expect(markup).toContain("Medical &amp; Disaster Assistance");
    expect(markup).toContain("Assam District &amp; Locality");
    expect(markup).toContain("Save Profile Changes");
    expect(markup).toContain("Sign Out of Account");
    expect(markup).toContain("Kamrup Metropolitan");
  });

  it("renders UserMore top profile card with clickable customization link and user district/blood group pills", () => {
    const markup = renderToStaticMarkup(<UserMore />);
    expect(markup).toContain("More");
    expect(markup).toContain("Anupam");
    expect(markup).toContain("Tap to customize safety profile &amp; emergency contacts");
    expect(markup).toContain("Kamrup Metropolitan");
    expect(markup).toContain("O+");
    expect(markup).toContain("Disaster Donations");
    expect(markup).not.toContain("Hospital registration");
  });
});
