import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { _memoryUsers, _memoryEmergencyContacts } from "./db";

describe("auth.updateProfile and emergencyContacts procedures", () => {
  it("rejects unauthenticated requests for updateProfile", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      user: null,
    });

    await expect(
      caller.auth.updateProfile({
        name: "Test User",
      })
    ).rejects.toThrow("You must be signed in to update your profile.");
  });

  it("updates authenticated user profile with emergency, medical, and district details", async () => {
    const testUser = {
      id: 99,
      openId: "user-test-citizen",
      name: "Original Name",
      email: "test-citizen@assamrescue.gov.in",
      role: "user" as const,
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    _memoryUsers.set(testUser.openId, testUser);
    _memoryUsers.set(testUser.email, testUser);

    const caller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      user: testUser as any,
    });

    const result = await caller.auth.updateProfile({
      name: "Anupam Deka",
      phone: "+91 98640 12345",
      emergencyContact: "Manashi Deka (+91 94350 98765)",
      bloodGroup: "O+",
      medicalNotes: "Elderly family member requiring boat assistance",
      homeDistrict: "Kamrup Metropolitan",
      address: "House 42, Lachit Nagar, Guwahati",
      preferredLanguage: "as",
      safetyNotifications: true,
    });

    expect(result.success).toBe(true);
    expect(result.user?.name).toBe("Anupam Deka");
    expect((result.user as any)?.phone).toBe("+91 98640 12345");
    expect((result.user as any)?.bloodGroup).toBe("O+");
    expect((result.user as any)?.homeDistrict).toBe("Kamrup Metropolitan");
  });

  it("allows a citizen to add, list, and delete emergency contacts", async () => {
    const citizenUser = {
      id: 105,
      openId: "user-citizen-ec",
      name: "Citizen Contact Test",
      email: "citizen-ec@assamrescue.gov.in",
      role: "user" as const,
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const citizenCaller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      user: citizenUser as any,
    });

    // 1. Add emergency contact
    const created = await citizenCaller.auth.emergencyContacts.upsert({
      name: "Rahul Barman",
      relation: "Brother",
      phone: "+91 98640 99999",
      alternatePhone: "+91 361 254888",
      isPrimary: "yes",
      notes: "Has 2nd floor refuge in Silchar",
    });

    expect(created.name).toBe("Rahul Barman");
    expect(created.relation).toBe("Brother");
    expect(created.isPrimary).toBe("yes");

    // 2. List contacts
    const list = await citizenCaller.auth.emergencyContacts.list();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((c) => c.name === "Rahul Barman")).toBe(true);

    // 3. Admin/Rescuer/Hospital access verification
    const rescuerUser = {
      id: 2,
      openId: "user-rescuer",
      name: "Inspector Barua",
      email: "rescuer@assamrescue.gov.in",
      role: "rescuer" as const,
      loginMethod: "test",
      codeVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const rescuerCaller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      user: rescuerUser as any,
    });

    const rescuerView = await rescuerCaller.auth.emergencyContacts.getForUser({
      userId: 105,
    });
    expect(rescuerView.length).toBeGreaterThanOrEqual(1);
    expect(rescuerView[0].name).toBe("Rahul Barman");

    // 4. Delete contact
    const deleted = await citizenCaller.auth.emergencyContacts.delete({
      id: created.id,
    });
    expect(deleted).toBe(true);
  });
});
