import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appRouter } from './routers';
import { _memoryIncidents } from './rescue.db';

describe('Production Failure Injection', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    _memoryIncidents.clear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('fails safely and does NOT fallback to memory when database insert throws an error in production', async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: { id: 1, openId: 'test', name: 'Test', role: 'user' } as any
    });

    // Mock the database to throw an error simulating a connection drop
    vi.mock('./db', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./db')>();
      return {
        ...actual,
        getDb: vi.fn().mockResolvedValue({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockRejectedValue(new Error('Simulated Database Connection Drop'))
          })
        })
      };
    });

    // Attempt to post an SOS
    try {
      await caller.rescue.emergency.create({
        latitude: 26.2,
        longitude: 91.7,
        locationLabel: 'Guwahati',
        emergencyType: 'flood',
        severity: 'critical',
        peopleAffected: 5
      });
      // Should not reach here
      expect.fail('Should have thrown TRPCError');
    } catch (err: any) {
      expect(err.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.message).toBe('Database operation failed in production');
    }

    // Verify it did NOT fallback to memory
    expect(_memoryIncidents.size).toBe(0);
  });
});
