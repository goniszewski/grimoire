import { createSlug } from './create-slug';

import type PocketBase from 'pocketbase';
export async function prepareTags(
	pb: PocketBase,
	tags: {
		label: string;
		value: string;
	}[],
	owner: string
) {
	const createTags = tags.filter(
		(tag: { label: string; value: string }) => tag.value === tag.label
	);
	const existingTags = tags.reduce((acc: string[], tag: { label: string; value: string }) => {
		if (tag.value !== tag.label) {
			acc.push(tag.value);
		}
		return acc;
	}, []);

	const createdTags = await Promise.all(
		createTags.map(async (tag: { label: string; value: string }) => {
			const { id } = await pb.collection('tags').create(
				{
					name: tag.label,
					slug: createSlug(tag.label),
					owner
				},
				{
					$cancelKey: tag.label
				}
			);

			return id;
		})
	);

	return [...existingTags, ...createdTags];
}
