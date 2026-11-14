import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Camera,
  CheckCircle2,
  Heart,
  KeyRound,
  MailCheck,
  RefreshCw,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import {
  changeUserPassword,
  formatAuthError,
  resendVerificationEmail,
  resetUserPassword,
} from '../lib/firebase';
import { toggleFavoriteTurf, updateUserProfileDetails } from '../lib/turfService';
import {
  formatBDT,
  formatHourRange,
  TURF_IMAGE_MAP,
  type Booking,
  type Turf,
  type UserProfile,
} from '../types/turf';

interface ProfileViewProps {
  user: User | null;
  profile: UserProfile | null;
  turfs: Turf[];
  bookings: Booking[];
  onProfileUpdated: (next: UserProfile) => void;
  onRequestAuth: (mode: 'login' | 'register') => void;
  onSelectTurf: (turf: Turf) => void;
  onOpenBookings: () => void;
  onRefreshUser: () => Promise<void>;
}

async function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  profile,
  turfs,
  bookings,
  onProfileUpdated,
  onRequestAuth,
  onSelectTurf,
  onOpenBookings,
  onRefreshUser,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || user?.photoURL || '');
  const [preferredPosition, setPreferredPosition] = useState(profile?.preferredPosition || 'Midfielder');
  const [defaultTeamName, setDefaultTeamName] = useState(profile?.defaultTeamName || '');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // Password management state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const [verifyMsg, setVerifyMsg] = useState('');

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || '');
    setPhone(profile?.phone || '');
    setPhotoUrl(profile?.photoUrl || user?.photoURL || '');
    setPreferredPosition(profile?.preferredPosition || 'Midfielder');
    setDefaultTeamName(profile?.defaultTeamName || '');
  }, [profile, user]);

  if (!user) {
    return (
      <section className="max-w-xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
          <UserCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Player Profile &amp; Saved Turfs</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Register or sign in for free to manage your personal details, upload a profile photo, save favorite football pitches, and review past bookings.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onRequestAuth('login')}
            className="min-h-[44px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onRequestAuth('register')}
            className="min-h-[44px] px-6 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold cursor-pointer"
          >
            Register Free Account
          </button>
        </div>
      </section>
    );
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  const favoriteTurfs = turfs.filter((t) => profile?.favoriteTurfIds?.includes(t.id));

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileErr('');
    try {
      const compressed = await compressAvatarFile(file);
      setPhotoUrl(compressed);
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Failed to process image.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErr('');
    setProfileMsg('');
    if (!user.emailVerified) {
      setProfileErr('Verify your email address first before saving profile changes.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateUserProfileDetails(user, {
        displayName,
        phone,
        photoUrl,
        preferredPosition,
        defaultTeamName,
      });
      onProfileUpdated(updated);
      setProfileMsg('Profile saved.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr('');
    setPwMsg('');
    if (newPw.length < 6) {
      setPwErr('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await changeUserPassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg('Password updated successfully.');
    } catch (err) {
      setPwErr(formatAuthError(err));
    } finally {
      setPwBusy(false);
    }
  };

  const handleSendReset = async () => {
    if (!user.email) return;
    setPwErr('');
    setPwMsg('');
    setPwBusy(true);
    try {
      await resetUserPassword(user.email);
      setPwMsg(`Password reset email sent to ${user.email}.`);
    } catch (err) {
      setPwErr(formatAuthError(err));
    } finally {
      setPwBusy(false);
    }
  };

  const handleRemoveFavorite = async (turfId: string) => {
    if (!profile) return;
    const nextIds = await toggleFavoriteTurf(user.uid, turfId, profile.favoriteTurfIds);
    onProfileUpdated({ ...profile, favoriteTurfIds: nextIds });
  };

  return (
    <section className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Player Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Personal information, avatar, password settings, favorites, and match history.
          </p>
        </div>
        <span className="text-xs font-medium text-emerald-700">
          Free Player Account · ৳0 Subscription
        </span>
      </div>

      {!user.emailVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <MailCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Verify your email address ({user.email})</p>
              <p className="mt-0.5">
                Check your inbox and click the verification link before booking turfs or saving profile updates.
              </p>
              {verifyMsg && <p className="mt-1 font-medium text-emerald-800">{verifyMsg}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail();
                setVerifyMsg('Verification email resent.');
              }}
              className="min-h-[38px] px-3 rounded-xl bg-white border border-amber-300 text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
            >
              Resend Link
            </button>
            <button
              type="button"
              onClick={async () => {
                await onRefreshUser();
                setVerifyMsg('Status refreshed.');
              }}
              className="min-h-[38px] px-3 rounded-xl bg-amber-700 text-white text-xs font-medium hover:bg-amber-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>I Verified</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Personal Info + Avatar */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName || 'Player avatar'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle2 className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Profile Picture</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Upload Photo</span>
                </button>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="min-h-[38px] px-3 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label htmlFor="prof-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="prof-email"
                type="email"
                disabled
                value={user.email || ''}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Bangladesh Mobile Phone
              </label>
              <input
                id="prof-phone"
                type="tel"
                maxLength={24}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1711-000000"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label htmlFor="prof-pos" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Preferred Position
              </label>
              <select
                id="prof-pos"
                value={preferredPosition}
                onChange={(e) => setPreferredPosition(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-emerald-600"
              >
                <option value="Goalkeeper">Goalkeeper</option>
                <option value="Defender">Defender</option>
                <option value="Midfielder">Midfielder</option>
                <option value="Forward">Forward</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="prof-team" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Default Team Name
              </label>
              <input
                id="prof-team"
                type="text"
                maxLength={60}
                value={defaultTeamName}
                onChange={(e) => setDefaultTeamName(e.target.value)}
                placeholder="e.g. Midtown Rovers 7s"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {profileErr && <p className="text-xs font-medium text-rose-600">{profileErr}</p>}
          {profileMsg && (
            <p className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{profileMsg}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="min-h-[44px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            {savingProfile ? 'Saving Profile...' : 'Save Personal Info'}
          </button>
        </form>

        {/* Right: Password Management */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-semibold text-slate-900">Password &amp; Security</h2>
          </div>

          {hasPasswordProvider ? (
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label htmlFor="cur-pw" className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  id="cur-pw"
                  type="password"
                  required
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-pw" className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  id="new-pw"
                  type="password"
                  required
                  minLength={6}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label htmlFor="conf-pw" className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="conf-pw"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              {pwErr && <p className="text-xs font-medium text-rose-600">{pwErr}</p>}
              {pwMsg && <p className="text-xs font-medium text-emerald-700">{pwMsg}</p>}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={pwBusy}
                  className="min-h-[42px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {pwBusy ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={pwBusy}
                  className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Send Reset Email
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                You are signed in with <strong>Google Single Sign-On</strong> ({user.email}). Your account password and 2-step verification are protected by Google Security.
              </p>
              <button
                type="button"
                onClick={handleSendReset}
                disabled={pwBusy}
                className="min-h-[40px] px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
              >
                Send Email Sign-In Link / Reset
              </button>
              {pwMsg && <p className="text-emerald-700 font-medium">{pwMsg}</p>}
              {pwErr && <p className="text-rose-600 font-medium">{pwErr}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Favorite Turfs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <h2 className="text-base font-semibold text-slate-900">Saved Favorite Turfs</h2>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">
            {favoriteTurfs.length} saved
          </span>
        </div>

        {favoriteTurfs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Tap the heart icon on any turf card in Explore to bookmark your go-to pitches here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {favoriteTurfs.map((t) => (
              <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={TURF_IMAGE_MAP[t.imageKey] || ''}
                    alt={t.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {t.format} · {t.neighborhood} · {formatBDT(t.pricePerHour)}/hr
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectTurf(t)}
                    className="min-h-[36px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer"
                  >
                    Book
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveFavorite(t.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 cursor-pointer"
                    aria-label={`Remove ${t.name} from favorites`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past & Recent Bookings Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent &amp; Past Bookings</h2>
          <button
            type="button"
            onClick={onOpenBookings}
            className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
          >
            View All Gate Passes
          </button>
        </div>

        {bookings.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings recorded on your account yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {bookings.slice(0, 5).map((b) => (
              <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{b.turfName}</p>
                  <p className="font-mono tabular-nums text-slate-500 mt-0.5">
                    {b.date} · {formatHourRange(b.startHour, b.durationHours)} · {b.bookingCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono tabular-nums font-semibold text-slate-900">{formatBDT(b.totalAmount)}</p>
                  <p className={b.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-700'}>
                    {b.status === 'confirmed' ? 'Confirmed' : b.status === 'checked_in' ? 'Checked In' : 'Cancelled'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
