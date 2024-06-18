import { serializeTag } from '$lib/utils/serialize-dbo-entity';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { tagSchema } from '../schema';
import { mapRelationsToWithStatements } from './common';

import type { Tag } from '$lib/types/Tag.type';
import type { TagDbo } from '$lib/types/dbo/TagDbo.type';

enum TagRelations {
	OWNER = 'owner'
}
const allTagRelations: TagRelations[] = Object.values(TagRelations);

export const getTagById = async (
	id: number,
	ownerId: number,
	relations: TagRelations[] = allTagRelations
): Promise<Tag | null> => {
	const tag = await db.query.tagSchema.findFirst({
		where: and(eq(tagSchema.id, id), eq(tagSchema.ownerId, ownerId)),
		with: mapRelationsToWithStatements(relations)
	});

	return tag ? serializeTag(tag) : null;
};

const orderKeys = {
	created: tagSchema.created,
	name: tagSchema.name,
	slug: tagSchema.slug
};

export const getTagsByUserId = async (
	userId: number,
	options?: {
		orderBy?: keyof typeof orderKeys;
		orderDirection?: 'asc' | 'desc';
		limit?: number;
		page?: number;
	},
	relations: TagRelations[] = allTagRelations
): Promise<Tag[]> => {
	const tags = await db.query.tagSchema.findMany({
		limit: options?.limit,
		offset: options?.page && options?.limit && (options.page - 1) * options.limit,
		orderBy:
			options?.orderBy &&
			(options.orderDirection === 'asc'
				? asc(orderKeys[options.orderBy])
				: desc(orderKeys[options.orderBy])),
		where: eq(tagSchema.ownerId, userId),
		with: mapRelationsToWithStatements(relations)
	});

	return tags.map(serializeTag);
};

export const createTag = async (tagData: typeof tagSchema.$inferInsert): Promise<Tag> => {
	const [tag]: TagDbo[] = await db.insert(tagSchema).values(tagData).returning();

	return serializeTag(tag);
};

export const updateTag = async (
	id: number,
	ownerId: number,
	tagData: Partial<typeof tagSchema.$inferInsert>
): Promise<Tag> => {
	const [tag]: TagDbo[] = await db
		.update(tagSchema)
		.set(tagData)
		.where(and(eq(tagSchema.id, id), eq(tagSchema.ownerId, ownerId)))
		.returning();

	return serializeTag(tag);
};

export const deleteTag = async (id: number, ownerId: number): Promise<void> => {
	await db.delete(tagSchema).where(and(eq(tagSchema.id, id), eq(tagSchema.ownerId, ownerId)));
};

export const fetchTagCountByUserId = async (userId: number): Promise<number> => {
	const [{ count: tagCount }] = await db
		.select({ count: count(tagSchema.id) })
		.from(tagSchema)
		.where(eq(tagSchema.ownerId, userId));

	return tagCount;
};
