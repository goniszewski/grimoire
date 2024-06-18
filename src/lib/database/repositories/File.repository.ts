import { serializeFile } from '$lib/utils/serialize-dbo-entity';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { fileSchema } from '../schema';
import { mapRelationsToWithStatements } from './common';

import type { File } from '$lib/types/File.type';
import type { FileDbo } from '$lib/types/dbo/FileDbo.type';

enum FileRelations {
	OWNER = 'owner'
}
const allFileRelations: FileRelations[] = Object.values(FileRelations);

export const getFileById = async (
	id: number,
	ownerId: number,
	relations: FileRelations[] = allFileRelations
): Promise<File | null> => {
	const file = await db.query.fileSchema.findFirst({
		where: and(eq(fileSchema.id, id), eq(fileSchema.ownerId, ownerId)),
		with: mapRelationsToWithStatements(relations)
	});

	return file ? serializeFile(file) : null;
};

const orderKeys = {
	created: fileSchema.created,
	fileName: fileSchema.fileName,
	size: fileSchema.size
};

export const getFilesByUserId = async (
	userId: number,
	options?: {
		orderBy?: keyof typeof orderKeys;
		orderDirection?: 'asc' | 'desc';
		limit?: number;
		page?: number;
	},
	relations: FileRelations[] = allFileRelations
): Promise<File[]> => {
	const files = await db.query.fileSchema.findMany({
		limit: options?.limit,
		offset: options?.page && options?.limit && (options.page - 1) * options.limit,
		orderBy:
			options?.orderBy &&
			(options.orderDirection === 'asc'
				? asc(orderKeys[options.orderBy])
				: desc(orderKeys[options.orderBy])),
		where: eq(fileSchema.ownerId, userId),
		with: mapRelationsToWithStatements(relations)
	});

	return files.map(serializeFile);
};

export const createFile = async (fileData: typeof fileSchema.$inferInsert): Promise<File> => {
	const [file]: FileDbo[] = await db.insert(fileSchema).values(fileData).returning();

	return serializeFile(file);
};

export const updateFile = async (
	id: number,
	ownerId: number,
	fileData: Partial<typeof fileSchema.$inferInsert>
): Promise<File> => {
	const [file]: FileDbo[] = await db
		.update(fileSchema)
		.set(fileData)
		.where(and(eq(fileSchema.id, id), eq(fileSchema.ownerId, ownerId)))
		.returning();

	return serializeFile(file);
};

export const deleteFile = async (id: number, ownerId: number): Promise<void> => {
	await db.delete(fileSchema).where(and(eq(fileSchema.id, id), eq(fileSchema.ownerId, ownerId)));
};

export const fetchFileCountByUserId = async (userId: number): Promise<number> => {
	const [{ count: fileCount }] = await db
		.select({ count: count(fileSchema.id) })
		.from(fileSchema)
		.where(eq(fileSchema.ownerId, userId));

	return fileCount;
};
