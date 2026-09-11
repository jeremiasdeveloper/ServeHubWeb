# ServeHub 1.0 — Authentication

## Password Hashing

All passwords are hashed with **Argon2id** (`@node-rs/argon2`):
- memoryCost: 19456 KiB
- timeCost: 2
- parallelism: 1

Plaintext passwords are never stored or logged.

## Sessions

- Opaque 32-byte random hex token
- Stored in the `Session` table with a 12-hour TTL
- Transmitted via `Authorization: Bearer <token>` header or HttpOnly cookie
- Cleared on logout or expiry

## First Administrator

Created during the First-Run Setup wizard. No pre-seeded production users.

## Employee Accounts

Created exclusively by administrators via the Employees view. There is no
self-registration on any platform.

## Authorization

Every API route enforces permissions server-side:

1. `resolveUser(req)` extracts and validates the session token.
2. `hasPermission(user, "perm")` checks the resolved permission set.
3. 401/403 responses for unauthorized/unauthenticated requests.

The frontend never sends trusted authorization flags. All permission
decisions are made by the server based on the user's role and stored
permission overrides.

## Disabled Users

Deactivated users (`active: false`) cannot log in. Their sessions are
rejected on token validation.
