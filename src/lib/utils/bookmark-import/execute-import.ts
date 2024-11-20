import type { BookmarkEdit } from '$lib/types/Bookmark.type';
import { db } from '$lib/database/db';
import {
    bookmarkSchema, bookmarksToTagsSchema, categorySchema, tagSchema
} from '$lib/database/schema';
import { eq } from 'drizzle-orm';

import { createSlug } from '../create-slug';

import type { ImportExecutionResult } from '$lib/types/BookmarkImport.type';

export async function executeImport(
	bookmarks: BookmarkEdit[],
	userId: number
): Promise<ImportExecutionResult> {
	const categoryCache = new Map<string, number>();
	const tagCache = new Map<string, number>();

	async function getOrCreateCategory(categoryPath: string, userId: number) {
		if (categoryCache.has(categoryPath)) {
			return categoryCache.get(categoryPath);
		}

		const parts = categoryPath.split('/').filter(Boolean);
		let parentId: number | null = null;
		let currentPath = '';

		for (const part of parts) {
			currentPath += `/${part}`;
			const slug = createSlug(part);

			let category = await db.query.categorySchema.findFirst({
				where: eq(categorySchema.slug, slug)
			});

			if (!category) {
				const [newCategory] = await db
					.insert(categorySchema)
					.values({
						name: part,
						slug,
						ownerId: userId,
						parentId,
						created: new Date(),
						updated: new Date()
					})
					.returning();
				category = newCategory as typeof categorySchema.$inferSelect;
			}

			categoryCache.set(currentPath, category.id);
			parentId = category.id;
		}

		return parentId;
	}
	async function getOrCreateTag(tagName: string, userId: number) {
		if (tagCache.has(tagName)) {
			return tagCache.get(tagName);
		}

		const slug = createSlug(tagName);
		let tag = await db.query.tagSchema.findFirst({
			where: eq(tagSchema.slug, slug)
		});

		if (!tag) {
			const [newTag] = await db
				.insert(tagSchema)
				.values({
					name: tagName,
					slug,
					ownerId: userId,
					created: new Date(),
					updated: new Date()
				})
				.returning();
			tag = newTag;
		}

		tagCache.set(tagName, tag.id);
		return tag.id;
	}

	const results = [];
	for (const bookmark of bookmarks) {
		try {
			const categoryId = await getOrCreateCategory(bookmark.category, userId);

			const [newBookmark] = await db
				.insert(bookmarkSchema)
				.values({
					url: bookmark.url,
					title: bookmark.title,
					slug: createSlug(bookmark.title),
					domain: new URL(bookmark.url).hostname,
					description: bookmark.description || null,
					ownerId: userId,
					categoryId: categoryId ?? null,
					created: new Date(),
					updated: new Date()
				} as typeof bookmarkSchema.$inferInsert)
				.returning();

			if (bookmark.bookmarkTags?.length) {
				const tagIds = await Promise.all(
					bookmark.bookmarkTags.map((tag) => getOrCreateTag(tag.value, userId))
				);

				await db.insert(bookmarksToTagsSchema).values(
					tagIds
						.filter((tagId): tagId is number => tagId !== undefined)
						.map((tagId) => ({
							bookmarkId: newBookmark.id,
							tagId
						}))
				);
			}

			results.push({
				success: true,
				bookmark: newBookmark
			});
		} catch (error) {
			results.push({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				bookmark
			});
		}
	}

	return {
		total: bookmarks.length,
		successful: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
		results
	} as unknown as ImportExecutionResult;
}
