import { createSlug } from '$lib/utils/create-slug';
import { serializeBookmark } from '$lib/utils/serialize-dbo-entity';
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '../db';
import { bookmarkSchema, bookmarksToTagsSchema, tagSchema } from '../schema';
import { mapRelationsToWithStatements } from './common';

import type { Bookmark } from '$lib/types/Bookmark.type';
import type { BookmarkDbo } from '$lib/types/dbo/BookmarkDbo.type';
import type { Tag } from '$lib/types/Tag.type';
export enum BookmarkRelations {
	TAGS__TAG = 'tags.tag',
	// CATEGORY = 'category',
	CATEGORY__PARENT = 'category.parent',
	ICON = 'icon',
	MAIN_IMAGE = 'mainImage',
	OWNER = 'owner',
	SCREENSHOT = 'screenshot'
}
const allBookmarkRelations: BookmarkRelations[] = Object.values(BookmarkRelations);

const orderKeys = {
	created: bookmarkSchema.created,
	title: bookmarkSchema.title,
	url: bookmarkSchema.url,
	description: bookmarkSchema.description
};

export const getBookmarkById = async (
	id: number,
	ownerId: number,
	relations: BookmarkRelations[] = allBookmarkRelations
): Promise<Bookmark | null> => {
	const bookmark = (await db.query.bookmarkSchema.findFirst({
		where: and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)),
		with: mapRelationsToWithStatements(relations)
	})) as BookmarkDbo;

	return bookmark ? serializeBookmark(bookmark) : null;
};

export const getBookmarksByIds = async (
	ids: number[],
	ownerId: number,
	relations: BookmarkRelations[] = allBookmarkRelations
): Promise<Bookmark[]> => {
	const bookmarks = (await db.query.bookmarkSchema.findMany({
		where: and(
			eq(bookmarkSchema.ownerId, ownerId),
			or(...ids.map((id) => eq(bookmarkSchema.id, id)))
		),
		with: mapRelationsToWithStatements(relations)
	})) as BookmarkDbo[];

	return bookmarks.map(serializeBookmark);
};

export const getBookmarksByUserId = async (
	userId: number,
	options?: {
		orderBy?: keyof typeof orderKeys;
		orderDirection?: 'asc' | 'desc';
		limit?: number;
		page?: number;
	},
	relations: BookmarkRelations[] = allBookmarkRelations
): Promise<Bookmark[]> => {
	const bookmarks = (await db.query.bookmarkSchema.findMany({
		limit: options?.limit,
		offset: options?.page && options?.limit && (options.page - 1) * options.limit,
		// orderBy: desc(bookmarkSchema.created),
		orderBy:
			options?.orderBy &&
			(options.orderDirection === 'asc'
				? asc(orderKeys[options.orderBy])
				: desc(orderKeys[options.orderBy])),
		where: eq(bookmarkSchema.ownerId, userId),
		with: mapRelationsToWithStatements(relations)
	})) as BookmarkDbo[];

	return bookmarks.map(serializeBookmark);
};

export const getBookmarkByUrl = async (
	url: string,
	ownerId: number,
	relations: BookmarkRelations[] = allBookmarkRelations
): Promise<Bookmark | null> => {
	const urlObj = new URL(url);
	const bookmark = (await db.query.bookmarkSchema.findFirst({
		where: and(
			like(bookmarkSchema.url, `%${urlObj.host}${urlObj.pathname}%`),
			eq(bookmarkSchema.ownerId, ownerId)
		),
		with: mapRelationsToWithStatements(relations)
	})) as BookmarkDbo;

	return bookmark ? serializeBookmark(bookmark) : null;
};

export const getBookmarksByCategoryIds = async (
	ids: number[],
	ownerId: number,
	relations: BookmarkRelations[] = allBookmarkRelations
): Promise<Bookmark[]> => {
	const bookmarks = (await db.query.bookmarkSchema.findMany({
		where: and(
			eq(bookmarkSchema.ownerId, ownerId),
			or(...ids.map((id) => eq(bookmarkSchema.categoryId, id)))
		),
		with: mapRelationsToWithStatements(relations)
	})) as BookmarkDbo[];

	return bookmarks.map(serializeBookmark);
};

export const createBookmark = async (
	ownerId: number,
	bookmarkData: Omit<typeof bookmarkSchema.$inferInsert, 'ownerId'>
): Promise<Bookmark> => {
	const [bookmark] = (await db
		.insert(bookmarkSchema)
		.values({ ...bookmarkData, ownerId })
		.returning()) as BookmarkDbo[];

	return serializeBookmark(bookmark);
};

export const updateBookmark = async (
	id: number,
	ownerId: number,
	bookmarkData: Partial<typeof bookmarkSchema.$inferInsert>
): Promise<Bookmark> => {
	const [bookmark] = (await db
		.update(bookmarkSchema)
		.set({ ...bookmarkData, updated: new Date() })
		.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)))
		.returning()) as BookmarkDbo[];

	return serializeBookmark(bookmark);
};

export const deleteBookmark = async (id: number, ownerId: number): Promise<void> => {
	await db
		.delete(bookmarkSchema)
		.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)));
	await db.delete(bookmarksToTagsSchema).where(eq(bookmarksToTagsSchema.bookmarkId, id));
};

export const fetchBookmarkTags = async (id: number, ownerId: number): Promise<{ tags: Tag[] }> => {
	const [{ tags }] = await db.query.bookmarkSchema.findMany({
		where: and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)),
		with: {
			tags: {
				with: {
					tag: true
				}
			}
		}
	});

	const bookmarkTags: Tag[] = tags.map((bookmarksToTag) => bookmarksToTag.tag);

	return { tags: bookmarkTags };
};

export const addTagToBookmark = async (
	id: number,
	ownerId: number,
	tagId: number
): Promise<void> => {
	const bookmarkExists = await db.query.bookmarkSchema.findFirst({
		where: and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId))
	});
	const tagExists = await db.query.tagSchema.findFirst({
		where: and(eq(tagSchema.id, tagId), eq(tagSchema.ownerId, ownerId))
	});
	if (!bookmarkExists || !tagExists) throw new Error('Bookmark or tag does not exist');

	const relationExists = await db.query.bookmarksToTagsSchema.findFirst({
		where: and(eq(bookmarksToTagsSchema.bookmarkId, id), eq(bookmarksToTagsSchema.tagId, tagId))
	});
	if (relationExists) return;

	await db.insert(bookmarksToTagsSchema).values({
		bookmarkId: id,
		tagId
	});
};

export const upsertTagsForBookmark = async (
	id: number,
	ownerId: number,
	tags: string[]
): Promise<void> => {
	if (!tags.length) {
		await db.delete(bookmarksToTagsSchema).where(eq(bookmarksToTagsSchema.bookmarkId, id));
		return;
	}
	const bookmarkExists = await db.query.bookmarkSchema.findFirst({
		where: and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId))
	});
	if (!bookmarkExists) throw new Error('Bookmark does not exist');

	const existingTags = await db.query.tagSchema.findMany({
		where: and(eq(tagSchema.ownerId, ownerId), inArray(tagSchema.name, tags))
	});

	const existingTagNames = new Set(existingTags.map((tag) => tag.name));
	const newTags = tags.filter((tag) => !existingTagNames.has(tag));

	await db.transaction(async (tx) => {
		if (newTags.length > 0) {
			const tagsToInsert = newTags.map((tag) => ({ name: tag, ownerId, slug: createSlug(tag) }));
			await tx.insert(tagSchema).values(tagsToInsert);
		}

		const allTags = await tx.query.tagSchema.findMany({
			where: and(eq(tagSchema.ownerId, ownerId), inArray(tagSchema.name, tags))
		});
		const tagIds = allTags.map((tag) => tag.id);

		const existingBookmarkTags = await tx.query.bookmarksToTagsSchema.findMany({
			where: eq(bookmarksToTagsSchema.bookmarkId, id)
		});

		const existingTagIds = new Set(existingBookmarkTags.map((bt) => bt.tagId));
		const tagsToDelete = existingTagIds.difference(new Set(tagIds));
		const tagsToAdd = tagIds.filter((tagId) => !existingTagIds.has(tagId));

		if (tagsToDelete.size > 0) {
			await tx
				.delete(bookmarksToTagsSchema)
				.where(
					and(
						eq(bookmarksToTagsSchema.bookmarkId, id),
						inArray(bookmarksToTagsSchema.tagId, Array.from(tagsToDelete))
					)
				);
		}

		if (tagsToAdd.length > 0) {
			await tx
				.insert(bookmarksToTagsSchema)
				.values(tagsToAdd.map((tagId) => ({ bookmarkId: id, tagId })));
		}
	});
};

export const getBookmarksCountForUser = async (userId: number): Promise<number> => {
	const [{ count: bookmarkCount }] = await db
		.select({ count: count(bookmarkSchema.id) })
		.from(bookmarkSchema)
		.where(eq(bookmarkSchema.ownerId, userId));

	return bookmarkCount;
};

export const setScreenshotToBookmark = async (
	id: number,
	ownerId: number,
	screenshotId: number
): Promise<void> => {
	const bookmarkExists = await db.query.bookmarkSchema.findFirst({
		where: and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId))
	});

	if (!bookmarkExists) throw new Error('Bookmark does not exist');

	bookmarkExists.screenshotId = screenshotId;
	await db
		.update(bookmarkSchema)
		.set({ screenshotId, updated: new Date() })
		.where(eq(bookmarkSchema.id, id));
};
