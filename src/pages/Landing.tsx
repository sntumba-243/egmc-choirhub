import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Landing() {
  const { user } = useAuth();

  if (user) {
    if (user.is_super_admin) return <Navigate to="/super-admin" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/member" replace />;
  }

  return (
    <div className="min-h-screen bg-white" style={{ scrollBehavior: 'smooth' }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <span className="font-bold text-xl">
            <span className="text-slate-800">Choir</span>
            <span className="text-blue-600">OS</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#features" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Login</Link>
            <Link to="/register" className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700 transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-4">
          Choir management reimagined
        </p>
        <h1 className="text-5xl font-bold text-slate-800 leading-tight">
          The <span className="text-blue-600">Operating System</span> for Your Choir
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mt-6">
          Everything your choir needs in one beautiful platform. Members, music, events, attendance and AI-powered vocal coaching.
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-col sm:flex-row">
          <Link to="/register" className="bg-slate-800 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-700 transition-colors">
            Start Free Trial →
          </Link>
          <a href="#features" className="border border-gray-300 text-slate-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            View Demo
          </a>
        </div>

        {/* SVG wave — 3 sine waves */}
        <div className="mt-12 flex justify-center">
          <svg width="320" height="60" viewBox="0 0 320 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 30 Q20 10, 40 30 T80 30 T120 30 T160 30 T200 30 T240 30 T280 30 T320 30" stroke="#2563eb" strokeWidth="2" strokeOpacity="0.4" fill="none" />
            <path d="M0 30 Q20 45, 40 30 T80 30 T120 30 T160 30 T200 30 T240 30 T280 30 T320 30" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.25" fill="none" />
            <path d="M0 30 Q20 18, 40 30 T80 30 T120 30 T160 30 T200 30 T240 30 T280 30 T320 30" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.15" fill="none" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">Everything your choir needs</h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">Powerful tools designed specifically for choir management.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Smart Member Management */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Smart member management</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Manage your entire choir from one dashboard. Attendance, roles, voice parts and profiles all in one place.</p>
            </div>

            {/* AI Vocal Coach */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">AI vocal coach</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Give every member a personal AI vocal coach. Practice exercises and feedback powered by Claude AI.</p>
            </div>

            {/* Multi-Church Ready */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Multi-church ready</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Run multiple church choirs from one account. Perfect for denominations and church networks.</p>
            </div>

            {/* Sheet Music Library */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Sheet music library</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Upload your own partitions or pull sheet music from the internet. Every song in one place, accessible to all members.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">Up and running in minutes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Create your choir',
                desc: 'Set up in minutes. Add your church, invite your director and start adding members.',
              },
              {
                step: '2',
                title: 'Invite your members',
                desc: 'Members get a beautiful mobile experience. RSVP to events, access repertoire and track progress.',
              },
              {
                step: '3',
                title: 'Watch your choir grow',
                desc: 'Track attendance, manage events and use AI insights to help every voice reach its potential.',
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-sm"
                  style={{ backgroundColor: '#1a2744' }}
                >
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">Simple, transparent pricing</h2>
          <p className="text-center text-gray-500 mb-12">Start free for 30 days. No credit card required.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Starter</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-800">$19</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <ul className="space-y-2 mb-6">
                {['1 church', 'Up to 30 members', 'Sheet music upload', 'Core features', 'Email support'].map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center rounded-lg px-4 py-2.5 text-sm font-medium border border-gray-300 text-slate-700 hover:bg-gray-50 transition-colors">
                Start free trial
              </Link>
            </div>

            {/* Growth */}
            <div className="bg-white border-2 border-blue-600 rounded-xl p-6 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most Popular
              </span>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Growth</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-800">$39</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <ul className="space-y-2 mb-6">
                {['1 church', 'Unlimited members', 'AI vocal coach', 'Sheet music library', 'Priority support'].map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center rounded-lg px-4 py-2.5 text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors">
                Start free trial
              </Link>
            </div>

            {/* Multi-Church */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Multi-Church</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-800">$79</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <ul className="space-y-2 mb-6">
                {['Up to 10 churches', 'Unlimited members', 'Full sheet music library', 'Dedicated support'].map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center rounded-lg px-4 py-2.5 text-sm font-medium border border-gray-300 text-slate-700 hover:bg-gray-50 transition-colors">
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-50 rounded-2xl p-10 text-center">
            <p className="text-lg italic text-gray-700 leading-relaxed">
              "ChoirOS transformed how we manage our choir. Everything is in one place and our members love the mobile app."
            </p>
            <p className="mt-4 text-sm font-medium text-gray-500">— Pastor James, Grace Community Church</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div>
              <span className="font-bold text-xl">
                <span className="text-white">Choir</span>
                <span className="text-blue-400">OS</span>
              </span>
              <p className="text-gray-400 text-sm mt-1">Harmony in Every Voice</p>
            </div>
            <div className="flex gap-6">
              <a href="#features" className="text-gray-400 text-sm hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-gray-400 text-sm hover:text-white transition-colors">Pricing</a>
              <Link to="/login" className="text-gray-400 text-sm hover:text-white transition-colors">Login</Link>
              <span className="text-gray-400 text-sm cursor-default">Privacy</span>
              <span className="text-gray-400 text-sm cursor-default">Terms</span>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-8 pt-8">
            <p className="text-gray-500 text-sm text-center">© 2026 ChoirOS by iSpeed Tech. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
