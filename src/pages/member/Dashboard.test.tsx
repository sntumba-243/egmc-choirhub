import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        count: vi.fn(() => ({
          then: vi.fn((cb) => cb({ data: [], count: 0, error: null })),
        })),
        eq: vi.fn(function() {
          return {
            eq: vi.fn(() => ({
              then: vi.fn((cb) => cb({ data: [], error: null })),
            })),
          };
        }),
        gte: vi.fn(function() {
          return {
            then: vi.fn((cb) => cb({ data: [], count: 0, error: null })),
          };
        }),
        then: vi.fn((cb) => cb({ data: [], count: 0, error: null })),
      })),
    })),
  },
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'test-user', name: 'Test Member' },
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

import { MemberDashboard } from './Dashboard';

describe('MemberDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    render(<MemberDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });
  });

  it('should display stats section', async () => {
    render(<MemberDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Songs')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
    });
  });

  it('should display quick access section', async () => {
    render(<MemberDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Quick Access')).toBeInTheDocument();
    });
  });
});
