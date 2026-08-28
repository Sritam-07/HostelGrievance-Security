# 🚀 How to Run HostelGrievance

## Prerequisites

- **Node.js** (v18 or higher) — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

## Quick Start

```bash
# 1. Open terminal in project folder
cd hostelgrievance-security-hardening

# 2. Install dependencies
npm install

# 3. Reset database with sample data
npm run db:reset

# 4. Start the application
npm run dev:all
```

## Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Student | student@example.test | student123 |
| Student | priya@example.test | student123 |
| Student | rohan@example.test | student123 |
| Warden | warden@example.test | warden123 |

## Test Security Features

```bash
# Run all tests (14 tests)
npm test

# Type check
npm run typecheck
```

## Project Structure

```
├── src/
│   ├── server/        # Backend (Hono API)
│   └── lib/           # Frontend (Svelte 5)
├── data/              # SQLite database
├── uploads/           # File attachments
├── HARDENING.md       # Security findings
├── THREAT-MODEL.md    # Threat analysis
├── SECURITY.md        # Security posture
└── TEST-EVIDENCE/     # Test results
```

## Security Features Implemented

1. ✅ PBKDF2 password hashing (600k iterations)
2. ✅ Secure session cookies (httpOnly, secure, sameSite)
3. ✅ IDOR prevention
4. ✅ Rate limiting (10 attempts/15 min)
5. ✅ Security headers (5 headers)
6. ✅ CORS protection
7. ✅ Audit logging
8. ✅ Input validation
9. ✅ File upload security
10. ✅ Error handling (no internal leaks)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3001 in use | Kill existing process or restart |
| Database locked | Run `npm run db:reset` |
| Dependencies missing | Run `npm install` |
| TypeScript errors | Run `npm run typecheck` |

## Contact

For any issues, contact the development team.
