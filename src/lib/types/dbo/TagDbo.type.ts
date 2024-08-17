import type { tagSchema, userSchema } from '$lib/database/schema';
import type { InferSelectModel } from 'drizzle-orm';

export type TagDbo = InferSelectModel<typeof tagSchema> & {
	owner?: InferSelectModel<typeof userSchema>;
};
