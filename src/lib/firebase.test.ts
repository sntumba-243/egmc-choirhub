import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: vi.fn(async () => 'test-token'),
  onMessage: vi.fn(),
}));

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export requestNotificationPermission', async () => {
    const { requestNotificationPermission } = await import('./firebase');
    expect(typeof requestNotificationPermission).toBe('function');
  });

  it('should export setupMessageListener', async () => {
    const { setupMessageListener } = await import('./firebase');
    expect(typeof setupMessageListener).toBe('function');
  });

  it('should export messaging', async () => {
    const { messaging } = await import('./firebase');
    expect(messaging).toBeDefined();
  });
});
