import type { fileSchema, userSchema } from '$lib/database/schema';
import type { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import type { InferSelectModel } from 'drizzle-orm';

export type FileDbo = InferSelectModel<typeof fileSchema> & {
	owner?: InferSelectModel<typeof userSchema>;
	source?: FileSourceEnum;
	storageType?: FileStorageTypeEnum;
};
