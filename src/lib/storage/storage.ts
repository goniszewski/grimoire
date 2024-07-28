import { fileSchema } from '$lib/database/schema';
import { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import { createSlug } from '$lib/utils/create-slug';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { db } from '../database/db';

const ROOT_DIR = `${process.cwd()}/data/user-uploads`;

export class Storage {
	async storeFile(
		fileData: Blob,
		details: {
			ownerId: number;
			relatedEntityId?: number;
			source?: FileSourceEnum;
			fileName?: string;
		}
	) {
		const { ownerId, relatedEntityId, source, fileName } = details;
		const mimeType = fileData.type;
		const size = fileData.size;
		const fileExt = fileName || fileData.name?.split('.').pop();

		const generatedId = randomUUID();

		const relativePathParts = [ownerId, relatedEntityId, `${generatedId}.${fileExt}`]
			.filter(Boolean)
			.map(String);
		const relativePath = path.join(...relativePathParts);
		const absoluteFilePath = `${ROOT_DIR}/${relativePath}`;

		await Bun.write(absoluteFilePath, fileData).catch((e) => {
			console.error('Error storing file', e);
		});

		const fileDetails: typeof fileSchema.$inferInsert = {
			storageType: FileStorageTypeEnum.Local,
			fileName: fileData.name || 'unknown',
			size,
			mimeType,
			relativePath,
			source: source || FileSourceEnum.Upload,
			ownerId
		};

		return await db.insert(fileSchema).values(fileDetails).returning();
	}

	async storeImage(url: string, title: string, ownerId: number) {
		const storage = new Storage();

		if (url && url.length > 0) {
			const blob = await fetch(url).then((r) => r.blob());
			const fileName = `${createSlug(title)}.${url.split('.').pop()}`;

			const [{ id }] = await storage.storeFile(blob, {
				ownerId,
				fileName
			});
			return id;
		}
	}
}
