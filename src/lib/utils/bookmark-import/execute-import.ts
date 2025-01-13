import type { BookmarkEdit } from '$lib/types/Bookmark.type';
import { db } from '$lib/database/db';
import { getOrCreateCategory } from '$lib/database/repositories/Category.repository';
import { getOrCreateTag } from '$lib/database/repositories/Tag.repository';
import { bookmarkSchema, bookmarksToTagsSchema } from '$lib/database/schema';

import { createSlug } from '../create-slug';

import type { ImportExecutionResult } from '$lib/types/BookmarkImport.type';
export async function executeImport(
	bookmarks: BookmarkEdit[],
	userId: number
): Promise<ImportExecutionResult> {
	const results = [];

	for (const bookmark of bookmarks) {
		try {
			const category = await getOrCreateCategory(userId, {
				name: bookmark.category.name,
				slug: createSlug(bookmark.category.name)
			});

			const [newBookmark] = await db
				.insert(bookmarkSchema)
				.values({
					url: bookmark.url,
					domain: bookmark.domain,
					title: bookmark.title,
					description: bookmark.description || null,
					iconUrl: bookmark.iconUrl,
					mainImageUrl: bookmark.mainImageUrl,
					importance: bookmark.importance,
					flagged: bookmark.flagged,
					contentHtml: bookmark.contentHtml,
					contentText: bookmark.contentText,
					contentType: bookmark.contentType,
					author: bookmark.author,
					contentPublishedDate: bookmark.contentPublishedDate,
					slug: createSlug(bookmark.title),
					ownerId: userId,
					categoryId: category.id,
					created: new Date(),
					updated: new Date()
				} as typeof bookmarkSchema.$inferInsert)
				.returning();

			if (bookmark.bookmarkTags?.length) {
				const tags = await Promise.all(
					bookmark.bookmarkTags.map((tag) =>
						getOrCreateTag(userId, {
							name: tag.label,
							slug: createSlug(tag.label),
							ownerId: userId
						})
					)
				);

				await db.insert(bookmarksToTagsSchema).values(
					tags.map((tag) => ({
						bookmarkId: newBookmark.id,
						tagId: tag.id
					}))
				);
			}

			results.push({
				success: true,
				bookmark: newBookmark.id
			});
		} catch (error) {
			console.error(error);
			results.push({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				bookmark: bookmark.url
			});
		}
	}

	const result = {
		total: bookmarks.length,
		successful: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
		results
	} as unknown as ImportExecutionResult;

	return result;
}
