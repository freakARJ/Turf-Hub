/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Calendar, LayoutGrid, Map as MapIcon, Search, ShieldCheck, Smartphone } from 'lucide-react';
import {
  auth,
  isAdminEmail,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  ensureAdminSubscription,
  ensureUserProfile,
  seedDefaultTurfsIfEmpty,
  subscribeToActiveTurfs,
  subscribeToAllBookingsAdmin,
  subscribeToAllTurfsAdmin,
  subscribeToSlotReservations,
  subscribeToUserBookings,
  toggleFavoriteTurf,
} from './lib/turfService';
import {
  DEFAULT_TURFS,
  formatBDT,
  formatSlotKey,
  getDhakaNow,
  getUpcomingDates,
  isTurfOpenOnDate,
  TURF_IMAGE_MAP,
  type AdminSubscription,
  type Booking,
  type SlotReservation,
  type Turf,
  type TurfFormat,
  type UserProfile,
} from './types/turf';
import { Header, type AppTab } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { TurfCard } from './components/TurfCard';
import { TurfMapView } from './components/TurfMapView';
import { BookingSheet } from './components/BookingSheet';
import { MyBookingsView } from './components/MyBookingsView';
import { ProfileView } from './components/ProfileView';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineBanner } from './components/OfflineBanner';

export default function App() {
  const dates = useMemo(() => getUpcomingDates(7), []);
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]?.iso || '');
  const [activeTab, setActiveTab] = useState<AppTab>('explore');
  const [exploreViewMode, setExploreViewMode] = useState<'grid' | 'map'>('grid');
  const [formatFilter, setFormatFilter] = useState<'all' | TurfFormat>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [adminSubscription, setAdminSubscription] = useState<AdminSubscription | null>(null);

  const [firestoreTurfs, setFirestoreTurfs] = useState<Turf[]>([]);
  const [turfsLoaded, setTurfsLoaded] = useState(false);
  const [reservations, setReservations] = useState<SlotReservation[]>([]);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [adminTurfs, setAdminTurfs] = useState<Turf[]>([]);

  const [bookingTurf, setBookingTurf] = useState<Turf | null>(null);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const isAdmin = useMemo(
    () => isAdminEmail(user?.email, user?.emailVerified),
    [user?.email, user?.emailVerified]
  );

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const hydrateSignedInUser = async (nextUser: User) => {
    try {
      const profile = await ensureUserProfile(nextUser);
      setUserProfile(profile);
      if (isAdminEmail(nextUser.email, nextUser.emailVerified)) {
        await seedDefaultTurfsIfEmpty();
        const sub = await ensureAdminSubscription(nextUser);
        setAdminSubscription(sub);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    testFirestoreConnection();
    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      if (nextUser) {
        await hydrateSignedInUser(nextUser);
      } else {
        setUserProfile(null);
        setAdminSubscription(null);
        setUserBookings([]);
        setAdminBookings([]);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubTurfs = subscribeToActiveTurfs(
      (items) => {
        setFirestoreTurfs(items);
        setTurfsLoaded(true);
      },
      () => {
        setTurfsLoaded(true);
      }
    );
    return () => unsubTurfs();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const unsubSlots = subscribeToSlotReservations(
      selectedDate,
      (slots) => setReservations(slots),
      (err) => console.error('Slot subscription:', err)
    );
    return () => unsubSlots();
  }, [selectedDate]);

  useEffect(() => {
    if (!user) return;
    setBookingsLoading(true);
    const unsubUserBookings = subscribeToUserBookings(
      user.uid,
      (items) => {
        setUserBookings(items);
        setBookingsLoading(false);
      },
      () => setBookingsLoading(false)
    );
    return () => unsubUserBookings();
  }, [user]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const unsubAdminBookings = subscribeToAllBookingsAdmin((items) => setAdminBookings(items));
    const unsubAdminTurfs = subscribeToAllTurfsAdmin((items) => setAdminTurfs(items));
    return () => {
      unsubAdminBookings();
      unsubAdminTurfs();
    };
  }, [user, isAdmin]);

  const displayTurfs: Turf[] = useMemo(() => {
    if (firestoreTurfs.length > 0) return firestoreTurfs;
    return DEFAULT_TURFS;
  }, [firestoreTurfs]);

  const filteredTurfs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayTurfs.filter((t) => {
      if (formatFilter !== 'all' && t.format !== formatFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.neighborhood.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q) ||
        t.surface.toLowerCase().includes(q)
      );
    });
  }, [displayTurfs, formatFilter, searchQuery]);

  const slotSet = useMemo(() => {
    const set = new Set<string>();
    reservations.forEach((r) => set.add(r.slotKey));
    return set;
  }, [reservations]);

  const countOpenSlotsForTurf = (turf: Turf): number => {
    if (!isTurfOpenOnDate(turf, selectedDate)) return 0;
    const dhaka = getDhakaNow();
    const isToday = selectedDate === dhaka.isoDate;
    let open = 0;
    for (let h = turf.openHour; h < turf.closeHour; h++) {
      if (isToday && h <= dhaka.hour) continue;
      if (!slotSet.has(formatSlotKey(turf.id, selectedDate, h))) {
        open++;
      }
    }
    return open;
  };

  const handleToggleFavorite = async (turfId: string) => {
    if (!user) {
      setAuthModalMode('login');
      return;
    }
    const current = userProfile?.favoriteTurfIds || [];
    const updated = await toggleFavoriteTurf(user.uid, turfId, current);
    setUserProfile((prev) => (prev ? { ...prev, favoriteTurfIds: updated } : prev));
  };

  const handleRefreshUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser({ ...refreshed } as User);
    if (refreshed.emailVerified) {
      await hydrateSignedInUser(refreshed);
    }
  };

  const activeUpcomingCount = userBookings.filter(
    (b) => b.status !== 'cancelled' && b.date >= (dates[0]?.iso || '')
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF9] text-slate-900 pb-20 md:pb-0">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        avatarUrl={userProfile?.photoUrl || user?.photoURL || ''}
        authLoading={authLoading}
        onSignIn={() => setAuthModalMode('login')}
        onSignOut={signOutUser}
      />

      <main className="flex-1">
        {activeTab === 'explore' && (
          <>
            {/* Hero Split Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                  <p className="text-xs font-semibold text-emerald-700 tracking-wide">
                    Bangladesh Only · Free for Players · iOS &amp; Android
                  </p>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
                    Book Floodlit Football Turfs Across Bangladesh
                  </h1>
                  <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                    Discover nearby 5v5, 7v7, and 11v11 pitches in Dhaka &amp; across Bangladesh on the live map, reserve hourly slots in BDT with bKash, Nagad, Rocket, or Card — completely free for players.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href="#turf-catalog"
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold inline-flex items-center justify-center transition-colors whitespace-nowrap"
                    >
                      Find Open Slots
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setExploreViewMode('map');
                        document.getElementById('turf-catalog')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="min-h-[48px] px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <MapIcon className="w-4 h-4 text-emerald-700" />
                      <span>Open Bangladesh Map</span>
                    </button>
                    <PWAInstallButton variant="inline" />
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      bKash · Nagad · Rocket · Card
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-700" />
                      Turf Owners: 3 Months Free Trial
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="relative h-64 sm:h-80 lg:h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-200 bg-emerald-950">
                    <img
                      src={TURF_IMAGE_MAP['arena-floodlit']}
                      alt="Bashundhara Floodlit Arena 7v7 synthetic turf pitch under evening floodlights in Dhaka"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white gap-4">
                      <div>
                        <p className="text-sm font-semibold">Bashundhara Floodlit Arena</p>
                        <p className="text-xs text-slate-200 mt-0.5">
                          7v7 FIFA Quality Pro · Bashundhara R/A, Dhaka · Open until 24:00 BST
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-sm font-bold text-emerald-300 shrink-0">
                        {formatBDT(3500)}/hr
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Full-Width Filter, Date & Map/Grid Strip */}
            <section
              id="turf-catalog"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-6"
            >
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                {/* Date Horizontal Scroller */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 pr-2 shrink-0">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    Matchday
                  </span>
                  {dates.map((d) => {
                    const active = d.iso === selectedDate;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => setSelectedDate(d.iso)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {d.dayShort} <span className="font-mono tabular-nums">{d.dayNum}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Format Tabs + View Mode + Search */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    {(['all', '5v5', '7v7', '11v11'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormatFilter(fmt)}
                        className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          formatFilter === fmt
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {fmt === 'all' ? 'All' : fmt}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setExploreViewMode('grid')}
                      className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                        exploreViewMode === 'grid'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExploreViewMode('map')}
                      className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                        exploreViewMode === 'map'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      <span>Map</span>
                    </button>
                  </div>

                  <div className="relative flex-1 sm:min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter turf or area..."
                      aria-label="Filter turf or area"
                      className="w-full min-h-[44px] pl-9 pr-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Grid or Interactive Map View */}
              {!turfsLoaded ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-80 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                  ))}
                </div>
              ) : filteredTurfs.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                  <p className="text-base font-semibold text-slate-900">No matching football turfs</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try clearing your search or switching pitch format filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormatFilter('all');
                      setSearchQuery('');
                    }}
                    className="mt-4 min-h-[44px] px-5 rounded-xl bg-slate-900 text-white text-xs font-medium cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : exploreViewMode === 'map' ? (
                <TurfMapView
                  turfs={filteredTurfs}
                  selectedDate={selectedDate}
                  countOpenSlots={countOpenSlotsForTurf}
                  onSelectTurf={(t) => setBookingTurf(t)}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {filteredTurfs.map((turf) => (
                    <TurfCard
                      key={turf.id}
                      turf={turf}
                      selectedDate={selectedDate}
                      openSlotCount={countOpenSlotsForTurf(turf)}
                      isFavorite={Boolean(userProfile?.favoriteTurfIds?.includes(turf.id))}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectTurf={(t) => setBookingTurf(t)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'bookings' && (
          <MyBookingsView
            user={user}
            bookings={userBookings}
            loading={bookingsLoading}
            onRequestSignIn={() => setAuthModalMode('login')}
            onBrowseTurfs={() => setActiveTab('explore')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            profile={userProfile}
            turfs={displayTurfs}
            bookings={userBookings}
            onProfileUpdated={(next) => setUserProfile(next)}
            onRequestAuth={(m) => setAuthModalMode(m)}
            onSelectTurf={(t) => setBookingTurf(t)}
            onOpenBookings={() => setActiveTab('bookings')}
            onRefreshUser={handleRefreshUser}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            user={user}
            isAdmin={isAdmin}
            turfs={adminTurfs.length > 0 ? adminTurfs : displayTurfs}
            bookings={adminBookings}
            reservations={reservations}
            subscription={adminSubscription}
            onSubscriptionUpdated={(sub) => setAdminSubscription(sub)}
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            onRequestSignIn={() => setAuthModalMode('login')}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/80 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800">Turf Hub Bangladesh</span>
            <span aria-hidden="true">·</span>
            <span>Free for Players · 3-Month Free Trial for BD Turf Owners</span>
          </div>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => setActiveTab('explore')} className="hover:text-slate-900 cursor-pointer">
              Venues
            </button>
            <button type="button" onClick={() => setActiveTab('bookings')} className="hover:text-slate-900 cursor-pointer">
              My Bookings
            </button>
            <button type="button" onClick={() => setActiveTab('profile')} className="hover:text-slate-900 cursor-pointer">
              Profile
            </button>
            <button type="button" onClick={() => setActiveTab('admin')} className="hover:text-slate-900 cursor-pointer">
              Admin Console
            </button>
          </div>
        </div>
      </footer>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        bookingCount={activeUpcomingCount}
      />

      <OfflineBanner />

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={() => {
            if (auth.currentUser) {
              hydrateSignedInUser(auth.currentUser);
            }
          }}
        />
      )}

      {bookingTurf && (
        <BookingSheet
          turf={bookingTurf}
          selectedDate={selectedDate}
          onChangeDate={setSelectedDate}
          reservations={reservations}
          user={user}
          defaultPhone={userProfile?.phone}
          defaultTeamName={userProfile?.defaultTeamName}
          isCatalogSeeded={firestoreTurfs.length > 0}
          onRequestSignIn={() => setAuthModalMode('login')}
          onBookingComplete={() => {}}
          onViewBookings={() => {
            setBookingTurf(null);
            setActiveTab('bookings');
          }}
          onClose={() => setBookingTurf(null)}
        />
      )}
    </div>
  );
}
