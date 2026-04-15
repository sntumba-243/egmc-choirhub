import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export const Register: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    churchName: '',
    fullName: '',
    email: '',
    password: '',
    churchSize: '',
    plan: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const inputClass =
    'w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="font-bold text-2xl">
            <span className="text-slate-800">Choir</span>
            <span className="text-blue-600">OS</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Thanks!</h2>
              <p className="text-gray-600">We will be in touch shortly.</p>
              <Link to="/" className="inline-block mt-6 text-sm font-medium text-blue-600 hover:underline">
                Back to homepage
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-center text-slate-800 mb-1">
                Start your free 30-day trial
              </h1>
              <p className="text-sm text-gray-500 text-center mb-6">No credit card required</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Church name</label>
                  <input
                    type="text"
                    name="churchName"
                    value={form.churchName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Grace Community Church"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your full name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="you@church.org"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      className={inputClass}
                      style={{ paddingRight: '44px' }}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Church size</label>
                  <select
                    name="churchSize"
                    value={form.churchSize}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    <option value="">Select size</option>
                    <option value="under-20">Under 20 members</option>
                    <option value="21-50">21-50 members</option>
                    <option value="51-100">51-100 members</option>
                    <option value="100+">100+ members</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                  <select
                    name="plan"
                    value={form.plan}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    <option value="">Select plan</option>
                    <option value="starter">Starter — $19/month</option>
                    <option value="growth">Growth — $39/month</option>
                    <option value="multi-church">Multi-Church — $79/month</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="bg-slate-800 text-white w-full py-3 rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Create Free Account
                </button>
              </form>

              <p className="text-sm text-gray-500 text-center mt-5">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
