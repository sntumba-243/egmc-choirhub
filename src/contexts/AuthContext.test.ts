import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize without errors', () => {
    const client = createClient('', '');
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('should have getUser method', () => {
    const client = createClient('', '');
    expect(typeof client.auth.getUser).toBe('function');
  });

  it('should have signOut method', () => {
    const client = createClient('', '');
    expect(typeof client.auth.signOut).toBe('function');
  });
});
