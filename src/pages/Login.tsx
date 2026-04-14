import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [churchLogo, setChurchLogo] = useState<string | null>(localStorage.getItem('login_church_logo'));
  const [churchName, setChurchName] = useState<string | null>(localStorage.getItem('login_church_name'));


  const lookupChurch = async (emailValue: string) => {
    if (!emailValue.trim()) return;
    try {
      const { data: member } = await supabase
        .from('members')
        .select('church_id, churches(name, short_name, logo_url)')
        .eq('email', emailValue.trim().toLowerCase())
        .single();
      if (member?.churches) {
        const c = member.churches as any;
        const name = c.short_name || c.name || null;
        const logo = c.logo_url || null;
        setChurchName(name);
        setChurchLogo(logo);
        if (name) localStorage.setItem('login_church_name', name);
        if (logo) localStorage.setItem('login_church_logo', logo);
      }
    } catch (err) {
      // silently fail - just show default branding
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';

      if (error?.message) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('Invalid')) {
          errorMessage = 'Invalid email/member ID or password. Please check your credentials.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email before logging in.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'No account found. Please check your email/member ID.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Connection error. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingTop: '10px',
    paddingBottom: '10px',
    fontSize: '0.85rem',
    background: 'rgba(255,255,255,0.55)',
    border: '0.5px solid rgba(26,58,110,0.08)',
    borderRadius: '10px',
    color: '#152640',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(91,155,255,0.5)';
    e.target.style.background = 'rgba(255,255,255,0.8)';
    e.target.style.boxShadow = '0 0 0 3px rgba(91,155,255,0.1)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(26,58,110,0.08)';
    e.target.style.background = 'rgba(255,255,255,0.55)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #b8cce5 0%, #9cb5d8 50%, #c5d5ea 100%)' }}
    >
      {/* Ambient blurs */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: '-25%', right: '-15%', width: '55%', height: '55%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.45), transparent 60%)',
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          bottom: '-15%', left: '-15%', width: '45%', height: '45%',
          background: 'radial-gradient(circle, rgba(26,58,110,0.06), transparent 60%)',
        }}
      />

      <div className="w-full max-w-[380px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-5">
          {churchLogo ? (
            <img
              src={churchLogo}
              alt={churchName || 'Church'}
              className="w-16 h-16 mx-auto mb-3 rounded-2xl object-cover"
              style={{ boxShadow: '0 4px 16px rgba(26,58,110,0.2)' }}
            />
          ) : (
            <div
              className="w-14 h-14 mx-auto mb-3 flex items-center justify-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #1a3a6e, #0d2247)',
                borderRadius: '14px',
                boxShadow: '0 4px 16px rgba(26,58,110,0.2)',
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  top: '-30%', right: '-30%', width: '80%', height: '80%',
                  background: 'radial-gradient(circle, rgba(91,155,255,0.2), transparent)',
                }}
              />
              <div
                className="absolute z-10"
                style={{ top: '5px', right: '7px', fontSize: '7px', color: 'rgba(200,175,100,0.65)' }}
              >
                ✟
              </div>
              <div className="flex items-end relative z-10" style={{ gap: '2.5px' }}>
                {[10, 17, 24, 17, 10].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: '3.5px',
                      height: `${h}px`,
                      borderRadius: '2px',
                      background: 'linear-gradient(to top, #5b9bff, #a8cdff)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <h1 className="font-bold tracking-tight" style={{ fontSize: '1.3rem', color: '#152640' }}>
            {churchName || (<>Choir<span style={{ color: '#1e4480' }}>Hub</span></>)}
          </h1>
          <p
            className="font-light uppercase"
            style={{ fontSize: '0.65rem', marginTop: '2px', letterSpacing: '1.5px', color: 'rgba(30,50,80,0.35)' }}
          >
            {churchName ? 'Welcome back' : 'Harmony in every voice'}
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            border: '0.5px solid rgba(255,255,255,0.65)',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: '0 2px 20px rgba(26,58,110,0.06)',
          }}
        >
          <p className="font-medium text-center" style={{ fontSize: '0.85rem', color: '#1a2e4e', marginBottom: '18px' }}>
            Sign in to your account
          </p>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 mb-3"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '0.5px solid rgba(239,68,68,0.15)',
                borderRadius: '10px',
                padding: '10px',
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
              <p style={{ fontSize: '0.75rem', color: '#b91c1c', lineHeight: 1.4 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isOffline && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">You're offline</p>
                  <p className="text-xs text-amber-600">Login requires an internet connection. Please connect and try again.</p>
                </div>
              </div>
            )}
            {/* Email */}
            <div className="mb-3">
              <label
                className="block font-medium uppercase"
                style={{ fontSize: '0.65rem', letterSpacing: '0.8px', marginBottom: '4px', color: 'rgba(30,50,80,0.5)' }}
              >
                Email or Member ID
              </label>
              <div className="relative">
                <Mail
                  className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: '11px', width: '15px', height: '15px', color: 'rgba(30,68,128,0.3)' }}
                />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@church.org or memberid"
                  required
                  style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '12px' }}
                  onFocus={handleFocus}
                  onBlur={(e) => { handleBlur(e); lookupChurch(email); }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-3">
              <label
                className="block font-medium uppercase"
                style={{ fontSize: '0.65rem', letterSpacing: '0.8px', marginBottom: '4px', color: 'rgba(30,50,80,0.5)' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: '11px', width: '15px', height: '15px', color: 'rgba(30,68,128,0.3)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '40px' }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
                  style={{ right: '11px', color: 'rgba(30,68,128,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showPassword ? (
                    <EyeOff style={{ width: '15px', height: '15px' }} />
                  ) : (
                    <Eye style={{ width: '15px', height: '15px' }} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center cursor-pointer" style={{ gap: '6px', fontSize: '0.72rem', color: '#5a6e88' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: '14px', height: '14px', accentColor: '#2a5298', borderRadius: '4px' }}
                />
                Remember me
              </label>
              <button
                type="button"
                className="font-medium hover:opacity-70 transition-opacity"
                style={{ fontSize: '0.72rem', color: '#1e4480', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Forgot?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isOffline}
              className="w-full text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
              style={{
                padding: '12px',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1a3a6e, #25508e)',
                borderRadius: '10px',
                boxShadow: '0 2px 12px rgba(26,58,110,0.2)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(26,58,110,0.35)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,58,110,0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-[14px]" style={{ gap: '10px' }}>
            <div className="flex-1" style={{ height: '0.5px', background: 'rgba(26,58,110,0.06)' }} />
            <span className="uppercase" style={{ fontSize: '0.6rem', letterSpacing: '2px', color: '#98a8be' }}>or</span>
            <div className="flex-1" style={{ height: '0.5px', background: 'rgba(26,58,110,0.06)' }} />
          </div>

          {/* Register */}
          <p className="text-center" style={{ fontSize: '0.78rem', color: '#5a6e88' }}>
            Don't have an account?{' '}
            <button
              onClick={onNavigateToRegister}
              className="font-semibold hover:opacity-80 transition-opacity"
              style={{ color: '#1e4480', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Register
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
