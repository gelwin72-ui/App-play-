# APPVERSE Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Unpublished Isolation**: Applications with status `PENDING`, `UNDER_REVIEW`, `REJECTED`, or `SUSPENDED` must NEVER be readable (`get` or `list`) by guests or other ordinary users. Only `APPROVED` applications are publicly readable.
2. **No Self-Approval or Role Escalation**: Ordinary users cannot create an application with `status != 'PENDING'`, cannot update `status` to `'APPROVED'`, and cannot set `role: 'OWNER'` on `/users/{userId}` or write to `/admins/{userId}`.
3. **PII Isolation**: `/users/{userId}` (containing `email` and account telemetry) is strictly readable only by the owning user or the verified Owner (`isAdmin()`). Public developer profiles live in `/developers/{userId}` without PII.
4. **Verified Identity & Server Timestamps**: Writes by authenticated users require `request.auth.token.email_verified == true` and strict `request.time` timestamp validation.
5. **Immutable Audit Trail**: `/auditLogs/{logId}` documents cannot be updated or deleted by anyone, including admins, preserving forensic integrity.
6. **Strict Schema Enforcement**: Every write checks `keys().hasAll(...)`, `keys().hasOnly(...)`, type bounds, string `.size()` limits, and `isValidId()` regex guards.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with `PERMISSION_DENIED`)
1. **Self-Role Escalation on Create**: Creating `/users/attackerUid` with `{ role: 'OWNER' }` -> Denied (`role == 'USER'` enforced).
2. **Self-Role Escalation on Update**: Updating `/users/attackerUid` to `{ role: 'OWNER' }` or `{ accountStatus: 'ACTIVE' }` when suspended -> Denied (`affectedKeys().hasOnly(...)` excludes `role` and `accountStatus`).
3. **Admin Marker Injection**: Creating `/admins/attackerUid` as an ordinary user -> Denied (`isAdmin()` required).
4. **Unverified Email Upload**: Creating `/applications/app1` with `email_verified: false` -> Denied (`isVerified()` required).
5. **Pre-Approved Application Bypass**: Creating `/applications/app1` with `status: 'APPROVED'` -> Denied (`status == 'PENDING'` enforced on create).
6. **Developer Self-Approval**: Updating `/applications/app1` as developer to `{ status: 'APPROVED' }` -> Denied (`status` change to `APPROVED` restricted to `isAdmin()`).
7. **Shadow Field Injection**: Creating `/applications/app1` with extra ghost field `{ isOfficialVerified: true }` -> Denied (`keys().hasOnly(...)` rejects unknown fields).
8. **Unapproved Listing Scrape**: Querying `collection(db, 'applications')` without `where('status', '==', 'APPROVED')` as guest -> Denied (`allow list` inspects `resource.data.status == 'APPROVED'`).
9. **Cross-User PII Read**: Reading `/users/victimUid` as another authenticated user -> Denied (`isOwner(userId) || isAdmin()` required).
10. **ID Poisoning**: Creating `/applications/../../etc/passwd` or a 500-char ID -> Denied (`isValidId()` regex and length <= 128 enforced).
11. **Unapproved Download Telemetry**: Creating `/downloads/dl1` referencing an unapproved or nonexistent `appId` -> Denied (`get(...).data.status == 'APPROVED'` required).
12. **Audit Log Tampering**: Updating or deleting `/auditLogs/log1` -> Denied (`allow update, delete: if false`).
