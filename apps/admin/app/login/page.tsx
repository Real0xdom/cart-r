'use client';
import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Shield, UserCog } from 'lucide-react';


type ProfileType = 'admin' | 'manager';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Signing in...');
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>('admin');

  const handleAction = async (formData: FormData) => {
    console.log('[handleAction] Start');
    setError('');
    setLoading(true);
    setLoadingText('Signing in...');

    try {
      console.log('[handleAction] Calling API /api/auth/login');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      });

      const result = await response.json();
      console.log('[handleAction] Result:', result);
      
      if (!response.ok || result?.error) {
        console.log('[handleAction] Error:', result?.error || 'Unknown error');
        setError(result?.error || 'Login failed');
        setLoading(false);
      } else if (result?.success) {
        console.log('[handleAction] Success, redirecting...');
        setLoadingText('Loading Dashboard... (up to 30s)');
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
        console.log('[handleAction] Redirect triggered');
      }
    } catch (err) {
      console.error('[handleAction] Exception:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const profiles: { key: ProfileType; label: string; icon: any; description: string }[] = [
    { key: 'admin', label: 'Admin', icon: Shield, description: 'Full access to all features' },
    { key: 'manager', label: 'Manager', icon: UserCog, description: 'Operations & support access' },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-orange-100/50 to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4 relative">
            <img 
              src="/cartr-logo.png" 
              alt="CARTR" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <p className="text-orange-600 font-semibold tracking-wide text-sm uppercase">Rapid, Reliable, Responsible</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-200/80 p-8 sm:p-10 relative z-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Welcome Back
          </h2>
          <p className="text-center text-gray-500 mb-6 text-sm">
            Select your profile and sign in
          </p>

          {/* Profile Selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {profiles.map((profile) => {
              const Icon = profile.icon;
              const isActive = selectedProfile === profile.key;
              return (
                <button
                  key={profile.key}
                  type="button"
                  onClick={() => setSelectedProfile(profile.key)}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all duration-200 ${
                    isActive
                      ? profile.key === 'admin'
                        ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-500/10'
                        : 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                      : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isActive
                      ? profile.key === 'admin'
                        ? 'bg-orange-500 text-white'
                        : 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                      {profile.label}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                      {profile.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${
                      profile.key === 'admin' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleAction(new FormData(e.currentTarget)); }} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={selectedProfile === 'admin' ? 'email' : 'email'}
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white focus:border-transparent transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white text-lg font-semibold py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                selectedProfile === 'admin'
                  ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30'
                  : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'
              }`}
            >
              {loading ? loadingText : `Sign In as ${selectedProfile === 'admin' ? 'Admin' : 'Manager'}`}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-8 font-medium">
          © 2025 CARTR. Secure Admin Portal.
        </p>
      </div>
    </div>
  );
}
