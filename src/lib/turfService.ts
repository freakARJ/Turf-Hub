import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { updateProfile, type User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BANGLADESH_BOUNDS,
  BLUEPRINT_CONSTRAINTS,
  DEFAULT_TURFS,
  formatSlotKey,
  OWNER_PRO_MONTHLY_BDT,
  type AdminSubscription,
  type Booking,
  type BookingStatus,
  type PaymentMethod,
  type PaymentStatus,
  type SlotReservation,
  type SubscriptionStatus,
  type Turf,
  type UserProfile,
} from '../types/turf';

function sanitizeId(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : 'id_default';
}

function clampStr(val: string, fallback: string, maxLen: number): string {
  const trimmed = val.trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

export function subscribeToActiveTurfs(
  onData: (turfs: Turf[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'turfs';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => normalizeTurf(d.data() as Partial<Turf>));
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToAllTurfsAdmin(
  onData: (turfs: Turf[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'turfs';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const items = snap.docs.map((d) => normalizeTurf(d.data() as Partial<Turf>));
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

function normalizeTurf(raw: Partial<Turf>): Turf {
  const fallback = DEFAULT_TURFS.find((t) => t.id === raw.id) || DEFAULT_TURFS[0];
  return {
    id: raw.id || fallback.id,
    name: raw.name || fallback.name,
    neighborhood: raw.neighborhood || fallback.neighborhood,
    address: raw.address || fallback.address,
    lat: typeof raw.lat === 'number' ? raw.lat : fallback.lat,
    lng: typeof raw.lng === 'number' ? raw.lng : fallback.lng,
    format: raw.format || fallback.format,
    capacity: typeof raw.capacity === 'number' ? raw.capacity : fallback.capacity,
    surface: raw.surface || fallback.surface,
    pricePerHour: typeof raw.pricePerHour === 'number' ? raw.pricePerHour : fallback.pricePerHour,
    openHour: typeof raw.openHour === 'number' ? raw.openHour : fallback.openHour,
    closeHour: typeof raw.closeHour === 'number' ? raw.closeHour : fallback.closeHour,
    openDays: Array.isArray(raw.openDays) && raw.openDays.length > 0 ? raw.openDays : [0, 1, 2, 3, 4, 5, 6],
    amenities: Array.isArray(raw.amenities) && raw.amenities.length > 0 ? raw.amenities : fallback.amenities,
    imageKey: raw.imageKey || fallback.imageKey,
    rating: typeof raw.rating === 'number' ? raw.rating : fallback.rating,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function subscribeToSlotReservations(
  date: string,
  onData: (slots: SlotReservation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'slotReservations';
  const q = query(
    collection(db, path),
    where('date', '==', date),
    where('status', 'in', ['reserved', 'maintenance', 'released'])
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as SlotReservation)
        .filter((s) => s.status === 'reserved' || s.status === 'maintenance');
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToUserBookings(
  uid: string,
  onData: (bookings: Booking[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Booking);
      items.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.startHour - a.startHour;
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToAllBookingsAdmin(
  onData: (bookings: Booking[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Booking);
      items.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.startHour - a.startHour;
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function seedDefaultTurfsIfEmpty(): Promise<boolean> {
  const path = 'turfs';
  try {
    const existing = await getDocs(collection(db, path));
    const batch = writeBatch(db);
    let hasWrites = false;

    if (existing.empty) {
      for (const turf of DEFAULT_TURFS) {
        batch.set(doc(db, path, turf.id), {
          ...turf,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      hasWrites = true;
    } else {
      // Upgrade legacy or pre-Bangladesh turf documents to Dhaka venues & BDT pricing
      for (const d of existing.docs) {
        const raw = d.data() as Partial<Turf>;
        const matchingDefault = DEFAULT_TURFS.find((t) => t.id === d.id);
        const isPreBangladesh =
          typeof raw.lng === 'number' &&
          (raw.lng < BANGLADESH_BOUNDS.minLng || raw.lng > BANGLADESH_BOUNDS.maxLng);

        if (isPreBangladesh && matchingDefault) {
          batch.update(doc(db, path, d.id), {
            name: matchingDefault.name,
            neighborhood: matchingDefault.neighborhood,
            address: matchingDefault.address,
            lat: matchingDefault.lat,
            lng: matchingDefault.lng,
            pricePerHour: matchingDefault.pricePerHour,
            capacity: matchingDefault.capacity,
            openHour: matchingDefault.openHour,
            closeHour: matchingDefault.closeHour,
            openDays: matchingDefault.openDays,
            updatedAt: serverTimestamp(),
          });
          hasWrites = true;
        } else if (
          typeof raw.lat !== 'number' ||
          typeof raw.capacity !== 'number' ||
          !Array.isArray(raw.openDays) ||
          !raw.address
        ) {
          const normalized = normalizeTurf({ ...raw, id: d.id });
          batch.update(doc(db, path, d.id), {
            address: normalized.address,
            lat: normalized.lat,
            lng: normalized.lng,
            capacity: normalized.capacity,
            openDays: normalized.openDays,
            updatedAt: serverTimestamp(),
          });
          hasWrites = true;
        }
      }
    }

    if (hasWrites) {
      await batch.commit();
    }
    return hasWrites;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Partial<UserProfile>;
      return {
        uid: data.uid || user.uid,
        displayName: data.displayName || user.displayName || 'Player',
        email: data.email || user.email || '',
        phone: data.phone || '',
        photoUrl: data.photoUrl || user.photoURL || '',
        preferredPosition: data.preferredPosition || 'Midfielder',
        defaultTeamName: data.defaultTeamName || '',
        favoriteTurfIds: Array.isArray(data.favoriteTurfIds) ? data.favoriteTurfIds : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    if (!user.emailVerified) {
      return {
        uid: user.uid,
        displayName: user.displayName || 'Player',
        email: user.email || '',
        phone: '',
        photoUrl: user.photoURL || '',
        preferredPosition: 'Midfielder',
        defaultTeamName: '',
        favoriteTurfIds: [],
      };
    }

    const profile: UserProfile = {
      uid: sanitizeId(user.uid, 128),
      displayName: clampStr(user.displayName || 'Player', 'Player', 80),
      email: clampStr(user.email || 'player@turfhub.app', 'player@turfhub.app', BLUEPRINT_CONSTRAINTS.maxEmailLength),
      phone: '',
      photoUrl: (user.photoURL || '').slice(0, BLUEPRINT_CONSTRAINTS.maxPhotoLength),
      preferredPosition: 'Midfielder',
      defaultTeamName: '',
      favoriteTurfIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserProfileDetails(
  user: User,
  updates: {
    displayName: string;
    phone: string;
    photoUrl: string;
    preferredPosition: string;
    defaultTeamName: string;
  }
): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const payload = {
      displayName: clampStr(updates.displayName, 'Player', 80),
      phone: updates.phone.trim().slice(0, BLUEPRINT_CONSTRAINTS.maxPhoneLength),
      photoUrl: updates.photoUrl.slice(0, BLUEPRINT_CONSTRAINTS.maxPhotoLength),
      preferredPosition: updates.preferredPosition.trim().slice(0, 40),
      defaultTeamName: updates.defaultTeamName.trim().slice(0, BLUEPRINT_CONSTRAINTS.maxTeamNameLength),
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      const existing = snap.data() as Partial<UserProfile>;
      if (
        typeof existing.photoUrl !== 'string' ||
        typeof existing.preferredPosition !== 'string' ||
        typeof existing.defaultTeamName !== 'string'
      ) {
        // Patch missing fields on legacy profile doc
        await setDoc(ref, {
          uid: sanitizeId(user.uid, 128),
          email: clampStr(user.email || existing.email || 'player@turfhub.app', 'player@turfhub.app', BLUEPRINT_CONSTRAINTS.maxEmailLength),
          favoriteTurfIds: Array.isArray(existing.favoriteTurfIds) ? existing.favoriteTurfIds : [],
          createdAt: existing.createdAt || serverTimestamp(),
          ...payload,
        });
      } else {
        await updateDoc(ref, payload);
      }
    } else {
      await setDoc(ref, {
        uid: sanitizeId(user.uid, 128),
        email: clampStr(user.email || 'player@turfhub.app', 'player@turfhub.app', BLUEPRINT_CONSTRAINTS.maxEmailLength),
        favoriteTurfIds: [],
        createdAt: serverTimestamp(),
        ...payload,
      });
    }

    if (payload.displayName !== user.displayName) {
      await updateProfile(user, { displayName: payload.displayName }).catch(() => {});
    }

    const updatedSnap = await getDoc(ref);
    return updatedSnap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleFavoriteTurf(
  uid: string,
  turfId: string,
  currentFavorites: string[]
): Promise<string[]> {
  const path = `users/${uid}`;
  const next = currentFavorites.includes(turfId)
    ? currentFavorites.filter((id) => id !== turfId)
    : [...currentFavorites, turfId].slice(0, 10);
  try {
    await updateDoc(doc(db, 'users', uid), {
      favoriteTurfIds: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function ensureAdminSubscription(user: User): Promise<AdminSubscription> {
  const path = `adminSubscriptions/${user.uid}`;
  const ref = doc(db, 'adminSubscriptions', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AdminSubscription;
    }
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 90);
    const sub: AdminSubscription = {
      uid: sanitizeId(user.uid, 128),
      email: clampStr(user.email || 'admin@turfhub.app', 'admin@turfhub.app', BLUEPRINT_CONSTRAINTS.maxEmailLength),
      planName: 'Turf Hub Owner Pro (BD)',
      monthlyPrice: OWNER_PRO_MONTHLY_BDT,
      trialMonths: 3,
      trialStartAt: serverTimestamp(),
      trialEndsAt: Timestamp.fromDate(trialEndDate),
      status: 'trial_active',
      billingLast4: '',
      autoRenew: true,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, sub);
    const created = await getDoc(ref);
    return created.data() as AdminSubscription;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateAdminSubscription(
  uid: string,
  updates: {
    status: SubscriptionStatus;
    billingLast4: string;
    autoRenew: boolean;
  }
): Promise<AdminSubscription> {
  const path = `adminSubscriptions/${uid}`;
  const ref = doc(db, 'adminSubscriptions', uid);
  try {
    await updateDoc(ref, {
      status: updates.status,
      billingLast4: updates.billingLast4.slice(0, 8),
      autoRenew: updates.autoRenew,
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return snap.data() as AdminSubscription;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export interface CreateBookingInput {
  turf: Turf;
  user: User;
  customerName: string;
  customerPhone: string;
  teamName: string;
  date: string;
  startHour: number;
  durationHours: 1 | 2;
  basePrice: number;
  serviceFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cardLast4: string;
}

export async function createAtomicBooking(input: CreateBookingInput): Promise<Booking> {
  const bookingId = sanitizeId(`bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 80);
  const bookingCode = `TH-${Math.floor(100000 + Math.random() * 900000)}`;
  const paymentReference = sanitizeId(`PAY_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`, 64);

  const slotHours = input.durationHours === 2 ? [input.startHour, input.startHour + 1] : [input.startHour];
  const slotKeys = slotHours.map((h) => formatSlotKey(input.turf.id, input.date, h));
  const primarySlotKey = slotKeys[0];

  try {
    const slotStates = await Promise.all(
      slotKeys.map(async (k) => {
        const snap = await getDoc(doc(db, 'slotReservations', k));
        if (!snap.exists()) return { key: k, exists: false, status: null as string | null };
        const data = snap.data() as SlotReservation;
        return { key: k, exists: true, status: data.status };
      })
    );

    const occupied = slotStates.find((s) => s.exists && (s.status === 'reserved' || s.status === 'maintenance'));
    if (occupied) {
      throw new Error('This time slot was just reserved by another player. Please choose another time.');
    }

    const batch = writeBatch(db);
    const bookingPayload: Booking = {
      id: bookingId,
      bookingCode,
      slotKey: primarySlotKey,
      turfId: sanitizeId(input.turf.id, 64),
      turfName: clampStr(input.turf.name, 'Turf Hub Venue', BLUEPRINT_CONSTRAINTS.maxNameLength),
      turfFormat: input.turf.format,
      userId: sanitizeId(input.user.uid, 128),
      customerName: clampStr(input.customerName, 'Player', 80),
      customerEmail: clampStr(input.user.email || 'player@turfhub.app', 'player@turfhub.app', BLUEPRINT_CONSTRAINTS.maxEmailLength),
      customerPhone: clampStr(input.customerPhone, '01700000000', BLUEPRINT_CONSTRAINTS.maxPhoneLength),
      teamName: clampStr(input.teamName, 'Matchday XI', BLUEPRINT_CONSTRAINTS.maxTeamNameLength),
      date: input.date,
      startHour: input.startHour,
      durationHours: input.durationHours,
      basePrice: Number(input.basePrice.toFixed(2)),
      serviceFee: Number(input.serviceFee.toFixed(2)),
      discountAmount: Number(input.discountAmount.toFixed(2)),
      totalAmount: Number(input.totalAmount.toFixed(2)),
      paymentMethod: input.paymentMethod,
      paymentReference,
      cardLast4: clampStr(input.cardLast4, '4242', 8),
      paymentStatus: 'paid',
      status: 'confirmed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(doc(db, 'bookings', bookingId), bookingPayload);

    slotStates.forEach((st, idx) => {
      const hour = slotHours[idx];
      const slotRef = doc(db, 'slotReservations', st.key);
      if (st.exists && st.status === 'released') {
        batch.update(slotRef, {
          status: 'reserved',
          bookingId,
          bookedByUid: sanitizeId(input.user.uid, 128),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(slotRef, {
          slotKey: st.key,
          turfId: sanitizeId(input.turf.id, 64),
          date: input.date,
          startHour: hour,
          status: 'reserved',
          bookingId,
          bookedByUid: sanitizeId(input.user.uid, 128),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();

    if (input.customerPhone.trim().length >= 5) {
      updateDoc(doc(db, 'users', input.user.uid), {
        phone: clampStr(input.customerPhone, '', BLUEPRINT_CONSTRAINTS.maxPhoneLength),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    return bookingPayload;
  } catch (err) {
    if (err instanceof Error && err.message.includes('just reserved')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `bookings/${bookingId}`);
  }
}

export async function cancelBookingAtomic(booking: Booking): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'bookings', booking.id), {
      status: 'cancelled',
      paymentStatus: 'refunded',
      updatedAt: serverTimestamp(),
    });

    const hours = booking.durationHours === 2 ? [booking.startHour, booking.startHour + 1] : [booking.startHour];
    for (const h of hours) {
      const k = formatSlotKey(booking.turfId, booking.date, h);
      const snap = await getDoc(doc(db, 'slotReservations', k));
      if (snap.exists() && snap.data().bookingId === booking.id) {
        batch.update(doc(db, 'slotReservations', k), {
          status: 'released',
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminUpdateBookingStatus(
  booking: Booking,
  status: BookingStatus,
  paymentStatus: PaymentStatus
): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'bookings', booking.id), {
      status,
      paymentStatus,
      updatedAt: serverTimestamp(),
    });

    if (status === 'cancelled') {
      const hours = booking.durationHours === 2 ? [booking.startHour, booking.startHour + 1] : [booking.startHour];
      for (const h of hours) {
        const k = formatSlotKey(booking.turfId, booking.date, h);
        const snap = await getDoc(doc(db, 'slotReservations', k));
        if (snap.exists() && snap.data().bookingId === booking.id) {
          batch.update(doc(db, 'slotReservations', k), {
            status: 'released',
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminToggleMaintenanceSlot(
  turfId: string,
  date: string,
  startHour: number,
  adminUid: string,
  block: boolean
): Promise<void> {
  const slotKey = formatSlotKey(turfId, date, startHour);
  const path = `slotReservations/${slotKey}`;
  try {
    const ref = doc(db, 'slotReservations', slotKey);
    const snap = await getDoc(ref);
    if (block) {
      const payload: SlotReservation = {
        slotKey,
        turfId,
        date,
        startHour,
        status: 'maintenance',
        bookingId: sanitizeId(`maint_${slotKey}`, 80),
        bookedByUid: sanitizeId(adminUid, 128),
        updatedAt: serverTimestamp(),
      };
      if (snap.exists()) {
        await updateDoc(ref, {
          status: 'maintenance',
          bookingId: payload.bookingId,
          bookedByUid: payload.bookedByUid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, payload);
      }
    } else if (snap.exists()) {
      await updateDoc(ref, {
        status: 'released',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminSaveTurf(
  turf: Omit<Turf, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const safeId = sanitizeId(turf.id, 64);
  const path = `turfs/${safeId}`;
  try {
    const ref = doc(db, 'turfs', safeId);
    const cleanDays = Array.from(new Set(turf.openDays.filter((d) => d >= 0 && d <= 6))).sort();
    const openDays = cleanDays.length > 0 ? cleanDays : [0, 1, 2, 3, 4, 5, 6];
    const cleanAmenities = turf.amenities.map((a) => a.trim().slice(0, 60)).filter(Boolean).slice(0, 8);
    const payload = {
      name: clampStr(turf.name, 'New Turf', 100),
      neighborhood: clampStr(turf.neighborhood, 'Dhaka', 80),
      address: clampStr(turf.address, 'Dhaka Sports Complex, Bangladesh', BLUEPRINT_CONSTRAINTS.maxAddressLength),
      lat: Math.max(
        BANGLADESH_BOUNDS.minLat,
        Math.min(BANGLADESH_BOUNDS.maxLat, Number(turf.lat) || BANGLADESH_BOUNDS.dhakaCenter.lat)
      ),
      lng: Math.max(
        BANGLADESH_BOUNDS.minLng,
        Math.min(BANGLADESH_BOUNDS.maxLng, Number(turf.lng) || BANGLADESH_BOUNDS.dhakaCenter.lng)
      ),
      format: turf.format,
      capacity: Math.max(2, Math.min(40, Math.round(Number(turf.capacity) || 14))),
      surface: clampStr(turf.surface, 'FIFA Quality Pro 50mm', 60),
      pricePerHour: Math.max(100, Math.min(50000, Number(turf.pricePerHour) || 3500)),
      openHour: Math.max(0, Math.min(22, Math.round(Number(turf.openHour)))),
      closeHour: Math.max(1, Math.min(24, Math.round(Number(turf.closeHour)))),
      openDays,
      amenities: cleanAmenities.length > 0 ? cleanAmenities : ['LED Floodlights'],
      imageKey: turf.imageKey || 'arena-floodlit',
      rating: Math.max(0, Math.min(5, Number(turf.rating) || 4.8)),
      isActive: Boolean(turf.isActive),
    };

    if (isNew) {
      await setDoc(ref, {
        ...payload,
        id: safeId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const snap = await getDoc(ref);
      const existing = snap.data() as Turf | undefined;
      await updateDoc(ref, {
        ...payload,
        id: safeId,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminDeleteTurf(turfId: string): Promise<void> {
  const safeId = sanitizeId(turfId, 64);
  const path = `turfs/${safeId}`;
  try {
    await deleteDoc(doc(db, 'turfs', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
