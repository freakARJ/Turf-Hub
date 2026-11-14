import React, { useState } from 'react';
import { Lock, Mail, User, X } from 'lucide-react';
import {
  formatAuthError,
  loginWithEmail,
  registerWithEmail,
  resetUserPassword,
  signInWithGoogle,
} from '../lib/firebase';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleGoogle = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      await signInWithGoogle();
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onSuccess();
        onClose();
      } else if (mode === 'register') {
        if (!displayName.trim()) {
          setErrorMsg('Please enter your full name.');
          setBusy(false);
          return;
        }
        await registerWithEmail(displayName, email, password);
        setInfoMsg('Account created! A verification link has been sent to your email so you can verify and book slots.');
        onSuccess();
      } else {
        await resetUserPassword(email);
        setInfoMsg('Password reset link sent to your email.');
      }
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-slate-900">
              {mode === 'login'
                ? 'Sign in to Turf Hub'
                : mode === 'register'
                  ? 'Create Player Account'
                  : 'Reset Password'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Free for players on iOS, Android, and desktop web.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Close sign in dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-900 flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"/>
            <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] font-medium text-slate-400 shrink-0">
            or with email
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>

        {/* Mode Switch */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { id: 'login', label: 'Sign In' },
              { id: 'register', label: 'Register' },
              { id: 'reset', label: 'Reset' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mode === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label htmlFor="auth-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-pass"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 px-3.5 py-2.5 rounded-xl leading-relaxed">
              {errorMsg}
            </p>
          )}
          {infoMsg && (
            <p role="status" className="text-xs font-medium text-emerald-800 bg-emerald-50 px-3.5 py-2.5 rounded-xl leading-relaxed">
              {infoMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In with Email'
                : mode === 'register'
                  ? 'Create Free Account'
                  : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );
};
