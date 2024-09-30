import type { Bookmark } from '$lib/types/Bookmark.type';
import type { Category } from '$lib/types/Category.type';
import parse from 'node-parse-bookmarks';

import { createSlug } from '../create-slug';

import type { Bookmark as ParserBookmark } from 'node-parse-bookmarks/build/interfaces/bookmark';
import type {
	ImportedBookmark,
	ImportedCategory,
	ImportResult
} from '$lib/types/BookmarkImport.type';

async function importNetscapeBackupFile(filePath: string): Promise<ParserBookmark[]> {
	try {
		const bookmarks: ParserBookmark[] = await new Promise((resolve, reject) => {
			parse(
				filePath,
				{},
				(res: ParserBookmark[]) => {
					resolve(res);
				},
				(err: Error | null) => {
					if (err) {
						reject(err);
					}
				}
			);
		});
		return bookmarks;
	} catch (error) {
		console.error('Error importing Netscape backup:', error);
		throw new Error('Failed to import Netscape backup');
	}
}

function translateNetscapeBookmarks(bookmarks: ParserBookmark[]): ImportResult {
	const result: ImportResult = {
		bookmarks: [],
		categories: [],
		tags: []
	};

	function processBookmark(bookmark: ParserBookmark, parentSlug?: string) {
		if (bookmark.type === 'folder') {
			const category: ImportedCategory = {
				name: bookmark.title!,
				slug: createSlug(bookmark.title!),
				parentSlug,
				createdAt: bookmark.addDate ? new Date(bookmark.addDate) : undefined
			};
			result.categories.push(category);

			bookmark.children?.forEach((child) => processBookmark(child, category.slug));
		} else {
			const importedBookmark: ImportedBookmark = {
				title: bookmark.title || bookmark.url!,
				url: bookmark.url!,
				description: bookmark.description || '',
				createdAt: bookmark.addDate ? new Date(bookmark.addDate) : undefined,
				icon: bookmark.icon || undefined
			};
			result.bookmarks.push(importedBookmark);
		}
	}

	bookmarks.forEach((bookmark) => processBookmark(bookmark));

	return result;
}

export async function importNetscapeBackup(filePath: string): Promise<ImportResult> {
	const bookmarks = await importNetscapeBackupFile(filePath);
	return translateNetscapeBookmarks(bookmarks);
}
