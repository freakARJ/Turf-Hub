import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CreditCard,
  Download,
  Edit3,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  BANGLADESH_BOUNDS,
  formatBDT,
  formatHourRange,
  formatSlotKey,
  getDhakaNow,
  getUpcomingDates,
  isWithinBangladesh,
  OWNER_PRO_MONTHLY_BDT,
  WEEKDAY_LABELS,
  type AdminSubscription,
  type Booking,
  type BookingStatus,
  type SlotReservation,
  type Turf,
  type TurfFormat,
} from '../types/turf';
import {
  adminDeleteTurf,
  adminSaveTurf,
  adminToggleMaintenanceSlot,
  adminUpdateBookingStatus,
  seedDefaultTurfsIfEmpty,
  updateAdminSubscription,
} from '../lib/turfService';

interface AdminDashboardProps {
  user: User | null;
  isAdmin: boolean;
  turfs: Turf[];
  bookings: Booking[];
  reservations: SlotReservation[];
  subscription: AdminSubscription | null;
  onSubscriptionUpdated: (sub: AdminSubscription) => void;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onRequestSignIn: () => void;
}

type AdminSection = 'bookings' | 'reports' | 'turfs' | 'schedule' | 'billing';
type BookingTimeScope = 'all' | 'current' | 'upcoming' | 'past' | 'cancelled';
type ReportGranularity = 'daily' | 'weekly' | 'monthly';

interface TurfFormState {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  lat: string;
  lng: string;
  format: TurfFormat;
  capacity: string;
  surface: string;
  pricePerHour: string;
  openHour: string;
  closeHour: string;
  openDays: number[];
  amenitiesText: string;
  imageKey: string;
  isActive: boolean;
}

const EMPTY_TURF_FORM: TurfFormState = {
  id: '',
  name: '',
  neighborhood: '',
  address: '',
  lat: String(BANGLADESH_BOUNDS.dhakaCenter.lat),
  lng: String(BANGLADESH_BOUNDS.dhakaCenter.lng),
  format: '7v7',
  capacity: '14',
  surface: 'FIFA Quality Pro 50mm',
  pricePerHour: '3500',
  openHour: '6',
  closeHour: '24',
  openDays: [0, 1, 2, 3, 4, 5, 6],
  amenitiesText: 'LED Floodlights, Changing Rooms, Free Parking',
  imageKey: 'arena-floodlit',
  isActive: true,
};

function toJsDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  return null;
}

function getIsoWeekStart(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  isAdmin,
  turfs,
  bookings,
  reservations,
  subscription,
  onSubscriptionUpdated,
  selectedDate,
  onChangeDate,
  onRequestSignIn,
}) => {
  const [section, setSection] = useState<AdminSection>('bookings');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingScope, setBookingScope] = useState<BookingTimeScope>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Revenue report state
  const [reportPeriod, setReportPeriod] = useState<ReportGranularity>('daily');

  // Schedule tab state
  const dates = useMemo(() => getUpcomingDates(7), []);
  const [scheduleTurfId, setScheduleTurfId] = useState<string>(turfs[0]?.id || 'northside-arena');

  // Turf CRUD form state
  const [editingMode, setEditingMode] = useState<'none' | 'create' | 'edit'>('none');
  const [turfForm, setTurfForm] = useState<TurfFormState>(EMPTY_TURF_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Billing card state
  const [billingCardInput, setBillingCardInput] = useState('4242');
  const [autoRenewInput, setAutoRenewInput] = useState(subscription?.autoRenew ?? true);

  const todayIso = getDhakaNow().isoDate;

  const metrics = useMemo(() => {
    const paidBookings = bookings.filter((b) => b.paymentStatus === 'paid' && b.status !== 'cancelled');
    const netRevenue = paidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const refundedTotal = bookings
      .filter((b) => b.paymentStatus === 'refunded' || b.status === 'cancelled')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;
    const upcomingCount = paidBookings.filter((b) => b.date >= todayIso).length;
    const dailyCapacity = Math.max(
      1,
      turfs.filter((t) => t.isActive).reduce((sum, t) => sum + (t.closeHour - t.openHour), 0)
    );
    const todayBookedHours = paidBookings
      .filter((b) => b.date === selectedDate)
      .reduce((sum, b) => sum + b.durationHours, 0);
    const occupancyPct = Math.min(100, Math.round((todayBookedHours / dailyCapacity) * 100));

    return {
      netRevenue,
      activeCount: paidBookings.length,
      upcomingCount,
      occupancyPct,
      refundedTotal,
      cancelledCount,
    };
  }, [bookings, turfs, selectedDate, todayIso]);

  const filteredBookings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookings.filter((b) => {
      if (bookingScope === 'current' && (b.date !== todayIso || b.status === 'cancelled')) return false;
      if (bookingScope === 'upcoming' && (b.date <= todayIso || b.status === 'cancelled')) return false;
      if (bookingScope === 'past' && (b.date >= todayIso || b.status === 'cancelled')) return false;
      if (bookingScope === 'cancelled' && b.status !== 'cancelled') return false;
      if (!q) return true;
      return (
        b.bookingCode.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerEmail.toLowerCase().includes(q) ||
        b.teamName.toLowerCase().includes(q) ||
        b.turfName.toLowerCase().includes(q)
      );
    });
  }, [bookings, searchTerm, bookingScope, todayIso]);

  const reportRows = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; sortKey: string; count: number; gross: number; fees: number; refunds: number; net: number }
    >();

    if (reportPeriod === 'daily') {
      for (const d of dates) {
        groups.set(d.iso, {
          label: `${d.dayShort} (${d.iso})`,
          sortKey: d.iso,
          count: 0,
          gross: 0,
          fees: 0,
          refunds: 0,
          net: 0,
        });
      }
    }

    for (const b of bookings) {
      let key = b.date;
      let label = b.date;
      if (reportPeriod === 'weekly') {
        key = getIsoWeekStart(b.date);
        label = `Week of ${key}`;
      } else if (reportPeriod === 'monthly') {
        key = b.date.slice(0, 7);
        const [y, m] = key.split('-').map(Number);
        const dt = new Date(y, (m || 1) - 1, 1);
        label = dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        const matchDate = dates.find((d) => d.iso === b.date);
        label = matchDate ? `${matchDate.dayShort} (${b.date})` : b.date;
      }

      const row = groups.get(key) || {
        label,
        sortKey: key,
        count: 0,
        gross: 0,
        fees: 0,
        refunds: 0,
        net: 0,
      };
      if (b.status === 'cancelled' || b.paymentStatus === 'refunded') {
        row.refunds += b.totalAmount;
      } else {
        row.count += 1;
        row.gross += b.basePrice - b.discountAmount;
        row.fees += b.serviceFee;
        row.net += b.totalAmount;
      }
      groups.set(key, row);
    }

    return Array.from(groups.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [bookings, reportPeriod, dates]);

  const maxReportNet = Math.max(100, ...reportRows.map((r) => r.net));

  const trialDetails = useMemo(() => {
    const start = toJsDate(subscription?.trialStartAt) || new Date();
    const end =
      toJsDate(subscription?.trialEndsAt) ||
      new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
    const msLeft = Math.max(0, end.getTime() - Date.now());
    const daysRemaining = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    return {
      startLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      endLabel: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      daysRemaining,
    };
  }, [subscription]);

  if (!user || !isAdmin) {
    return (
      <section className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Turf Owner Admin Console</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Sign in with the venue administrator account to manage turf venues, availability schedules, bookings, and daily/weekly/monthly revenue reports. Owners get 3 months free, and Turf Hub is always free for players.
        </p>
        {user ? (
          <p className="mt-3 font-mono text-xs text-slate-500">
            Signed in as {user.email} (player account)
          </p>
        ) : null}
        <button
          type="button"
          onClick={onRequestSignIn}
          className="mt-6 min-h-[44px] px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          {user ? 'Switch to Owner Account' : 'Sign In as Owner / Admin'}
        </button>
      </section>
    );
  }

  const handleBookingStatus = async (booking: Booking, nextStatus: BookingStatus) => {
    setErrorMsg('');
    setBusyId(booking.id);
    try {
      const nextPayment = nextStatus === 'cancelled' ? 'refunded' : 'paid';
      await adminUpdateBookingStatus(booking, nextStatus, nextPayment);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update booking.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleBlock = async (turfId: string, hour: number, currentlyBlocked: boolean) => {
    setErrorMsg('');
    const key = formatSlotKey(turfId, selectedDate, hour);
    setBusyId(key);
    try {
      await adminToggleMaintenanceSlot(turfId, selectedDate, hour, user.uid, !currentlyBlocked);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update slot block.');
    } finally {
      setBusyId(null);
    }
  };

  const openCreateTurf = () => {
    setTurfForm(EMPTY_TURF_FORM);
    setEditingMode('create');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const openEditTurf = (turf: Turf) => {
    setTurfForm({
      id: turf.id,
      name: turf.name,
      neighborhood: turf.neighborhood,
      address: turf.address,
      lat: String(turf.lat),
      lng: String(turf.lng),
      format: turf.format,
      capacity: String(turf.capacity),
      surface: turf.surface,
      pricePerHour: String(turf.pricePerHour),
      openHour: String(turf.openHour),
      closeHour: String(turf.closeHour),
      openDays: turf.openDays || [0, 1, 2, 3, 4, 5, 6],
      amenitiesText: turf.amenities.join(', '),
      imageKey: turf.imageKey,
      isActive: turf.isActive,
    });
    setEditingMode('edit');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const toggleFormDay = (dayIdx: number) => {
    setTurfForm((prev) => {
      const exists = prev.openDays.includes(dayIdx);
      const next = exists ? prev.openDays.filter((d) => d !== dayIdx) : [...prev.openDays, dayIdx].sort();
      return { ...prev, openDays: next.length > 0 ? next : [dayIdx] };
    });
  };

  const handleSaveTurf = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const price = Number(turfForm.pricePerHour);
    const capacity = Number(turfForm.capacity);
    const openHour = Number(turfForm.openHour);
    const closeHour = Number(turfForm.closeHour);
    const lat = Number(turfForm.lat);
    const lng = Number(turfForm.lng);

    if (!turfForm.name.trim() || !turfForm.address.trim() || Number.isNaN(price) || price < 100 || price > 50000) {
      setErrorMsg('Provide valid turf name, Bangladesh address, and hourly rate (৳100 – ৳50,000).');
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng) || !isWithinBangladesh(lat, lng)) {
      setErrorMsg('Coordinates must be inside Bangladesh (Latitude 20.0–27.0, Longitude 88.0–93.0).');
      return;
    }
    if (closeHour <= openHour) {
      setErrorMsg('Closing hour must be after opening hour.');
      return;
    }

    const isNew = editingMode === 'create';
    const slug = turfForm.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48);
    const id = isNew ? `${slug || 'turf'}-${Date.now().toString().slice(-4)}` : turfForm.id;
    const amenities = turfForm.amenitiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setBusyId('save-turf');
    try {
      await adminSaveTurf(
        {
          id,
          name: turfForm.name.trim(),
          neighborhood: turfForm.neighborhood.trim() || 'Sports District',
          address: turfForm.address.trim(),
          lat,
          lng,
          format: turfForm.format,
          capacity: Number.isNaN(capacity) ? 14 : capacity,
          surface: turfForm.surface.trim() || 'FIFA Quality Pro 50mm',
          pricePerHour: price,
          openHour,
          closeHour,
          openDays: turfForm.openDays,
          amenities: amenities.length > 0 ? amenities : ['LED Floodlights'],
          imageKey: turfForm.imageKey,
          rating: 4.9,
          isActive: turfForm.isActive,
        },
        isNew
      );
      setEditingMode('none');
      setSuccessMsg(isNew ? 'Turf venue published.' : 'Turf venue updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save turf.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTurf = async (turfId: string) => {
    setErrorMsg('');
    setBusyId(turfId);
    try {
      await adminDeleteTurf(turfId);
      setConfirmDeleteId(null);
      setSuccessMsg('Turf venue deleted.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete turf.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const last4 = billingCardInput.replace(/\D/g, '').slice(-4);
    if (last4.length < 4) {
      setErrorMsg('Enter the last 4 digits of your billing card.');
      return;
    }
    setBusyId('billing');
    try {
      const updated = await updateAdminSubscription(user.uid, {
        status: subscription?.status || 'trial_active',
        billingLast4: last4,
        autoRenew: autoRenewInput,
      });
      onSubscriptionUpdated(updated);
      setSuccessMsg('Owner subscription billing details saved. No charge will occur until your 3-month free trial ends.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update billing settings.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportReportCsv = () => {
    const headers = ['Period', 'Bookings', 'Pitch Revenue', 'Platform Fees', 'Refunds', 'Net Revenue'];
    const rows = reportRows.map((r) => [
      `"${r.label}"`,
      r.count,
      r.gross.toFixed(2),
      r.fees.toFixed(2),
      r.refunds.toFixed(2),
      r.net.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turf-hub-${reportPeriod}-revenue-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeScheduleTurf = turfs.find((t) => t.id === scheduleTurfId) || turfs[0];
  const slotMap = new Map<string, SlotReservation>();
  reservations.forEach((r) => slotMap.set(r.slotKey, r));

  return (
    <section className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-700">
            Admin Console · 3-Month Free Owner Trial ({trialDetails.daysRemaining} days left)
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            Turf Management &amp; Revenue Operations
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {turfs.length === 0 && (
            <button
              type="button"
              onClick={() => seedDefaultTurfsIfEmpty()}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 cursor-pointer"
            >
              Initialize Venue Catalog
            </button>
          )}
          <button
            type="button"
            onClick={() => setSection('billing')}
            className="min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
            <span>Trial &amp; Plan</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <p role="alert" className="text-xs font-medium text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p role="status" className="text-xs font-medium text-emerald-800 bg-emerald-50 px-4 py-3 rounded-xl">
          {successMsg}
        </p>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Net Collected Revenue</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1.5">
            {formatBDT(metrics.netRevenue)}
          </p>
          <p className="text-xs text-emerald-700 mt-1">{metrics.activeCount} settled bookings</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Current &amp; Upcoming</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1.5">
            {metrics.upcomingCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Confirmed from today forward</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Occupancy ({selectedDate})</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1.5">
            {metrics.occupancyPct}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Across {turfs.filter((t) => t.isActive).length} active turfs</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Refunds &amp; Cancellations</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1.5">
            {formatBDT(metrics.refundedTotal)}
          </p>
          <p className="font-mono tabular-nums text-xs text-slate-500 mt-1">
            {metrics.cancelledCount} cancelled
          </p>
        </div>
      </div>

      {/* Workspace Section Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {(
          [
            { id: 'bookings', label: 'Bookings' },
            { id: 'reports', label: 'Revenue Reports' },
            { id: 'turfs', label: 'Turf Management' },
            { id: 'schedule', label: 'Slot Blocks' },
            { id: 'billing', label: 'Trial & Subscription' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Bookings Tab (Current, Upcoming, Past, Cancelled) */}
      {section === 'bookings' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search code, player, team, turf..."
                aria-label="Search bookings"
                className="w-full min-h-[40px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'current', label: 'Today' },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'past', label: 'Past' },
                  { id: 'cancelled', label: 'Cancelled' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setBookingScope(st.id)}
                  className={`min-h-[32px] px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    bookingScope === st.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Player &amp; Team</th>
                  <th className="py-3 px-4">Turf</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No bookings match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {b.bookingCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{b.customerName}</div>
                        <div className="text-[11px] text-slate-500">{b.teamName} · {b.customerPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{b.turfName}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {b.date} · {formatHourRange(b.startHour, b.durationHours)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatBDT(b.totalAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            b.status === 'confirmed'
                              ? 'text-emerald-700'
                              : b.status === 'checked_in'
                                ? 'text-slate-900'
                                : 'text-rose-600'
                          }`}
                        >
                          {b.status === 'confirmed'
                            ? 'Confirmed'
                            : b.status === 'checked_in'
                              ? 'Checked In'
                              : 'Refunded'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() => handleBookingStatus(b, 'checked_in')}
                              className="min-h-[32px] px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>Check In</span>
                            </button>
                          )}
                          {b.status !== 'cancelled' && (
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() => handleBookingStatus(b, 'cancelled')}
                              className="min-h-[32px] px-2.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-[11px] font-medium cursor-pointer disabled:opacity-50"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Daily, Weekly, Monthly Revenue Reports Tab */}
      {section === 'reports' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Revenue Report Generator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Analyze pitch revenue, online fees, and refunds by day, week, or month.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReportPeriod(p)}
                      className={`min-h-[34px] px-3.5 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer ${
                        reportPeriod === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportReportCsv}
                  className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export {reportPeriod} CSV</span>
                </button>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 items-end h-44 pt-4 border-t border-slate-100">
              {reportRows.slice(0, 7).reverse().map((row) => {
                const heightPct = Math.max(8, Math.round((row.net / maxReportNet) * 100));
                return (
                  <div key={row.sortKey} className="flex flex-col items-center justify-end h-full">
                    <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-700 mb-1">
                      {formatBDT(row.net)}
                    </span>
                    <div className="w-full max-w-[44px] flex-1 flex items-end">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full rounded-t-lg bg-emerald-700"
                      />
                    </div>
                    <span className="text-[10px] text-slate-600 mt-2 text-center truncate w-full">
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Confirmed Bookings</th>
                    <th className="py-3 px-4 text-right">Pitch Revenue</th>
                    <th className="py-3 px-4 text-right">Booking Fees</th>
                    <th className="py-3 px-4 text-right">Refunds</th>
                    <th className="py-3 px-4 text-right">Net Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {reportRows.map((row) => (
                    <tr key={row.sortKey} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{row.label}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-700">{row.count}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-700">{formatBDT(row.gross)}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-700">{formatBDT(row.fees)}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-rose-600">{formatBDT(row.refunds)}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right font-bold text-slate-900">{formatBDT(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Comprehensive Turf Management (Add / Edit / Delete + Schedule) */}
      {section === 'turfs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Turf Venues &amp; Availability Schedules</h2>
              <p className="text-xs text-slate-500">Add, edit, or delete turfs, capacity, GPS coordinates, pricing, and operating days.</p>
            </div>
            <button
              type="button"
              onClick={openCreateTurf}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Turf</span>
            </button>
          </div>

          {editingMode !== 'none' && (
            <form onSubmit={handleSaveTurf} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {editingMode === 'create' ? 'Add New Turf Venue' : `Edit ${turfForm.name}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingMode('none')}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Turf Name</label>
                  <input
                    type="text"
                    required
                    value={turfForm.name}
                    onChange={(e) => setTurfForm({ ...turfForm, name: e.target.value })}
                    placeholder="Banani Floodlit 7s"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Area / City (Bangladesh)</label>
                  <input
                    type="text"
                    required
                    value={turfForm.neighborhood}
                    onChange={(e) => setTurfForm({ ...turfForm, neighborhood: e.target.value })}
                    placeholder="Banani, Dhaka"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bangladesh Street Address</label>
                  <input
                    type="text"
                    required
                    value={turfForm.address}
                    onChange={(e) => setTurfForm({ ...turfForm, address: e.target.value })}
                    placeholder="Road 11, Block F, Banani, Dhaka 1213"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lat (BD 20–27)</label>
                    <input
                      type="number"
                      step="any"
                      min={20}
                      max={27}
                      required
                      value={turfForm.lat}
                      onChange={(e) => setTurfForm({ ...turfForm, lat: e.target.value })}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lng (BD 88–93)</label>
                    <input
                      type="number"
                      step="any"
                      min={88}
                      max={93}
                      required
                      value={turfForm.lng}
                      onChange={(e) => setTurfForm({ ...turfForm, lng: e.target.value })}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Format</label>
                    <select
                      value={turfForm.format}
                      onChange={(e) => setTurfForm({ ...turfForm, format: e.target.value as TurfFormat })}
                      className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                    >
                      <option value="5v5">5v5</option>
                      <option value="7v7">7v7</option>
                      <option value="11v11">11v11</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Capacity</label>
                    <input
                      type="number"
                      min={2}
                      max={40}
                      required
                      value={turfForm.capacity}
                      onChange={(e) => setTurfForm({ ...turfForm, capacity: e.target.value })}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">৳/Hour (BDT)</label>
                    <input
                      type="number"
                      min={100}
                      max={50000}
                      required
                      value={turfForm.pricePerHour}
                      onChange={(e) => setTurfForm({ ...turfForm, pricePerHour: e.target.value })}
                      className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Open Hr</label>
                    <input
                      type="number"
                      min={0}
                      max={22}
                      required
                      value={turfForm.openHour}
                      onChange={(e) => setTurfForm({ ...turfForm, openHour: e.target.value })}
                      className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Close Hr</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      required
                      value={turfForm.closeHour}
                      onChange={(e) => setTurfForm({ ...turfForm, closeHour: e.target.value })}
                      className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Surface Type</label>
                  <input
                    type="text"
                    value={turfForm.surface}
                    onChange={(e) => setTurfForm({ ...turfForm, surface: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Venue Photo Style</label>
                  <select
                    value={turfForm.imageKey}
                    onChange={(e) => setTurfForm({ ...turfForm, imageKey: e.target.value })}
                    className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="arena-floodlit">Floodlit Stadium</option>
                    <option value="rooftop-city">Rooftop City Pitch</option>
                    <option value="indoor-dome">Indoor Climate Dome</option>
                    <option value="championship-field">Championship 11v11</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amenities (comma separated)</label>
                  <input
                    type="text"
                    value={turfForm.amenitiesText}
                    onChange={(e) => setTurfForm({ ...turfForm, amenitiesText: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              {/* Weekly Availability Schedule */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    Weekly Availability Schedule (Open Days)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((day, idx) => {
                      const open = turfForm.openDays.includes(idx);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleFormDay(idx)}
                          className={`min-h-[36px] min-w-[46px] px-2.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            open
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={turfForm.isActive}
                    onChange={(e) => setTurfForm({ ...turfForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-700"
                  />
                  <span>Published &amp; Bookable</span>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyId === 'save-turf'}
                  className="min-h-[44px] px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                >
                  {busyId === 'save-turf' ? 'Saving...' : editingMode === 'create' ? 'Create Turf' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {turfs.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{t.name}</h3>
                      <span className={`text-[11px] font-medium ${t.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {t.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{t.address}</p>
                    <p className="font-mono tabular-nums text-xs text-slate-700 mt-1">
                      {t.format} · Max {t.capacity} players · {formatBDT(t.pricePerHour)}/hr · {t.openHour}:00–{t.closeHour}:00
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Open: {(t.openDays || [0, 1, 2, 3, 4, 5, 6]).map((d) => WEEKDAY_LABELS[d]).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {t.lat.toFixed(4)}, {t.lng.toFixed(4)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditTurf(t)}
                      className="min-h-[36px] px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => handleDeleteTurf(t.id)}
                          className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] px-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="min-h-[36px] px-3 rounded-lg border border-rose-200 hover:bg-rose-50 text-xs font-medium text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Slot Schedule & Maintenance Blocks */}
      {section === 'schedule' && activeScheduleTurf && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {turfs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setScheduleTurfId(t.id)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    activeScheduleTurf.id === t.id
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onChangeDate(e.target.value)}
                aria-label="Schedule date"
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {Array.from(
              { length: activeScheduleTurf.closeHour - activeScheduleTurf.openHour },
              (_, i) => activeScheduleTurf.openHour + i
            ).map((hour) => {
              const key = formatSlotKey(activeScheduleTurf.id, selectedDate, hour);
              const res = slotMap.get(key);
              const isBooked = res?.status === 'reserved';
              const isMaint = res?.status === 'maintenance';
              return (
                <div
                  key={hour}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                    isBooked
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : isMaint
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-mono tabular-nums text-xs font-bold text-slate-900">
                      {formatHourRange(hour, 1)}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {isBooked ? 'Player Booked' : isMaint ? 'Maintenance' : 'Open Slot'}
                    </div>
                  </div>
                  {!isBooked && (
                    <button
                      type="button"
                      disabled={busyId === key}
                      onClick={() => handleToggleBlock(activeScheduleTurf.id, hour, isMaint)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-800 inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isMaint ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{isMaint ? 'Unblock' : 'Block'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Owner 3-Month Free Trial & Subscription Billing */}
      {section === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Bangladesh Owner Plan Status</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                {subscription?.planName || 'Turf Hub Owner Pro (BD)'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Free for 3 months for Bangladesh turf owners, then {formatBDT(OWNER_PRO_MONTHLY_BDT)}/month. Players always browse and book for free (৳0).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Current Phase</p>
                <p className="text-sm font-bold text-emerald-700 mt-1">
                  {trialDetails.daysRemaining > 0 ? '3-Month Free Trial' : 'Active Paid Plan'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Trial Window</p>
                <p className="font-mono tabular-nums text-xs font-semibold text-slate-900 mt-1">
                  {trialDetails.startLabel} → {trialDetails.endLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Days Remaining Free</p>
                <p className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-0.5">
                  {trialDetails.daysRemaining} days
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">Included in Owner Pro (৳0 for first 3 months, then {formatBDT(OWNER_PRO_MONTHLY_BDT)}/mo)</p>
              <p>Unlimited Bangladesh turf venues · Real-time slot lock engine · Daily, weekly &amp; monthly BDT revenue reports · Bangladesh Google Maps listing · bKash/Nagad/Rocket/Card checkout</p>
            </div>
          </div>

          <form
            onSubmit={handleSaveBilling}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">Post-Trial Billing Method</h3>
            <p className="text-xs text-slate-500">
              Add your bKash/Nagad/card last 4 digits on file for continuity after {trialDetails.endLabel}.
            </p>

            <div>
              <label htmlFor="owner-card-last4" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Billing Wallet / Card (Last 4 Digits)
              </label>
              <input
                id="owner-card-last4"
                type="text"
                maxLength={4}
                inputMode="numeric"
                value={billingCardInput}
                onChange={(e) => setBillingCardInput(e.target.value)}
                placeholder={subscription?.billingLast4 || '4242'}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 font-mono tabular-nums text-sm"
              />
              {subscription?.billingLast4 && (
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Method on file ending in {subscription.billingLast4}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRenewInput}
                onChange={(e) => setAutoRenewInput(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-700"
              />
              <span>Auto-start {formatBDT(OWNER_PRO_MONTHLY_BDT)}/mo subscription after 3-month free trial</span>
            </label>

            <button
              type="submit"
              disabled={busyId === 'billing'}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {busyId === 'billing' ? 'Saving...' : 'Save Billing Preferences'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
