# Turf Hub Firestore Security Specification

## 1. Data Invariants
1. **Turf Catalog Integrity**: Only verified administrators (`isAdmin()`) may create, edit, or deactivate `/turfs/{turfId}` records. Active turfs are publicly readable for browsing without exposing any PII.
2. **Atomic Double-Booking Prevention**: Every player booking (`/bookings/{bookingId}`) MUST atomically create a corresponding `/slotReservations/{slotKey}` document in the same Firestore batch, and `/slotReservations/{slotKey}` MUST NOT already exist as an active lock unless previously released.
3. **Zero-PII Availability Layer**: `/slotReservations/{slotKey}` stores only opaque `turfId`, `date`, `startHour`, `status`, `bookingId`, and `bookedByUid`. No emails, phone numbers, names, or card digits exist on availability locks.
4. **Booking Ownership & Admin Scoping**: Regular authenticated users (`email_verified == true`) can only read/list bookings where `resource.data.userId == request.auth.uid`, and can only create bookings with `userId == request.auth.uid` against an existing active turf.
5. **Terminal State Locking**: Once a booking reaches `cancelled` or `checked_in`, regular users cannot mutate it. Owners may only transition a `confirmed` booking to `cancelled` (with `paymentStatus: 'refunded'`) while updating only `status`, `paymentStatus`, and `updatedAt`.
6. **Privilege Escalation Prevention**: `/users/{userId}` has no role/admin fields and strictly forbids unknown shadow keys. `/admins/{adminUid}` cannot be written from client SDKs.
7. **Temporal Integrity**: `createdAt` is locked to `request.time` on creation and immutable thereafter; `updatedAt` is locked to `request.time` on every write.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Booking**: Creating a booking with `{ ..., isFreeOverride: true }` -> Rejected by `data.keys().hasOnly(...)`.
2. **Identity Spoofing on Booking**: User A sends `userId: "user-B"` in `bookings/{bookingId}` -> Rejected by `data.userId == request.auth.uid`.
3. **Unverified Email Write**: User with `email_verified: false` tries to create a booking -> Rejected by `isVerifiedUser()`.
4. **Orphan Booking Without Slot Lock**: Creating `/bookings/{bookingId}` without writing `/slotReservations/{slotKey}` in the same batch -> Rejected by `existsAfter(...)` and `getAfter(...)`.
5. **Orphan Slot Lock Without Booking**: Creating `/slotReservations/{slotKey}` with `status: "reserved"` and no matching `/bookings/{bookingId}` in batch -> Rejected by `existsAfter(...)`.
6. **Double-Book Overwrite**: Attempting to `create` or `update` an already-reserved `slotReservations/{slotKey}` by another user -> Rejected because `allow create` fails on existing doc and `allow update` restricts to owner/admin.
7. **Admin Email Spoof**: Non-admin user claims `email: "arjawad.cse@gmail.com"` with `email_verified: false` -> Rejected by `email_verified == true`.
8. **Blanket Booking Scrape**: Non-admin authenticated user issues `list` on `/bookings` without `where('userId', '==', uid)` -> Rejected by `resource.data.userId == request.auth.uid`.
9. **PII Leak on User Profile**: User A tries to `get` `/users/user-B` -> Rejected by `request.auth.uid == userId`.
10. **Terminal State Tampering**: User tries to revert a `cancelled` booking back to `confirmed` -> Rejected by terminal state guard `existing().status == 'confirmed'`.
11. **Financial Field Tampering on Update**: User updates `totalAmount` from `85` to `0` on an existing booking -> Rejected by `affectedKeys().hasOnly(['status', 'paymentStatus', 'updatedAt'])`.
12. **ID Poisoning / Resource Exhaustion**: Writing a 1500-char document ID or 500-char `turfId` -> Rejected by `isValidId()` (`<= 128`, regex `^[a-zA-Z0-9_\-]+$`).
