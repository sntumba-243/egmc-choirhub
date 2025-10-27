import React, { useState } from 'react';
import { Music } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
    } catch (error: any) {
      alert(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: 'admin' | 'member') => {
    if (role === 'admin') {
      setEmail('admin@choir.com');
      setPassword('admin123');
    } else {
      setEmail('member@choir.com');
      setPassword('member123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/image.png" alt="EGMC Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-blue-900 mb-2">EGMC ChoirHub</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email or Member ID
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com or memberid"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your email address or member ID (e.g., jsmith)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center mb-3">Quick Login:</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleQuickLogin('admin')}
              className="flex-1 px-4 py-2 bg-purple-100 text-purple-900 rounded-lg font-semibold hover:bg-purple-200 transition-colors text-sm"
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickLogin('member')}
              className="flex-1 px-4 py-2 bg-green-100 text-green-900 rounded-lg font-semibold hover:bg-green-200 transition-colors text-sm"
            >
              Member
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Don't have an account?{' '}
          <button
            onClick={onNavigateToRegister}
            className="text-blue-900 font-semibold hover:underline"
          >
            Register here
          </button>
        </p>
      </div>
    </div>
  );
};
