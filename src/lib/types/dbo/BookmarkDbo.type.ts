import type { InferSelectModel } from 'drizzle-orm';
import type {
	bookmarkSchema,
	bookmarksToTagsSchema,
	categorySchema,
	fileSchema,
	tagSchema,
	userSchema
} from '$lib/database/schema';

export type BookmarkDbo = InferSelectModel<typeof bookmarkSchema> & {
	tags?: (InferSelectModel<typeof bookmarksToTagsSchema> & {
		tag: InferSelectModel<typeof tagSchema>;
		bookmark: InferSelectModel<typeof bookmarkSchema>;
	})[];
	owner?: InferSelectModel<typeof userSchema>;
	category?: InferSelectModel<typeof categorySchema>;
	mainImage?: InferSelectModel<typeof fileSchema>;
	icon?: InferSelectModel<typeof fileSchema>;
	screenshot?: InferSelectModel<typeof fileSchema>;
};
