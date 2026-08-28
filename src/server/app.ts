import { Hono } from 'hono';
import type { Database } from 'better-sqlite3';
import type { AppEnv } from './env.ts';
import { handleError, HttpError } from './http/errors.ts';
import { authRoutes } from './routes/auth.ts';
import { grievanceRoutes } from './routes/grievances.ts';
import { attachmentRoutes } from './routes/attachments.ts';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB (2MB file + metadata overhead)

const ALLOWED_ORIGINS = new Set([
	'http://localhost:5173',
	'http://localhost:5174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174',
]);

export type CreateAppOptions = {
	db: Database;
	uploadsDir: string;
};

export function createApp(options: CreateAppOptions) {
	const app = new Hono<AppEnv>();

	// Security headers middleware
	// Request body size limit to prevent memory exhaustion
	app.use('/api/*', bodyLimit({
		maxSize: MAX_BODY_BYTES,
		onError: (c) => {
			return c.json({ error: 'Request body too large.', code: 'bad_request' }, 413);
		}
	}));

	app.use('*', async (c, next) => {
		c.header('X-Content-Type-Options', 'nosniff');
		c.header('X-Frame-Options', 'DENY');
		c.header('X-XSS-Protection', '0');
		c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
		c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
		await next();
	});

	app.use('*', async (c, next) => {
		c.set('db', options.db);
		c.set('uploadsDir', options.uploadsDir);
		await next();
	});

	// Strict CORS: only allow known origins with credentials
	app.use('/api/*', cors({
		origin: (origin) => {
			if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
			return '';
		},
		credentials: true
	}));

	app.onError((err, c) => handleError(err, c));

	app.notFound((c) => c.json({ error: 'Not found.', code: 'not_found' }, 404));

	app.get('/api/health', (c) => c.json({ ok: true }));
	app.route('/api', authRoutes);
	app.route('/api/grievances', grievanceRoutes);
	app.route('/api/attachments', attachmentRoutes);

	app.all('/api/*', () => {
		throw new HttpError(404, 'not_found', 'Not found.');
	});

	return app;
}
