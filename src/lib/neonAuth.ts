export interface NeonUser {
  id: string;
  email: string;
  name: string;
  role: string;
  voice_part: string | null;
  church_id: string;
  is_super_admin: boolean;
}

interface Session {
  user: NeonUser;
  expiresAt: number;
}

const SESSION_KEY = 'neon_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000;
const API_URL = 'http://localhost:3001/api';

export const neonAuth = {
  async login(email: string, password: string): Promise<{ user: NeonUser | null; error: string | null }> {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { user: null, error: data.error || 'Login failed' };
      }

      const user = data.user as NeonUser;

      const session: Session = {
        user,
        expiresAt: Date.now() + SESSION_DURATION
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));

      return { user, error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      return { user: null, error: error.message };
    }
  },

  getSession(): { user: NeonUser | null } {
    try {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (!sessionStr) {
        return { user: null };
      }

      const session: Session = JSON.parse(sessionStr);

      if (Date.now() > session.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return { user: null };
      }

      return { user: session.user };
    } catch (error) {
      console.error('Session error:', error);
      return { user: null };
    }
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  isAuthenticated(): boolean {
    const { user } = this.getSession();
    return user !== null;
  }
};
