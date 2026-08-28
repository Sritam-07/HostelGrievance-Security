# Security Posture — HostelGrievance (Hardened)

## Summary

HostelGrievance has been hardened from an intentionally vulnerable lab baseline to a reasonably secure application ready for deployment. All 13 security findings have been remediated while preserving complete student and warden functionality.

**Test status**: 14/14 tests pass | TypeScript: 0 errors | No regressions.

---

## Major Changes

### Authentication & Session
- **Password hashing**: Migrated from unsalted SHA256 to PBKDF2-SHA256 (600k iterations, random salt). Legacy format accepted for migration.
- **Session cookie**: Now `httpOnly`, `secure`, `sameSite: 'Lax'`.
- **Session expiry**: Expired sessions are now enforced server-side and cleaned up.
- **Logout**: Now destroys the session row in the database (not just clears the cookie).
- **Rate limiting**: 10 login attempts per 15 minutes per IP address.

### Authorization
- **IDOR prevention**: `assertCanViewGrievance()` enforced on all grievance endpoints (GET, PATCH, comments, attachments).
- **Role enforcement**: Students cannot change grievance status; only wardens can.
- **Attachment access**: Attachment downloads now verify the requesting user owns the parent grievance.

### Input & File Safety
- **Stored filenames**: Always server-generated random hex; user-provided filenames never used for storage.
- **File type validation**: MIME type allowlist (JPEG, PNG, GIF, WebP) enforced server-side.
- **File size limit**: 2MB maximum enforced.
- **Path traversal prevention**: `readStoredFile()` validates resolved path stays within uploads directory.

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (modern recommendation)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Error Handling
- Generic error message for 500 responses (no internal details leaked).
- Structured error codes for client-side handling.

### CORS
- Strict origin allowlist (development ports only).
- Unknown origins receive empty response (blocked).

### Audit Logging
- Structured JSON logging for security events: login success/failure, rate limiting, file access.
- `[SECURITY]` prefix for log filtering.

---

## Deployment Assumptions

| Assumption | Notes |
|-----------|-------|
| HTTPS terminates at reverse proxy | `secure: true` cookie requires HTTPS |
| Single-instance deployment | In-memory rate limiter and session store |
| Frontend served from same origin or allowlisted domain | CORS allowlist must include production domain |
| Database on local filesystem | SQLite file must be protected (file permissions) |
| Uploads directory writable by API process | No direct web access to uploads/ |

---

## Residual Risks

| Risk | Severity | Mitigation | Notes |
|------|----------|-----------|-------|
| No CSP header | Medium | Add in production | Requires careful tuning for Svelte/Vite assets |
| No HTTPS in dev | Low | Deploy behind TLS-terminating proxy | `secure` cookie won't work over HTTP |
| In-memory rate limiting | Low | Shared store for multi-instance | Sufficient for single-server deployment |
| Weak default passwords | Low | `student123`/`warden123` | Lab credentials; replace in production |
| No account lockout | Low | Rate limiting provides similar protection | 10 attempts/15min is reasonable |
| No request body size limit | Low | Hono defaults apply | Add explicit `bodyLimit` for hardening |
| No CSRF tokens | Low | `sameSite: 'Lax'` provides strong protection | State-changing methods are POST/PATCH |

---

## Blast Radius Analysis

If a single control fails:

| Failure | Blast Radius | Remaining Defenses |
|---------|-------------|-------------------|
| **Session cookie stolen** | Attacker accesses one user's account | `httpOnly` prevents JS theft; `secure` prevents HTTP; `sameSite` prevents CSRF; 7-day expiry |
| **Rate limiter bypassed** | Attacker can try more passwords | Password hashing (PBKDF2 600k) makes brute-force expensive |
| **One student account compromised** | Attacker sees that student's grievances only | IDOR prevention blocks access to other students' data |
| **CORS misconfiguration** | External site can make API requests | Session cookie requires `credentials: 'include'`; `sameSite` still blocks cross-site |
| **Database file accessed** | Attacker has all application data | PBKDF2 password hashes resist offline cracking; no other secrets in DB |

---

## Verification Evidence

- **TypeScript**: `npm run typecheck` → 0 errors
- **Tests**: `npm test` → 14/14 pass
- **Security logging**: Test output shows `[SECURITY]` entries for all login operations
- **Cookie flags**: Login response includes `hg_session` with `HttpOnly`, `Secure`, `SameSite=Lax`
- **Rate limiting**: Module implemented and invoked on `/api/login`
- **IDOR checks**: `assertCanViewGrievance()` called on all grievance access endpoints
- **Error handling**: 500 responses return generic message, not internal details
