import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { CalendarCheck2, QrCode, Receipt, RotateCcw } from 'lucide-react';
import { formatBDT, formatHourRange, getDhakaNow, type Booking } from '../types/turf';
import { cancelBookingAtomic } from '../lib/turfService';

interface MyBookingsViewProps {
  user: User | null;
  bookings: Booking[];
  loading: boolean;
  onRequestSignIn: () => void;
  onBrowseTurfs: () => void;
}

const DeterministicPassMatrix: React.FC<{ code: string }> = ({ code }) => {
  const cells: boolean[] = [];
  for (let i = 0; i < 49; i++) {
    const ch = code.charCodeAt(i % code.length) || 65;
    cells.push(((ch * (i + 3)) % 5) < 3);
  }
  return (
    <svg viewBox="0 0 70 70" className="w-24 h-24 rounded-lg bg-white p-1.5 border border-slate-200" aria-label={`Gate pass code ${code}`}>
      {cells.map((filled, idx) => {
        const x = (idx % 7) * 10;
        const y = Math.floor(idx / 7) * 10;
        return filled ? <rect key={idx} x={x} y={y} width="8" height="8" rx="1.5" fill="#0F172A" /> : null;
      })}
    </svg>
  );
};

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  user,
  bookings,
  loading,
  onRequestSignIn,
  onBrowseTurfs,
}) => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [expandedPassId, setExpandedPassId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  if (!user) {
    return (
      <section className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <CalendarCheck2 className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Your Match Passes &amp; Receipts</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Sign in with Google to view confirmed pitch bookings, digital QR gate codes, and instant refund options.
        </p>
        <button
          type="button"
          onClick={onRequestSignIn}
          className="mt-6 min-h-[44px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Sign In with Google
        </button>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="max-w-5xl mx-auto py-8 px-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </section>
    );
  }

  const today = getDhakaNow().isoDate;
  const filtered = bookings.filter((b) => {
    if (filter === 'upcoming') return b.status !== 'cancelled' && b.date >= today;
    if (filter === 'past') return b.status === 'cancelled' || b.date < today;
    return true;
  });

  const handleCancel = async (booking: Booking) => {
    setActionError('');
    setCancellingId(booking.id);
    try {
      await cancelBookingAtomic(booking);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Turf Bookings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Active pitch passes, payment receipts, and slot cancellations.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past & Refunded' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                filter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-xs font-medium text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">
          {actionError}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No bookings in this view</p>
          <p className="text-sm text-slate-500 mt-1">
            Reserve a 5v5, 7v7, or 11v11 pitch to generate your instant matchday gate pass.
          </p>
          <button
            type="button"
            onClick={onBrowseTurfs}
            className="mt-5 min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer"
          >
            Browse Available Turfs
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => {
            const isExpanded = expandedPassId === booking.id;
            const statusText =
              booking.status === 'confirmed'
                ? 'Confirmed'
                : booking.status === 'checked_in'
                  ? 'Checked In'
                  : 'Cancelled';
            const statusStyle =
              booking.status === 'confirmed'
                ? 'text-emerald-700 bg-emerald-50'
                : booking.status === 'checked_in'
                  ? 'text-slate-800 bg-slate-100'
                  : 'text-rose-700 bg-rose-50';

            return (
              <article
                key={booking.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900">{booking.turfName}</h3>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusStyle}`}>
                        {statusText}
                      </span>
                    </div>
                    <p className="font-mono tabular-nums text-xs text-slate-600">
                      {booking.date} · {formatHourRange(booking.startHour, booking.durationHours)} · {booking.turfFormat} · Team: {booking.teamName}
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <p className="font-mono tabular-nums text-base font-bold text-slate-900">
                      {formatBDT(booking.totalAmount)}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 uppercase">
                      {booking.paymentStatus === 'refunded' ? 'Refunded' : `${booking.paymentMethod} · ${booking.cardLast4}`}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{booking.bookingCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>{booking.paymentReference}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedPassId(isExpanded ? null : booking.id)}
                      className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{isExpanded ? 'Hide Gate Pass' : 'Show Gate Pass'}</span>
                    </button>

                    {booking.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={cancellingId === booking.id}
                        onClick={() => handleCancel(booking)}
                        className="min-h-[40px] px-3.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-medium text-rose-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{cancellingId === booking.id ? 'Refunding...' : 'Cancel & Refund'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-5">
                    <DeterministicPassMatrix code={booking.bookingCode} />
                    <div className="text-xs text-slate-600 space-y-1 text-center sm:text-left">
                      <p className="font-semibold text-slate-900 text-sm">Digital Turf Gate Pass</p>
                      <p>Present code <span className="font-mono font-bold text-slate-900">{booking.bookingCode}</span> at pitch reception 10 minutes before kickoff.</p>
                      <p className="font-mono text-[11px] text-slate-500">Contact: {booking.customerPhone}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
