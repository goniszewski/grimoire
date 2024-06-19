import type { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import type { User } from './User.type';

export type File = {
	id: number;
	fileName: string;
	storageType: FileStorageTypeEnum;
	relativePath: string;
	size: number | null;
	mimeType: string;
	source: FileSourceEnum;
	ownerId: number;
	owner?: User | null;
	created: Date | null;
	updated: Date | null;
};
