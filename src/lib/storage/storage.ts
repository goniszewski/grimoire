import { fileSchema } from '$lib/database/schema';
import { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import { createSlug } from '$lib/utils/create-slug';
import { BunFile, file, type } from 'bun';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { db } from '../database/db';

const ROOT_DIR = `${process.cwd()}/data/user-uploads`;

export class Storage {
	async storeFile(
		fileData: BunFile,
		details: {
			ownerId: number;
			relatedEntityId?: string;
			source?: FileSourceEnum;
			fileName?: string;
		}
	) {
		const { ownerId, relatedEntityId, source, fileName } = details;
		const mimeType = fileData.type;
		const size = fileData.size;
		const fileExt = fileName || (fileData.name?.split('.').pop() as string);

		const generatedId = randomUUID();

		const relativePathParts = [ownerId, relatedEntityId, `${generatedId}.${fileExt}`].filter(
			Boolean
		) as string[];
		const relativePath = path.join(...relativePathParts);
		const absoluteFilePath = `${ROOT_DIR}/${relativePath}`;

		await Bun.write(absoluteFilePath, fileData);

		return await db
			.insert(fileSchema)
			.values({
				storageType: FileStorageTypeEnum.Local,
				fileName: fileData.name,
				size,
				mimeType,
				relativePath,
				source,
				ownerId
			})
			.returning();
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
