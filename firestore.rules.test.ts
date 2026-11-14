/**
 * Adversarial "Dirty Dozen" Rules Test Suite for Turf Hub
 * Verifies identity, integrity, PII isolation, and atomic booking invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Booking',
    collection: 'bookings',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'bk_shadow_01',
      userId: 'user_a',
      isFreeOverride: true,
    },
  },
  {
    id: 2,
    name: 'Identity Spoofing on Booking',
    collection: 'bookings',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'bk_spoof_02',
      userId: 'user_victim',
    },
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    collection: 'bookings',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'bk_unverified_03', userId: 'unverified_uid' },
  },
  {
    id: 4,
    name: 'Orphan Booking Without Slot Lock',
    collection: 'bookings',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'bk_orphan_04', slotKey: 'turf1_2026-11-15_19' },
  },
  {
    id: 5,
    name: 'Orphan Slot Lock Without Booking',
    collection: 'slotReservations',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { slotKey: 'turf1_2026-11-15_20', status: 'reserved', bookingId: 'missing_bk' },
  },
  {
    id: 6,
    name: 'Double-Book Overwrite Attempt',
    collection: 'slotReservations',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { slotKey: 'turf1_2026-11-15_19', bookedByUid: 'attacker_uid', status: 'reserved' },
  },
  {
    id: 7,
    name: 'Admin Email Spoof with Unverified Token',
    collection: 'turfs',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'fake_turf', name: 'Fake Turf' },
  },
  {
    id: 8,
    name: 'Blanket Booking List Scrape',
    collection: 'bookings',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'PII Leak on User Profile Get',
    collection: 'users',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Tampering (Cancelled -> Confirmed)',
    collection: 'bookings',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'confirmed', paymentStatus: 'paid' },
  },
  {
    id: 11,
    name: 'Financial Field Tampering on Booking Update',
    collection: 'bookings',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { totalAmount: 0, status: 'cancelled' },
  },
  {
    id: 12,
    name: 'ID Poisoning with Oversized String',
    collection: 'turfs',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'a'.repeat(500) },
  },
];
