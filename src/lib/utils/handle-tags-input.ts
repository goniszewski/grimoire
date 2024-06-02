import { tagSchema as tagSchema } from '$lib/database/schema';

import { createSlug } from './create-slug';

import type { DB } from '$lib/database/db';
export async function prepareTags(
	db: DB,
	tags: {
		label: string;
		value: string;
	}[],
	ownerId: number
) {
	const createTags = tags.filter(
		(tag: { label: string; value: string }) => tag.value === tag.label
	);
	const existingTags = tags.reduce((acc: number[], tag: { label: string; value: string }) => {
		if (tag.value !== tag.label) {
			acc.push(parseInt(tag.value, 10));
		}
		return acc;
	}, []);

	const createdTags = await Promise.all(
		createTags.map(async (tag: { label: string; value: string }) => {
			const [{ id }] = await db
				.insert(tagSchema)
				.values({
					name: tag.label,
					slug: createSlug(tag.label),
					ownerId
				})
				.returning();

			return id;
		})
	);

	return [...existingTags, ...createdTags];
}
