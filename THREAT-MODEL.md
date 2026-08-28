# Threat Model — HostelGrievance

## Methodology

This threat model follows a simplified STRIDE analysis across the application's trust boundaries, data flows, and actor roles.

---

## 1. Assets

| Asset | Sensitivity | Description |
|-------|------------|-------------|
| User credentials (email + password) | Critical | Used to authenticate; compromise allows impersonation |
| Session tokens | Critical | Cookie-based; grants full access to a user's account |
| Grievance data | High | Titles, descriptions, categories — contains personal complaints |
| File attachments | High | Images uploaded as evidence; may contain sensitive content |
| Comments | Medium | Communication between students and wardens |
| User profile (name, email, room) | Medium | PII that should not be leaked to unauthorized users |
| Application configuration | Medium | Database path, upload directory, API port |
| Database file | High | SQLite file contains all application data |
| Audit logs | Medium | Security event trail for incident investigation |

---

## 2. Actors

| Actor | Trust Level | Capabilities |
|-------|------------|-------------|
| **Unauthenticated user** | Untrusted | Can attempt login; no other access |
| **Student (authenticated)** | Trusted (limited) | Create/edit own grievances; comment on own grievances; upload attachments to own grievances; view own data only |
| **Warden (authenticated)** | Trusted (elevated) | View all grievances; update status (not content); comment on any grievance |
| **Compromised student** | Adversary | May attempt IDOR, privilege escalation, injection |
| **External attacker** | Adversary | May attempt brute-force, session hijacking, CSRF, XSS |

---

## 3. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Frontend (Svelte)                   │  │
│  │  - Route guards (role-based navigation)               │  │
│  │  - localStorage session cache                         │  │
│  └───────────────────────────┬───────────────────────────┘  │
├──────────────────────────────┼──────────────────────────────┤
│                     TRUST BOUNDARY 1                       │
│              (Browser ↔ API Network Boundary)               │
├──────────────────────────────┼──────────────────────────────┤
│                       API (Hono)                            │
│  ┌───────────────────────────┴───────────────────────────┐  │
│  │  Middleware: Security headers, CORS, DB injection     │  │
│  │  Auth: Session cookie validation                      │  │
│  │  Routes: Input validation, RBAC checks                │  │
│  └───────────────────────────┬───────────────────────────┘  │
├──────────────────────────────┼──────────────────────────────┤
│                     TRUST BOUNDARY 2                       │
│                   (API ↔ Database/Filesystem)               │
├──────────────────────────────┼──────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────────────────┐  │
│  │   SQLite Database  │  │     Filesystem (uploads/)     │  │
│  │   (data/hostel.db) │  │  - Stored attachment bytes    │  │
│  └───────────────────┘  └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Trust Boundaries:

1. **Browser ↔ API**: Network boundary. Enforced by HTTPS (production), CORS, session cookies with `sameSite`, and security headers.
2. **Frontend ↔ API**: Frontend route guards are UX-only. All authorization is enforced server-side via `requireUser()` and `assertCanViewGrievance()`.
3. **API ↔ Database**: Parameterized queries prevent SQL injection. Foreign keys enforce referential integrity.
4. **API ↔ Filesystem**: Stored filenames are server-generated random hex. Path traversal checks in `readStoredFile()`. File type validation on upload.
5. **User ↔ Session**: Session tokens are cryptographically random (32 bytes). `httpOnly` prevents JavaScript access. `secure` ensures HTTPS-only.

---

## 4. Attack Surface

### 4.1 Network-Facing Endpoints

| Endpoint | Method | Auth Required | Role Restriction | Key Controls |
|----------|--------|--------------|-----------------|--------------|
| `/api/health` | GET | No | None | Informational only |
| `/api/login` | POST | No | None | Rate limiting, credential validation |
| `/api/logout` | POST | Yes | Any | Session destruction |
| `/api/me` | GET | Yes | Any | Returns own profile |
| `/api/grievances` | GET | Yes | Student: own only; Warden: all | IDOR check |
| `/api/grievances` | POST | Yes | Student only | Input validation |
| `/api/grievances/:id` | GET | Yes | Owner or Warden | IDOR check |
| `/api/grievances/:id` | PATCH | Yes | Owner (content) or Warden (status) | RBAC + IDOR |
| `/api/grievances/:id/comments` | GET | Yes | Owner or Warden | IDOR check |
| `/api/grievances/:id/comments` | POST | Yes | Owner or Warden | IDOR check |
| `/api/grievances/:id/attachments` | POST | Yes | Student owner only | File type/size validation, IDOR |
| `/api/attachments/:id` | GET | Yes | Owner or Warden | IDOR check, path traversal prevention |

### 4.2 Input Vectors

| Vector | Risk | Mitigation |
|--------|------|-----------|
| Login email/password | Brute force | Rate limiting (10/15min per IP) |
| Grievance title/description | XSS, injection | Parameterized queries; frontend rendering with Svelte (auto-escaped) |
| File upload (type) | Malicious file execution | MIME type allowlist (images only); stored with random name |
| File upload (size) | DoS / disk exhaustion | 2MB limit enforced server-side |
| Session token | Session fixation | Cryptographically random; `httpOnly`, `secure`, `sameSite` |
| Grievance/comment ID | IDOR | `assertCanViewGrievance()` on every access |
| Original filename | Path traversal | Sanitized; stored filename is server-generated random hex |

---

## 5. Important Attack Paths

### Path 1: Credential Stuffing → Account Takeover
```
Attacker → POST /api/login (reused passwords)
  → Rate limiter blocks after 10 attempts
  → If successful: session cookie issued
  → Session is httpOnly + secure + sameSite=Lax
```
**Blast radius**: Attacker gains full access to one student account.

### Path 2: Session Token Theft → Impersonation
```
XSS or network interception → steals hg_session cookie
  → httpOnly prevents XSS theft
  → secure prevents HTTP transmission
  → sameSite=Lax prevents CSRF
  → If stolen: attacker can use until session expires (7 days) or logout
```
**Blast radius**: Attacker gains full access to victim's account until session invalidated.

### Path 3: IDOR → Unauthorized Data Access
```
Student A → GET /api/grievances/GRV-0003 (Student B's grievance)
  → assertCanViewGrievance() checks student_id === user.id
  → Returns 403 Forbidden
```
**Blast radius**: Blocked after hardening. Previously allowed full data read.

### Path 4: Malicious File Upload → Server Compromise
```
Student → POST /api/grievances/:id/attachments with .php or .html file
  → bufferFromUpload() checks MIME type against allowlist
  → Only image/jpeg, image/png, image/gif, image/webp accepted
  → Stored with random hex filename (no extension from user)
  → readStoredFile() serves with Content-Type from DB (image MIME)
```
**Blast radius**: Blocked. Malicious files cannot be uploaded or executed.

### Path 5: Privilege Escalation → Status Manipulation
```
Student → PATCH /api/grievances/GRV-0001 with { status: "Resolved" }
  → Student case now rejects status field: "Students cannot change grievance status"
  → Returns 403 Forbidden
```
**Blast radius**: Blocked. Only wardens can change grievance status.

---

## 6. Data Flow Diagram

```
[Student Browser]                    [Warden Browser]
       │                                    │
       ▼                                    ▼
   Svelte UI                          Svelte UI
   (Route guard)                      (Route guard)
       │                                    │
       ▼                                    ▼
   fetch('/api/...')                fetch('/api/...')
   credentials: 'include'          credentials: 'include'
       │                                    │
       ▼                                    ▼
┌──────────────────────────────────────────────────┐
│                  Hono API                        │
│  1. Security headers middleware                  │
│  2. CORS check                                   │
│  3. DB injection                                 │
│  4. Route handler:                               │
│     a. requireUser() → validate session          │
│     b. assertCanViewGrievance() → RBAC           │
│     c. Input validation                          │
│     d. Parameterized SQL                         │
│     e. Response (no password_hash leaked)        │
└────────────────────┬─────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼                     ▼
    SQLite DB             Filesystem
    (WAL mode)            (uploads/)
    (FK enforced)         (random names)
```

---

## 7. Residual Risks

| Risk | Severity | Reason |
|------|----------|--------|
| No Content-Security-Policy header | Medium | Requires frontend-specific tuning; misconfiguration could break the app |
| No HTTPS enforcement | Medium | Application listens on HTTP; production deployment needs reverse proxy |
| In-memory rate limiter | Low | Lost on restart; not suitable for multi-instance deployment |
| No CSRF token (relies on SameSite) | Low | `sameSite: 'Lax'` protects state-changing POST/PUT/PATCH; less protection for GET-based state changes |
| No account lockout | Low | Rate limiting limits brute-force but doesn't lock accounts |
| Weak password policy | Low | No minimum length or complexity enforced; `student123` is weak |
| No request body size limit | Low | Hono default limits apply; explicit `bodyLimit` middleware could be added |
| SQLite single-writer | Low | Not a security issue but a scalability concern |
