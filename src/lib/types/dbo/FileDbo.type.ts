import type { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import type { UserDbo } from './UserDbo.type';

export type FileDbo = {
	id: number;
	fileName: string;
	storageType: FileStorageTypeEnum;
	relativePath: string;
	size: number | null;
	mimeType: string;
	source: FileSourceEnum;
	ownerId: number;
	owner?: UserDbo | null;
	created: Date | null;
	updated: Date | null;
};
