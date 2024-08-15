import { createFile } from '$lib/database/repositories/File.repository';
import { fileSchema } from '$lib/database/schema';
import { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import { createSlug } from '$lib/utils/create-slug';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const ROOT_DIR = `${process.cwd()}/data/user-uploads`;

const getFileExtFromMimeType = (mimeType: string) => {
	const [, ext] = mimeType.split('/');
	return ext;
};

const getDefaultFileNameFromMimeType = (mimeType: string) => {
	const [type] = mimeType.split('/');
	return `${type}.${getFileExtFromMimeType(mimeType)}`;
};

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
		const fileExt = fileName || fileData.name?.split('.').pop() || getFileExtFromMimeType(mimeType);

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
			fileName: fileData.name || getDefaultFileNameFromMimeType(mimeType),
			size,
			mimeType,
			relativePath,
			source: source || FileSourceEnum.Upload,
			ownerId,
			updated: new Date()
		};

		const file = await createFile(ownerId, fileDetails);

		return file;
	}

	async storeImage(url: string, title: string, ownerId: number) {
		const storage = new Storage();

		if (!url || url.length === 0) {
			throw new Error('Invalid URL');
		}

		const blob = await fetch(url).then((r) => r.blob());
		const fileName = `${createSlug(title)}.${url.split('.').pop()?.split('?')[0]}`;

		return await storage.storeFile(blob, {
			ownerId,
			fileName
		});
	}
}
