/**
 * Security event logging for audit trail.
 * In production, this would write to a proper logging service.
 * For this lab, we log to console with structured JSON for easy parsing.
 */

type SecurityEventType =
	| 'login_success'
	| 'login_failed'
	| 'logout'
	| 'rate_limit_exceeded'
	| 'unauthorized_access'
	| 'idor_attempt'
	| 'session_expired'
	| 'session_invalid'
	| 'file_upload'
	| 'file_download'
	| 'privilege_escalation_attempt';

interface SecurityEvent {
	timestamp: string;
	event: SecurityEventType;
	details: Record<string, unknown>;
}

export function logSecurityEvent(
	event: SecurityEventType,
	details: Record<string, unknown> = {}
): void {
	const entry: SecurityEvent = {
		timestamp: new Date().toISOString(),
		event,
		details
	};

	// Structured logging - in production, this would go to a SIEM or log aggregator
	console.log(`[SECURITY] ${JSON.stringify(entry)}`);
}

export function logRequest(
	method: string,
	path: string,
	statusCode: number,
	durationMs: number,
	userId?: string
): void {
	const entry = {
		timestamp: new Date().toISOString(),
		type: 'request',
		method,
		path,
		statusCode,
		durationMs,
		userId
	};

	// Log non-2xx responses as potential issues
	if (statusCode >= 400) {
		console.log(`[REQUEST] ${JSON.stringify(entry)}`);
	}
}
