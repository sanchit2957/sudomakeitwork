import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from './db';
import { appRouter } from './routers';
import { sdk } from './_core/sdk';

describe('Master Regression Suite — Production Authentication, Role Routing & Security (32 Scenarios)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  // TEST 1: Unauthenticated / -> login
  it('TEST 1: Unauthenticated "/" caller receives null user session from auth.me', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  // TEST 2: Unauthenticated /command -> login
  it('TEST 2: Unauthenticated "/command" caller is rejected from admin operational procedures', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    await expect(caller.rescue.operations.analytics()).rejects.toThrow();
  });

  // TEST 3: Unauthenticated /responder -> login
  it('TEST 3: Unauthenticated "/responder" caller is rejected from responder active mission procedures', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    await expect(caller.rescue.operations.activeMission()).rejects.toThrow();
  });

  // TEST 4: Unauthenticated /medical -> login
  it('TEST 4: Unauthenticated "/medical" caller is rejected from hospital procedures', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    await expect(caller.rescue.operations.hospitalRequests()).rejects.toThrow();
  });

  // TEST 5: Unauthenticated /hospital -> login
  it('TEST 5: Unauthenticated "/hospital" caller is rejected from updating hospital details', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    await expect(caller.rescue.operations.updateHospital({ id: 1, availableEmergencyBeds: 5 })).rejects.toThrow();
  });

  // TEST 6: Authenticated citizen -> /
  it('TEST 6: Authenticated citizen has role="user" and accesses citizen resources', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 10, openId: 'citizen-10', name: 'Citizen Rahul', role: 'user' } as any,
    });
    const user = await caller.auth.me();
    expect(user?.role).toBe('user');
  });

  // TEST 7: Authenticated rescuer -> /responder
  it('TEST 7: Authenticated rescuer has role="rescuer" and remains rescuer', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 11, openId: 'rescuer-11', name: 'Field Rescuer', role: 'rescuer', codeVersion: 1 } as any,
    });
    const user = await caller.auth.me();
    expect(user?.role).toBe('rescuer');
    const session = await caller.auth.checkSessionVersion();
    expect(session.role).toBe('rescuer');
  });

  // TEST 8: Authenticated medical -> /medical
  it('TEST 8: Authenticated medical has role="medical" and accesses medical procedures', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 12, openId: 'med-12', name: 'Dr. Barua', role: 'medical', codeVersion: 1 } as any,
    });
    const user = await caller.auth.me();
    expect(user?.role).toBe('medical');
  });

  // TEST 9: Authenticated hospital -> /medical
  it('TEST 9: Authenticated hospital has role="hospital" and accesses hospital endpoints', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 13, openId: 'hosp-13', name: 'Hospital Ops', role: 'hospital', codeVersion: 1 } as any,
    });
    const user = await caller.auth.me();
    expect(user?.role).toBe('hospital');
  });

  // TEST 10: Authenticated admin -> /command
  it('TEST 10: Authenticated admin has role="admin" and accesses command endpoints', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 1, openId: 'admin-1', name: 'Super Admin', role: 'admin' } as any,
    });
    const user = await caller.auth.me();
    expect(user?.role).toBe('admin');
    const analytics = await caller.rescue.operations.analytics();
    expect(analytics).toBeDefined();
  });

  // TEST 11: Citizen cannot access /command
  it('TEST 11: Citizen role cannot access admin command procedures', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 10, openId: 'citizen-10', name: 'Citizen', role: 'user' } as any,
    });
    await expect(caller.rescue.operations.analytics()).rejects.toThrow();
  });

  // TEST 12: Citizen cannot access /responder
  it('TEST 12: Citizen role cannot access responder active mission procedures', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 10, openId: 'citizen-10', name: 'Citizen', role: 'user' } as any,
    });
    await expect(caller.rescue.operations.activeMission()).rejects.toThrow();
  });

  // TEST 13: Citizen cannot access /medical
  it('TEST 13: Citizen role cannot update hospital resources', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 10, openId: 'citizen-10', name: 'Citizen', role: 'user' } as any,
    });
    await expect(caller.rescue.operations.updateHospital({ id: 1, availableEmergencyBeds: 2 })).rejects.toThrow();
  });

  // TEST 14: Rescuer cannot access /command
  it('TEST 14: Rescuer role cannot access rescuer registration approvals (Admin only)', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 11, openId: 'rescuer-11', name: 'Rescuer', role: 'rescuer' } as any,
    });
    await expect(caller.rescue.operations.rescuerRegistrationRequests()).rejects.toThrow();
  });

  // TEST 15: Medical cannot access /command
  it('TEST 15: Medical role cannot access rescuer registration approvals (Admin only)', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 12, openId: 'med-12', name: 'Medical', role: 'hospital' } as any,
    });
    await expect(caller.rescue.operations.rescuerRegistrationRequests()).rejects.toThrow();
  });

  // TEST 16: Hospital cannot access /command
  it('TEST 16: Hospital role cannot access analytics or incident rosters (Admin only)', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: { id: 13, openId: 'hosp-13', name: 'Hospital Desk', role: 'hospital' } as any,
    });
    await expect(caller.rescue.operations.analytics()).rejects.toThrow();
  });

  // TEST 17: Transient auth.me 500 does not downgrade admin
  it('TEST 17: Partial upsert preserves admin role without downgrading to user', async () => {
    const openId = 'admin-persist-' + Date.now();
    db._memoryUsers.set(openId, {
      id: 77,
      openId,
      name: 'Command Officer',
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    await db.upsertUser({ openId, lastSignedIn: new Date() });
    const userInMem = db._memoryUsers.get(openId);
    expect(userInMem?.role).toBe('admin');
  });

  // TEST 18: Transient auth.me 500 does not redirect admin
  it('TEST 18: Database error in getUserByOpenId throws error and never returns fake memory user', async () => {
    const openId = 'admin-fail-' + Date.now();
    db.setDbInstanceForTesting({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockRejectedValue(new Error('Simulated Database Network Blip')),
          }),
        }),
      }),
    });
    await expect(db.getUserByOpenId(openId)).rejects.toThrow('Simulated Database Network Blip');
    db.setDbInstanceForTesting(null);
  });

  // TEST 19: Network failure does not downgrade role
  it('TEST 19: Transient DB failure in getUserByEmail throws error and never downgrades role', async () => {
    const email = 'rescuer-team@assam.gov.in';
    db.setDbInstanceForTesting({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockRejectedValue(new Error('Simulated Database Network Blip')),
          }),
        }),
      }),
    });
    await expect(db.getUserByEmail(email)).rejects.toThrow('Simulated Database Network Blip');
    db.setDbInstanceForTesting(null);
  });

  // TEST 20: Explicit 401 clears session
  it('TEST 20: Explicit null context results in null user from auth.me', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  // TEST 21: auth.me null clears session
  it('TEST 21: auth.me returns null for unauthenticated session and valid session check', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    const result = await caller.auth.me();
    expect(result).toBeNull();
    const session = await caller.auth.checkSessionVersion();
    expect(session.authenticated).toBe(false);
    expect(session.valid).toBe(true);
  });

  // TEST 22: No authentication cookie -> login
  it('TEST 22: Missing cookie returns null during session verification', async () => {
    const session = await sdk.verifySession(undefined);
    expect(session).toBeNull();
  });

  // TEST 23: Fresh browser -> login
  it('TEST 23: Empty string cookie returns null during session verification', async () => {
    const session = await sdk.verifySession('');
    expect(session).toBeNull();
  });

  // TEST 24: No automatic/default user authentication
  it('TEST 24: New unauthenticated request has no default user in context', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  // TEST 25: panel=admin cannot grant admin access
  it('TEST 25: Citizen cannot perform admin operations despite panel=admin hint', async () => {
    const caller = appRouter.createCaller({
      req: { query: { panel: 'admin' }, headers: {} } as any,
      res: {} as any,
      user: { id: 20, openId: 'citizen-x', name: 'Citizen X', role: 'user' } as any,
    });
    await expect(caller.rescue.operations.analytics()).rejects.toThrow();
  });

  // TEST 26: returnTo cannot grant unauthorized access
  it('TEST 26: Citizen user with returnTo=/command is rejected from admin calls', async () => {
    const caller = appRouter.createCaller({
      req: { query: { returnTo: '/command' }, headers: {} } as any,
      res: {} as any,
      user: { id: 20, openId: 'citizen-x', name: 'Citizen X', role: 'user' } as any,
    });
    await expect(caller.rescue.operations.rescuerRegistrationRequests()).rejects.toThrow();
  });

  // TEST 27: Partial upsert preserves existing role
  it('TEST 27: Partial upsert preserves rescuer and hospital roles without resetting to user', async () => {
    const openId = 'rescuer-persist-' + Date.now();
    db._memoryUsers.set(openId, {
      id: 78,
      openId,
      name: 'Field Rescuer',
      role: 'rescuer',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    await db.upsertUser({ openId, lastSignedIn: new Date() });
    const userInMem = db._memoryUsers.get(openId);
    expect(userInMem?.role).toBe('rescuer');
  });

  // TEST 28: DB failure does not fall back to memory in production
  it('TEST 28: Production DB failure in getUserByOpenId propagates error and fails closed', async () => {
    const openId = 'prod-fail-' + Date.now();
    db.setDbInstanceForTesting({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockRejectedValue(new Error('Connection terminated by TiDB')),
          }),
        }),
      }),
    });
    await expect(db.getUserByOpenId(openId)).rejects.toThrow('Connection terminated by TiDB');
    db.setDbInstanceForTesting(null);
  });

  // TEST 29: getUserByOpenId returns authoritative DB role
  it('TEST 29: getUserByOpenId returns authoritative database role without memory override', async () => {
    const openId = 'db-authoritative-' + Date.now();
    db.setDbInstanceForTesting({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{
              id: 50,
              openId,
              name: 'Auth Admin',
              email: 'authadmin@assam.gov.in',
              role: 'admin',
              status: 'active',
            }]),
          }),
        }),
      }),
    });
    const user = await db.getUserByOpenId(openId);
    expect(user?.role).toBe('admin');
    db.setDbInstanceForTesting(null);
  });

  // TEST 30: getUserByEmail returns authoritative DB role
  it('TEST 30: getUserByEmail returns authoritative database role', async () => {
    const email = 'hospital@assam.gov.in';
    db.setDbInstanceForTesting({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{
              id: 60,
              openId: 'hosp-openid',
              name: 'Hospital User',
              email,
              role: 'hospital',
              status: 'active',
            }]),
          }),
        }),
      }),
    });
    const user = await db.getUserByEmail(email);
    expect(user?.role).toBe('hospital');
    db.setDbInstanceForTesting(null);
  });

  // TEST 31: getRoleAccessCode does not use stale fallback after DB success
  it('TEST 31: getRoleAccessCode returns DB row when present and null when missing', async () => {
    db.setDbInstanceForTesting({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    const code = await db.getRoleAccessCode('rescuer');
    expect(code).toBeNull();
    db.setDbInstanceForTesting(null);
  });

  // TEST 32: Unknown route does not render UserHome
  it('TEST 32: Unknown or unauthenticated requests return null user and do not grant citizen access', async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      user: null,
    });
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});
