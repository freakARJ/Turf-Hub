import React from 'react';
import type { User } from 'firebase/auth';
import { LogOut, UserCheck } from 'lucide-react';

export type AppTab = 'explore' | 'bookings' | 'profile' | 'admin';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  user: User | null;
  avatarUrl?: string;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  user,
  avatarUrl,
  authLoading,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-emerald-600 rounded"
        >
          <svg
            className="w-6 h-6 shrink-0"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <rect width="32" height="32" rx="7" fill="#064E3B" />
            <rect x="4" y="6" width="24" height="20" rx="2" stroke="#34D399" strokeWidth="1.75" />
            <line x1="16" y1="6" x2="16" y2="26" stroke="#34D399" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="3.75" stroke="#FFFFFF" strokeWidth="1.75" />
          </svg>
          <span>Turf Hub</span>
        </button>

        {/* Zone 2: Concise Single-line Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium" aria-label="Primary">
          <button
            type="button"
            onClick={() => onSelectTab('explore')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'explore'
                ? 'border-emerald-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Explore Turfs
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('bookings')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'bookings'
                ? 'border-emerald-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            My Bookings
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('admin')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'admin'
                ? 'border-emerald-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Dashboard
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {authLoading ? (
            <div className="h-9 w-24 rounded-lg bg-slate-100 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectTab('profile')}
                className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 max-w-[160px] truncate cursor-pointer"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span className="truncate">{user.displayName?.split(' ')[0] || 'Profile'}</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
