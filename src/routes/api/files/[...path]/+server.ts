import { db } from '$lib/database/db';
import { fileSchema } from '$lib/database/schema';
import { and, eq } from 'drizzle-orm';
import path from 'node:path';

import { error } from '@sveltejs/kit';

import type { RequestHandler } from '@sveltejs/kit';
const ROOT_DIR = `${process.cwd()}/data/user-uploads`;

export const GET: RequestHandler = async ({ params }) => {
	const pathParts = params.path?.split('/');

	if (!pathParts) throw error(404, 'File not found');
	const [userId, fileId] = pathParts;

	try {
		const [file] = await db
			.select({
				relativePath: fileSchema.relativePath,
				mimeType: fileSchema.mimeType
			})
			.from(fileSchema)
			.where(
				and(eq(fileSchema.ownerId, parseInt(userId, 10)), eq(fileSchema.id, parseInt(fileId, 10)))
			);

		if (!file?.relativePath) throw error(404, 'File not found');

		const filePath = path.join(ROOT_DIR, file.relativePath);
		const fileData = Bun.file(filePath);

		return new Response(fileData, {
			headers: {
				...(file.mimeType && {
					'Content-Type': file.mimeType
				})
			}
		});
	} catch (err) {
		console.error('Error reading file:', err);
		throw error(404, 'File not found');
	}
};
