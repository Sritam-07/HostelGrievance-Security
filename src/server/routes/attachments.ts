import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import { assertCanViewGrievance, findAttachmentRow, requireGrievance } from '../db/queries.ts';
import { readStoredFile } from '../storage/attachments.ts';
import { HttpError } from '../http/errors.ts';
import { logSecurityEvent } from '../http/logging.ts';

export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.get('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = findAttachmentRow(db, c.req.param('id'));
	if (!row) {
		throw new HttpError(404, 'not_found', 'Attachment was not found.');
	}
	const grievance = requireGrievance(db, row.grievance_id);
	assertCanViewGrievance(user, grievance);

	logSecurityEvent('file_download', {
		userId: user.id,
		attachmentId: row.id,
		grievanceId: row.grievance_id
	});

	const bytes = readStoredFile(c.get('uploadsDir'), row.stored_filename);
	c.header('Content-Type', row.mime_type);
	c.header('Content-Length', String(bytes.length));
	c.header(
		'Content-Disposition',
		`inline; filename="${row.original_filename.replaceAll('"', '')}"`
	);
	return c.body(new Uint8Array(bytes));
});
