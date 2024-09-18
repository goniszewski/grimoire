import type {
	bookmarkSchema,
	categorySchema,
	fileSchema,
	sessionSchema,
	tagSchema,
	userSchema
} from '$lib/database/schema';
import type { UserSettings } from '../UserSettings.type';
import type { InferSelectModel } from 'drizzle-orm';

export type UserDbo = InferSelectModel<typeof userSchema> & {
	settings?: UserSettings;
	bookmarks?: InferSelectModel<typeof bookmarkSchema>[];
	categories?: InferSelectModel<typeof categorySchema>[];
	tags?: InferSelectModel<typeof tagSchema>[];
	files?: InferSelectModel<typeof fileSchema>[];
	sessions?: InferSelectModel<typeof sessionSchema>[];
};
