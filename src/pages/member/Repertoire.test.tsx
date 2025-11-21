import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';

// Mock Supabase with proper promise resolution
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'songs') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ 
              data: [
                { id: '1', title: 'Amazing Grace', composer: 'John Newton', language: 'English', sheet_music_url: null, created_at: '2025-01-01' }
              ], 
              error: null 
            })),
          })),
        };
      }
      if (table === 'user_favorites') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
    }),
  },
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'test-user' },
      loading: false,
    }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null }),
  };
});

import { MemberRepertoire } from './Repertoire';

describe('MemberRepertoire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    render(<MemberRepertoire />);
    
    await waitFor(() => {
      expect(screen.getByText('Repertoire')).toBeInTheDocument();
    });
  });

  it('should have search functionality', async () => {
    render(<MemberRepertoire />);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search songs...');
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<MemberRepertoire />);
    expect(screen.getByText('Loading repertoire...')).toBeInTheDocument();
  });
});
