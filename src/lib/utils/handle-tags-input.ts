import { tagSchema as tagSchema } from '$lib/database/schema';

import { createSlug } from './create-slug';

import type { DB } from '$lib/database/db';
export async function prepareTags(
	db: DB,
	tags: {
		label: string;
		value: number | string;
	}[],
	ownerId: number
) {
	const createTags = tags.filter(
		(tag: { label: string; value: number | string }) => tag.value === tag.label
	);
	const existingTags = tags.reduce(
		(acc: number[], tag: { label: string; value: number | string }) => {
			if (tag.value !== tag.label) {
				acc.push(+tag.value);
			}
			return acc;
		},
		[]
	);
	console.log({ createTags, existingTags });

	const createdTags = await Promise.all(
		createTags.map(async (tag: { label: string; value: number | string }) => {
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
