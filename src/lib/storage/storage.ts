import { fileSchema } from '$lib/database/schema';
import { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import { createSlug } from '$lib/utils/create-slug';
import { file } from 'bun';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { db } from '../database/db';

import type { BunFile } from 'bun';

const ROOT_DIR = `${process.cwd()}/data/user-uploads`;

export class Storage {
	async storeFile(
		fileData: BunFile | Blob,
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

		console.log('Storing file', {
			ownerId,
			relatedEntityId,
			source,
			fileName,
			mimeType,
			size,
			fileExt,
			generatedId,
			relativePath,
			absoluteFilePath
		});

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
			const arrayBuffer = await fetch(url).then((r) => r.arrayBuffer());
			const fileName = `${createSlug(title)}.${url.split('.').pop()}`;
			const imageFile = file(arrayBuffer);

			const [{ id }] = await storage.storeFile(imageFile, {
				ownerId,
				fileName
			});
			return id;
		}
	}
}
