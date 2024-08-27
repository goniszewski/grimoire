import { createFile } from '$lib/database/repositories/File.repository';
import { fileSchema } from '$lib/database/schema';
import { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import { createSlug } from '$lib/utils/create-slug';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const ROOT_DIR = `${process.cwd()}/data/user-uploads`;

const getFileExtFromMimeType = (mimeType: string) => {
	const [, ext] = mimeType.split('/');

	if (!ext) {
		return null;
	}

	if (ext.includes('icon')) return 'ico';
	if (ext.includes('svg')) return 'svg';

	return ext;
};

const getDefaultFileNameFromMimeType = (mimeType: string) => {
	if (mimeType === '') {
		return null;
	}
	const [type] = mimeType.split('/');
	return `${type}.${getFileExtFromMimeType(mimeType)}`;
};

export class Storage {
	async storeFile(
		fileData: Blob,
		ownerId: number,
		details: {
			relatedEntityId?: number;
			source?: FileSourceEnum;
			fileName?: string;
		}
	) {
		const { relatedEntityId, source, fileName } = details;
		const mimeType = fileData.type;
		const size = fileData.size;
		const fileExt =
			(fileName || fileData.name)?.split('.').pop() || getFileExtFromMimeType(mimeType);

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
			fileName: fileName || fileData.name || getDefaultFileNameFromMimeType(mimeType) || 'unknown',
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

		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer], {
			type: response.headers.get('content-type') || undefined
		});
		const fileName = `${createSlug(title)}.${url.split('.').pop()?.split('?')[0]}`;

		return await storage.storeFile(blob as Blob, ownerId, {
			fileName
		});
	}
}
