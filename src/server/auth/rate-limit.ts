/**
 * In-memory rate limiter for authentication endpoints.
 * Tracks attempts per IP address with a sliding window.
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL = 60 * 1000; // Clean up every minute

// Periodic cleanup to prevent memory leak
let lastCleanup = Date.now();
function cleanup(): void {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;
	for (const [key, entry] of attempts) {
		if (now > entry.resetAt) {
			attempts.delete(key);
		}
	}
}

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfterMs: number } {
	cleanup();

	const now = Date.now();
	const entry = attempts.get(identifier);

	if (!entry || now > entry.resetAt) {
		// New window
		attempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
		return { allowed: true, retryAfterMs: 0 };
	}

	if (entry.count >= MAX_ATTEMPTS) {
		return { allowed: false, retryAfterMs: entry.resetAt - now };
	}

	entry.count++;
	return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimit(identifier: string): void {
	attempts.delete(identifier);
}
