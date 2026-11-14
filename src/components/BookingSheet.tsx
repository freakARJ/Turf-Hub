import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  formatBDT,
  formatHourRange,
  formatSlotKey,
  getDhakaNow,
  getUpcomingDates,
  isTurfOpenOnDate,
  isValidBangladeshPhone,
  TURF_IMAGE_MAP,
  type Booking,
  type PaymentMethod,
  type SlotReservation,
  type Turf,
} from '../types/turf';
import { createAtomicBooking } from '../lib/turfService';

interface BookingSheetProps {
  turf: Turf;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  reservations: SlotReservation[];
  user: User | null;
  defaultPhone?: string;
  defaultTeamName?: string;
  isCatalogSeeded: boolean;
  onRequestSignIn: () => void;
  onBookingComplete: (booking: Booking) => void;
  onViewBookings?: () => void;
  onClose: () => void;
}

type CheckoutStep = 'slots' | 'payment' | 'pass';

export const BookingSheet: React.FC<BookingSheetProps> = ({
  turf,
  selectedDate,
  onChangeDate,
  reservations,
  user,
  defaultPhone = '',
  defaultTeamName = '',
  isCatalogSeeded,
  onRequestSignIn,
  onBookingComplete,
  onViewBookings,
  onClose,
}) => {
  const dates = useMemo(() => getUpcomingDates(7), []);
  const [step, setStep] = useState<CheckoutStep>('slots');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState<1 | 2>(1);

  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(defaultPhone || '+880 1711-000000');
  const [teamName, setTeamName] = useState(defaultTeamName || '');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [mfsWalletNumber, setMfsWalletNumber] = useState('01711000000');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvc, setCardCvc] = useState('424');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const slotMap = useMemo(() => {
    const map = new Map<string, SlotReservation>();
    for (const r of reservations) {
      map.set(r.slotKey, r);
    }
    return map;
  }, [reservations]);

  const dhakaNow = getDhakaNow();
  const todayIso = dhakaNow.isoDate;
  const currentHour = dhakaNow.hour;
  const turfOpenOnSelectedDate = isTurfOpenOnDate(turf, selectedDate);

  const hoursList = useMemo(() => {
    const list: number[] = [];
    for (let h = turf.openHour; h < turf.closeHour; h++) {
      list.push(h);
    }
    return list;
  }, [turf.openHour, turf.closeHour]);

  const isHourDisabled = (h: number): { disabled: boolean; reason: string } => {
    if (!turfOpenOnSelectedDate) {
      return { disabled: true, reason: 'Closed' };
    }
    if (selectedDate === todayIso && h <= currentHour) {
      return { disabled: true, reason: 'Past' };
    }
    const key = formatSlotKey(turf.id, selectedDate, h);
    const res = slotMap.get(key);
    if (res?.status === 'reserved') return { disabled: true, reason: 'Booked' };
    if (res?.status === 'maintenance') return { disabled: true, reason: 'Blocked' };
    return { disabled: false, reason: 'Open' };
  };

  const canBookTwoHours = useMemo(() => {
    if (selectedHour === null || !turfOpenOnSelectedDate) return false;
    if (selectedHour + 1 >= turf.closeHour) return false;
    const nextKey = formatSlotKey(turf.id, selectedDate, selectedHour + 1);
    const nextRes = slotMap.get(nextKey);
    if (nextRes?.status === 'reserved' || nextRes?.status === 'maintenance') return false;
    if (selectedDate === todayIso && selectedHour + 1 <= currentHour) return false;
    return true;
  }, [selectedHour, turfOpenOnSelectedDate, turf.closeHour, turf.id, selectedDate, slotMap, todayIso, currentHour]);

  const effectiveDuration: 1 | 2 = durationHours === 2 && canBookTwoHours ? 2 : 1;
  const basePrice = turf.pricePerHour * effectiveDuration;
  const serviceFee = Math.round(basePrice * 0.04);
  const discountAmount = promoApplied ? Math.round(basePrice * 0.1) : 0;
  const totalAmount = basePrice + serviceFee - discountAmount;

  const handleApplyPromo = () => {
    setPromoError('');
    if (promoCode.trim().toUpperCase() === 'PITCH10') {
      setPromoApplied(true);
    } else {
      setPromoApplied(false);
      setPromoError('Try code PITCH10 for 10% off pitch hire.');
    }
  };

  const handleProceedToPayment = () => {
    setErrorMsg('');
    if (selectedHour === null) {
      setErrorMsg('Select a kickoff time slot first.');
      return;
    }
    if (!user) {
      onRequestSignIn();
      return;
    }
    if (!customerName.trim()) {
      setCustomerName(user.displayName || 'Team Captain');
    }
    setStep('payment');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!user || selectedHour === null) {
      onRequestSignIn();
      return;
    }
    if (!isCatalogSeeded) {
      setErrorMsg('Live venue database is not initialized yet. Sign in as venue admin once to initialize the turf catalog.');
      return;
    }
    if (!isValidBangladeshPhone(customerPhone)) {
      setErrorMsg('Please enter a valid Bangladesh mobile number (e.g., 01711-000000 or +8801711000000).');
      return;
    }
    if (paymentMethod === 'card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12 || cardExpiry.trim().length < 4 || cardCvc.trim().length < 3) {
        setErrorMsg('Please enter valid card number, expiry, and CVC.');
        return;
      }
    } else {
      const walletDigits = mfsWalletNumber.replace(/\D/g, '');
      if (walletDigits.length < 11 || walletDigits.length > 13) {
        setErrorMsg(`Please enter a valid ${paymentMethod.toUpperCase()} account number (11–12 digits).`);
        return;
      }
    }

    const last4 =
      paymentMethod === 'card'
        ? cardNumber.replace(/\D/g, '').slice(-4) || '4242'
        : mfsWalletNumber.replace(/\D/g, '').slice(-4) || '0000';

    setSubmitting(true);
    try {
      const booking = await createAtomicBooking({
        turf,
        user,
        customerName: customerName.trim() || user.displayName || 'Player',
        customerPhone: customerPhone.trim(),
        teamName: teamName.trim() || 'Matchday XI',
        date: selectedDate,
        startHour: selectedHour,
        durationHours: effectiveDuration,
        basePrice,
        serviceFee,
        discountAmount,
        totalAmount,
        paymentMethod,
        cardLast4: last4,
      });
      setConfirmedBooking(booking);
      setStep('pass');
      onBookingComplete(booking);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message.includes('Missing or insufficient permissions')
            ? 'Unable to complete booking right now. Ensure your account email is verified and the venue catalog is active.'
            : err.message
          : 'Payment could not be completed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const imgSrc = TURF_IMAGE_MAP[turf.imageKey];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-sheet-title"
    >
      <div className="w-full md:max-w-3xl max-h-[92vh] bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Mobile grab handle */}
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 md:hidden shrink-0" />

        {/* Sheet Top Bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {step === 'payment' && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep('slots');
                }}
                className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Back to slot selection"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h2 id="booking-sheet-title" className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {step === 'pass'
                  ? 'Booking Confirmed'
                  : step === 'payment'
                    ? 'Secure Online Checkout'
                    : turf.name}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {turf.format} · {turf.surface} · {formatBDT(turf.pricePerHour)}/hr
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Close booking dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {step === 'slots' && (
            <>
              {/* Venue Strip */}
              <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                {imgSrc && (
                  <img
                    src={imgSrc}
                    alt={turf.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{turf.neighborhood}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {turf.amenities.join(' · ')}
                  </p>
                </div>
              </div>

              {/* Date Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2.5">
                  Select Match Date
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dates.map((d) => {
                    const active = d.iso === selectedDate;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => {
                          onChangeDate(d.iso);
                          setSelectedHour(null);
                        }}
                        className={`min-h-[56px] min-w-[68px] px-3 py-2 rounded-xl border text-center transition-colors shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-[11px] font-medium opacity-80">{d.dayShort}</div>
                        <div className="font-mono tabular-nums text-sm font-bold mt-0.5">{d.dayNum}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots Grid */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-slate-700">Available Kickoff Slots</span>
                  <span className="text-xs text-slate-500">Bangladesh Time (BST) · 60 min blocks</span>
                </div>
                {!turfOpenOnSelectedDate && (
                  <p className="mb-3 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl">
                    Closed on this weekday per venue schedule. Choose another match date above.
                  </p>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {hoursList.map((h) => {
                    const { disabled, reason } = isHourDisabled(h);
                    const isSelected =
                      selectedHour === h || (effectiveDuration === 2 && selectedHour !== null && h === selectedHour + 1);
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedHour(h)}
                        className={`min-h-[48px] px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          disabled
                            ? 'bg-slate-50 border-slate-100 text-slate-400'
                            : isSelected
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500'
                        }`}
                      >
                        <div className="font-mono tabular-nums text-xs font-semibold">
                          {String(h).padStart(2, '0')}:00
                        </div>
                        <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {isSelected ? 'Selected' : reason}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration & Team Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-2">Match Duration</span>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDurationHours(1)}
                      className={`min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        effectiveDuration === 1
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 Hour ({formatBDT(turf.pricePerHour)})
                    </button>
                    <button
                      type="button"
                      disabled={!canBookTwoHours}
                      onClick={() => setDurationHours(2)}
                      className={`min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        effectiveDuration === 2
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      2 Hours ({formatBDT(turf.pricePerHour * 2)})
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="team-name-input" className="block text-xs font-semibold text-slate-700 mb-2">
                    Team / Match Label
                  </label>
                  <input
                    id="team-name-input"
                    type="text"
                    maxLength={60}
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Rovers 7s"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {errorMsg && (
                <p role="alert" className="text-xs font-medium text-rose-600 bg-rose-50 px-3.5 py-2.5 rounded-xl">
                  {errorMsg}
                </p>
              )}
            </>
          )}

          {step === 'payment' && selectedHour !== null && (
            <form id="turf-checkout-form" onSubmit={handleConfirmPayment} className="space-y-6">
              {/* Summary Strip */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{turf.name}</p>
                  <p className="font-mono tabular-nums text-xs text-slate-600 mt-1">
                    {selectedDate} · {formatHourRange(selectedHour, effectiveDuration)} · {effectiveDuration}h
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total Due (BDT)</p>
                  <p className="font-mono tabular-nums text-xl font-bold text-slate-900">
                    {formatBDT(totalAmount)}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="payer-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Player / Captain Name
                  </label>
                  <input
                    id="payer-name"
                    type="text"
                    required
                    maxLength={80}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="payer-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bangladesh Mobile (SMS Gate Pass)
                  </label>
                  <input
                    id="payer-phone"
                    type="tel"
                    required
                    maxLength={24}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+880 1711-000000"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Payment Method Selector (bKash, Nagad, Rocket, Local/Intl Card) */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2.5">
                  Bangladesh Payment Method
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'bkash', label: 'bKash', sub: 'MFS Wallet' },
                      { id: 'nagad', label: 'Nagad', sub: 'Instant Pay' },
                      { id: 'rocket', label: 'Rocket', sub: 'DBBL Mobile' },
                      { id: 'card', label: 'Card / Nexus', sub: 'Visa · MC' },
                    ] as const
                  ).map((m) => {
                    const active = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`min-h-[54px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-emerald-700 bg-emerald-50/70 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-semibold whitespace-nowrap">{m.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{m.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === 'card' ? (
                <div className="p-4 rounded-2xl border border-slate-200 space-y-3 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-700" />
                      Visa / Mastercard / DBBL Nexus
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Lock className="w-3.5 h-3.5" /> Sandbox Mode
                    </span>
                  </div>
                  <div>
                    <label htmlFor="card-num" className="block text-[11px] text-slate-500 mb-1">
                      Card Number
                    </label>
                    <input
                      id="card-num"
                      type="text"
                      inputMode="numeric"
                      maxLength={23}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 font-mono tabular-nums text-sm focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="card-exp" className="block text-[11px] text-slate-500 mb-1">
                        Expiry (MM/YY)
                      </label>
                      <input
                        id="card-exp"
                        type="text"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 font-mono tabular-nums text-sm focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-cvc" className="block text-[11px] text-slate-500 mb-1">
                        CVC
                      </label>
                      <input
                        id="card-cvc"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 font-mono tabular-nums text-sm focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5 bg-white">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 uppercase">
                      <Smartphone className="w-4 h-4 text-emerald-700" />
                      {paymentMethod} Wallet Number
                    </span>
                    <span className="text-slate-500">Sandbox Authorization</span>
                  </div>
                  <input
                    id="mfs-wallet"
                    type="tel"
                    maxLength={16}
                    value={mfsWalletNumber}
                    onChange={(e) => setMfsWalletNumber(e.target.value)}
                    placeholder={paymentMethod === 'rocket' ? '017110000008' : '01711000000'}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 font-mono tabular-nums text-sm focus:outline-none focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Runs in sandbox mode without debiting real funds. Connect live SSLCommerz or {paymentMethod === 'bkash' ? 'bKash Merchant' : 'MFS'} API keys on a server route to enable live wallet settlement.
                  </p>
                </div>
              )}

              {/* Promo Code & Itemized Breakdown */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Promo code (try PITCH10)"
                    aria-label="Promo code"
                    className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm uppercase font-mono focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-xs text-slate-500">{promoError}</p>}
                {promoApplied && <p className="text-xs font-medium text-emerald-700">PITCH10 applied — 10% off pitch hire.</p>}

                <dl className="space-y-1.5 text-sm pt-2">
                  <div className="flex justify-between text-slate-600">
                    <dt>Pitch Hire ({effectiveDuration} hr)</dt>
                    <dd className="font-mono tabular-nums">{formatBDT(basePrice)}</dd>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <dt>Online Booking Fee (4%)</dt>
                    <dd className="font-mono tabular-nums">{formatBDT(serviceFee)}</dd>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Promo Discount (PITCH10)</dt>
                      <dd className="font-mono tabular-nums">-{formatBDT(discountAmount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-100">
                    <dt>Total Paid</dt>
                    <dd className="font-mono tabular-nums text-base">{formatBDT(totalAmount)}</dd>
                  </div>
                </dl>
              </div>

              {errorMsg && (
                <p role="alert" className="text-xs font-medium text-rose-600 bg-rose-50 px-3.5 py-2.5 rounded-xl">
                  {errorMsg}
                </p>
              )}
            </form>
          )}

          {step === 'pass' && confirmedBooking && (
            <div className="py-4 text-center space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-700">Booking Confirmed · Digital Gate Pass</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{confirmedBooking.turfName}</h3>
                <p className="font-mono tabular-nums text-sm text-slate-600 mt-1">
                  {confirmedBooking.date} · {formatHourRange(confirmedBooking.startHour, confirmedBooking.durationHours)}
                </p>
              </div>

              <div className="max-w-sm mx-auto p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Gate Access Code</span>
                  <span className="font-mono tabular-nums text-base font-bold text-slate-900">
                    {confirmedBooking.bookingCode}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Team</span>
                  <span className="font-medium text-slate-900">{confirmedBooking.teamName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 uppercase">
                    {formatBDT(confirmedBooking.totalAmount)} ({confirmedBooking.paymentMethod} · {confirmedBooking.cardLast4})
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Transaction Ref</span>
                  <span className="font-mono text-[11px] text-slate-600">{confirmedBooking.paymentReference}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Sheet Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0">
          {step === 'slots' && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  {selectedHour !== null ? formatHourRange(selectedHour, effectiveDuration) : 'Choose a kickoff hour'}
                </p>
                <p className="font-mono tabular-nums text-base font-bold text-slate-900">
                  {formatBDT(selectedHour !== null ? totalAmount : turf.pricePerHour)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleProceedToPayment}
                className="min-h-[48px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                {user ? 'Continue to Payment' : 'Sign In to Book'}
              </button>
            </div>
          )}

          {step === 'payment' && (
            <button
              type="submit"
              form="turf-checkout-form"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Authorizing Payment...' : `Confirm ${formatBDT(totalAmount)} & Reserve Pitch`}</span>
            </button>
          )}

          {step === 'pass' && (
            <button
              type="button"
              onClick={() => (onViewBookings ? onViewBookings() : onClose())}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              View in My Bookings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
