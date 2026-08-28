import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with configurable algorithm.
 * Uses PBKDF2-SHA256 with 600,000 iterations (OWASP 2024 recommendation).
 * Format: pbkdf2:600000:<salt_hex>:<hash_hex>
 */
const SCHEME = 'pbkdf2';
const ITERATIONS = 600_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
	return `${SCHEME}:${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const parts = stored.split(':');
	if (parts.length !== 4) {
		// Legacy SHA256 format: sha256:<hash>
		if (parts.length === 2 && parts[0] === 'sha256') {
			return verifyLegacySha256(password, parts[1]);
		}
		return false;
	}
	const [scheme, iterationsStr, salt, expectedHash] = parts;
	if (scheme !== SCHEME || !salt || !expectedHash) return false;
	const iterations = Number.parseInt(iterationsStr, 10);
	if (Number.isNaN(iterations) || iterations < 100_000) return false;

	const actual = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST);
	const expected = Buffer.from(expectedHash, 'hex');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}

/** Verify legacy SHA256 hashes (for migration only — no salt) */
function verifyLegacySha256(password: string, hash: string): boolean {
	const actual = createHash('sha256').update(password).digest();
	const expected = Buffer.from(hash, 'hex');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}
