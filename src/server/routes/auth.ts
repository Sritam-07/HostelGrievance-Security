import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { createSession, clearSessionCookie, destroySession, readSessionUser, requireUser, setSessionCookie } from '../auth/session.ts';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE } from '../config.ts';
import { verifyPassword } from '../auth/passwords.ts';
import { findUserByEmail } from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { checkRateLimit, resetRateLimit } from '../auth/rate-limit.ts';
import { logSecurityEvent } from '../http/logging.ts';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', async (c) => {
	const db = c.get('db');
	const clientIp = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
	
	// Rate limit check
	const rateLimit = checkRateLimit(`login:${clientIp}`);
	if (!rateLimit.allowed) {
		logSecurityEvent('rate_limit_exceeded', { ip: clientIp, endpoint: '/api/login' });
		c.header('Retry-After', String(Math.ceil(rateLimit.retryAfterMs / 1000)));
		throw new HttpError(429, 'rate_limited', 'Too many login attempts. Please try again later.');
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	const email = 'email' in body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = 'password' in body && typeof body.password === 'string' ? body.password : '';
	if (!email || !password) {
		throw new HttpError(400, 'bad_request', 'Email and password are required.');
	}
	const user = findUserByEmail(db, email);
	if (!user || !verifyPassword(password, user.password_hash)) {
		logSecurityEvent('login_failed', { email, ip: clientIp });
		throw new HttpError(401, 'unauthenticated', 'Invalid email or password.');
	}
	
	// Successful login - reset rate limit
	resetRateLimit(`login:${clientIp}`);
	logSecurityEvent('login_success', { userId: user.id, email: user.email, ip: clientIp });
	
	const token = createSession(db, user.id);
	setSessionCookie(c, token);
	return c.json({ user: toPublicUser(user) });
});

authRoutes.post('/logout', (c) => {
	const db = c.get('db');
	const token = getCookie(c, SESSION_COOKIE);
	if (token) {
		// Get user info before destroying session for audit log
		const user = readSessionUser(db, token);
		destroySession(db, token);
		if (user) {
			logSecurityEvent('logout', { userId: user.id, email: user.email });
		}
	}
	clearSessionCookie(c);
	return c.json({ ok: true });
});

authRoutes.get('/me', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	return c.json({ user: toPublicUser(user) });
});
