import { createSlug } from '$lib/utils/create-slug';
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
	const tag = (await db.query.tagSchema.findFirst({
		where: and(eq(tagSchema.id, id), eq(tagSchema.ownerId, ownerId)),
		with: mapRelationsToWithStatements(relations)
	})) as TagDbo | undefined;

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
	const tags = (await db.query.tagSchema.findMany({
		limit: options?.limit,
		offset: options?.page && options?.limit && (options.page - 1) * options.limit,
		orderBy:
			options?.orderBy &&
			(options.orderDirection === 'asc'
				? asc(orderKeys[options.orderBy])
				: desc(orderKeys[options.orderBy])),
		where: eq(tagSchema.ownerId, userId),
		with: mapRelationsToWithStatements(relations)
	})) as TagDbo[];

	return tags.map(serializeTag);
};

export const getTagByName = async (
	name: string,
	ownerId: number,
	relations: TagRelations[] = allTagRelations
): Promise<Tag | null> => {
	const tag = (await db.query.tagSchema.findFirst({
		where: and(eq(tagSchema.name, name), eq(tagSchema.ownerId, ownerId)),
		with: mapRelationsToWithStatements(relations)
	})) as TagDbo;

	return tag ? serializeTag(tag) : null;
};

export const createTag = async (
	ownerId: number,
	tagData: Omit<typeof tagSchema.$inferInsert, 'ownerId' | 'slug'>
): Promise<Tag> => {
	const [tag]: TagDbo[] = await db
		.insert(tagSchema)
		.values({
			...tagData,
			slug: createSlug(tagData.name),
			ownerId,
			updated: new Date()
		})
		.returning();

	return serializeTag(tag);
};

export const updateTag = async (
	id: number,
	ownerId: number,
	tagData: Partial<typeof tagSchema.$inferInsert>
): Promise<Tag> => {
	const [tag]: TagDbo[] = await db
		.update(tagSchema)
		.set({ ...tagData, updated: new Date() })
		.where(and(eq(tagSchema.id, id), eq(tagSchema.ownerId, ownerId)))
		.returning();

	return serializeTag(tag);
};

export const deleteTag = async (id: number, ownerId: number): Promise<void> => {
	await db.delete(tagSchema).where(and(eq(tagSchema.id, id), eq(tagSchema.ownerId, ownerId)));
};

export const getTagCountForUser = async (userId: number): Promise<number> => {
	const [{ count: tagCount }] = await db
		.select({ count: count(tagSchema.id) })
		.from(tagSchema)
		.where(eq(tagSchema.ownerId, userId));

	return tagCount;
};

export const getOrCreateTag = async (
	ownerId: number,
	tagData: typeof tagSchema.$inferInsert
): Promise<Tag> => {
	const tag = (await db.query.tagSchema.findFirst({
		where: and(eq(tagSchema.ownerId, ownerId), eq(tagSchema.name, tagData.name)),
		with: mapRelationsToWithStatements([TagRelations.OWNER])
	})) as TagDbo | undefined;

	if (tag) {
		return serializeTag(tag);
	}

	const newTag = await createTag(ownerId, tagData);

	return newTag;
};
