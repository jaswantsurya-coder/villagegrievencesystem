import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const GlassInputWrapper = ({ children }) => (
  <div className="rounded-2xl border border-gray-200 bg-black/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

export const SignInPage = ({
  title = <span className="font-light text-foreground tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  onSignIn,
  onGoogleSignIn,
  onSwitchMode,
  onForgotPassword,
  isSignUp = false,
  loading = false,
  submitLabel = "Sign In",
  switchPrompt = "New to our platform?",
  switchLabel = "Create Account",
  message,
  messageType = "success",
  t,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  // Helper: use t() if available, otherwise use fallback
  const tr = (key, fallback) => (t ? t(key) : fallback);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row font-sans w-full bg-white text-gray-900 overflow-y-auto">
      {/* Left column: sign-in form */}
      <section className="auth-form-panel flex-1 flex items-center justify-center px-5 py-16 sm:p-8 z-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight break-words">{title}</h1>
            <p className="animate-element animate-delay-200 text-gray-500">{description}</p>
            {message && (
              <div role="status" className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${messageType === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {message}
              </div>
            )}

            <form className="space-y-5" onSubmit={onSignIn}>
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-gray-500">{tr('email_label', 'Email Address')}</label>
                <GlassInputWrapper>
                  <input name="email" type="email" placeholder={tr('email_placeholder', 'Enter your email address')} className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-gray-900" required />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-gray-500">{tr('password_label', 'Password')}</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? 'text' : 'password'} placeholder={tr('password_placeholder', 'Enter your password')} className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-gray-900" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                      {showPassword ? <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-700 transition-colors" /> : <Eye className="w-5 h-5 text-gray-400 hover:text-gray-700 transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {!isSignUp && <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="rememberMe" className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-600" />
                  <span className="text-gray-700">{tr('keep_signed_in', 'Keep me signed in')}</span>
                </label>
                {onForgotPassword && (
                  <a href="#" onClick={(e) => { e.preventDefault(); onForgotPassword(); }} className="text-violet-600 font-medium hover:underline transition-colors">{tr('forgot_password', 'Forgot password?')}</a>
                )}
              </div>}

              <button type="submit" disabled={loading} className="animate-element animate-delay-600 w-full min-h-14 rounded-2xl bg-gray-900 px-4 py-4 font-medium text-white hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? tr('please_wait', 'Please wait...') : submitLabel}
              </button>

              <div className="animate-element animate-delay-650 flex flex-col gap-3 mt-3">
                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-gray-200 w-full"></div>
                  <span className="bg-white px-3 text-xs text-gray-400 font-medium uppercase absolute">Or</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onGoogleSignIn) {
                      onGoogleSignIn(e);
                    } else {
                      import('../../firebase').then(({ auth, googleProvider, signInWithPopup }) => {
                        if (!auth) {
                          alert('Google Sign-In is unavailable: Firebase Auth is not initialized.');
                          return;
                        }
                        signInWithPopup(auth, googleProvider).then((res) => {
                          alert(`Logged in as ${res.user.displayName || res.user.email}!`);
                          window.location.reload();
                        }).catch((err) => alert(err.message));
                      });
                    }
                  }}
                  disabled={loading}
                  className="w-full min-h-14 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 font-medium text-gray-800 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 shadow-xs cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span className="font-semibold">Sign in with Google</span>
                </button>
              </div>
            </form>

            <p className="animate-element animate-delay-700 text-center text-sm leading-6 text-gray-500 mt-2 sm:mt-4">
              {switchPrompt} <a href="#" onClick={(e) => { e.preventDefault(); onSwitchMode?.(); }} className="inline-block text-violet-600 font-medium hover:underline transition-colors">{switchLabel}</a>
            </p>
          </div>
        </div>
      </section>

      {/* Right column: hero image */}
      {heroImageSrc && (
        <section className="auth-art-panel hidden md:block flex-1 relative p-4 z-0">
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }}></div>
        </section>
      )}
    </div>
  );
};
