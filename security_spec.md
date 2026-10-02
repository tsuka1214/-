# Security Specification - Brass Band Attendance App

## Data Invariants
1. App settings (`/config/app_settings`) should only be writable by administrators.
2. Attendance records must have a valid date and member name.
3. Notifications are broadcasted to all but only manageable by the system or admins.
4. Member list is a shared resource manageable by admins.

## The "Dirty Dozen" Payloads (Denial Expected)
1. Unauthorized settings update: `setDoc(doc(db, 'config', 'app_settings'), { adminPasscode: 'hacked' })` without admin session.
2. Invalid attendance date: `addDoc(collection(db, 'attendances'), { date: 'not-a-date', ... })`
3. Spoofing author token: `addDoc(collection(db, 'attendances'), { authorDeviceToken: 'someone-else-token', ... })`
4. Deleting members as a regular user.
5. Injecting huge strings into member names.
6. Modifying another user's attendance record (if ownership was enforced).
7. Setting a penalty stage with a negative threshold.
8. Clearing all notifications as a regular user.
9. Modifying `createdAt` field after creation.
10. Creating an attendance record for a future date (business logic invariant).
11. Injecting scripts into reason fields.
12. Bulk deleting records as a regular user.

## Security Rule Strategy
Since this app currently uses a "Passphrase" for admin mode without Firebase Authentication, server-side security is limited. For production, Firebase Auth should be enabled to strictly enforce `isAdmin()` rules.

The rules below provide:
1. Path-based isolation.
2. Type and size validation.
3. Default-deny catch-all.
