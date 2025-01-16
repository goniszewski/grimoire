import type { Bookmark, BookmarkEdit } from '$lib/types/Bookmark.type';
import { db } from '$lib/database/db';
import { getOrCreateCategory } from '$lib/database/repositories/Category.repository';
import { getOrCreateTag } from '$lib/database/repositories/Tag.repository';
import { bookmarkSchema, bookmarksToTagsSchema } from '$lib/database/schema';
import { createSlug } from '../create-slug';
import type { ImportExecutionResult, ImportProgress } from '$lib/types/BookmarkImport.type';
import { Storage } from '$lib/storage/storage';
import { eq } from 'drizzle-orm';

const BATCH_SIZE = 50;

const storage = new Storage();

export async function executeImport(
	bookmarks: BookmarkEdit[],
	userId: number,
	onProgress?: (progress: ImportProgress) => void
): Promise<ImportExecutionResult> {
	const results: ImportExecutionResult['results'] = [];
	let processedCount = 0;

	const batches = Array.from({ length: Math.ceil(bookmarks.length / BATCH_SIZE) }, (_, i) =>
		bookmarks.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
	);

	for (const batch of batches) {
		await db.transaction(async (tx) => {
			for (const bookmark of batch) {
				try {
					if (!bookmark.url || !bookmark.title || !bookmark.category?.name) {
						throw new Error('Missing required fields');
					}

					const category = await getOrCreateCategory(userId, {
						name: bookmark.category.name,
						slug: createSlug(bookmark.category.name)
					});

					const [newBookmark] = await tx
						.insert(bookmarkSchema)
						.values({
							url: bookmark.url.trim(),
							domain: bookmark.domain,
							title: bookmark.title.trim(),
							description: bookmark.description?.trim() || null,
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

					let iconId: number | null = null;
					let mainImageId: number | null = null;

					if (bookmark.mainImageUrl) {
						({ id: mainImageId } = await storage.storeImage(
							bookmark.mainImageUrl,
							bookmark.title,
							userId,
							newBookmark.id
						));
					}

					if (bookmark.iconUrl) {
						({ id: iconId } = await storage.storeImage(
							bookmark.iconUrl,
							bookmark.title,
							userId,
							newBookmark.id
						));
					}

					if (iconId || mainImageId) {
						await tx
							.update(bookmarkSchema)
							.set({
								iconId,
								mainImageId,
								updated: new Date()
							})
							.where(eq(bookmarkSchema.id, newBookmark.id));
					}

					if (bookmark.bookmarkTags?.length) {
						const tags = await Promise.all(
							bookmark.bookmarkTags.map((tag) =>
								getOrCreateTag(userId, {
									name: tag.label.trim(),
									slug: createSlug(tag.label),
									ownerId: userId
								})
							)
						);

						await tx.insert(bookmarksToTagsSchema).values(
							tags.map((tag) => ({
								bookmarkId: newBookmark.id,
								tagId: tag.id
							}))
						);
					}

					results.push({
						success: true,
						bookmark: {
							id: bookmark.id,
							url: bookmark.url,
							title: bookmark.title,
							category: bookmark.category.name,
							success: true
						}
					});
				} catch (error) {
					console.error('Failed to import bookmark:', bookmark.url, error);
					results.push({
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
						bookmark: {
							id: bookmark.id,
							url: bookmark.url,
							title: bookmark.title,
							category: bookmark.category.name,
							success: false
						}
					});
				}
			}
		});

		processedCount += batch.length;

		if (onProgress) {
			onProgress({
				processed: processedCount,
				total: bookmarks.length,
				successful: results.filter((r) => r.success).length,
				failed: results.filter((r) => !r.success).length
			});
		}
	}

	const result: ImportExecutionResult = {
		total: bookmarks.length,
		successful: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
		results
	};

	return result;
}
