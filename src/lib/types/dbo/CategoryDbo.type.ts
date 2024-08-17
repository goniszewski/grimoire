import type { categorySchema, userSchema } from '$lib/database/schema';
import type { InferSelectModel } from 'drizzle-orm';

export type CategoryDbo = InferSelectModel<typeof categorySchema> & {
	owner?: InferSelectModel<typeof userSchema>;
	parent?: InferSelectModel<typeof categorySchema>;
};
