import parse from 'node-parse-bookmarks';

import { createSlug } from '../create-slug';

import type { Bookmark as ParserBookmark } from 'node-parse-bookmarks/build/interfaces/bookmark';
import type {
	ImportedBookmark,
	ImportedCategory,
	ImportResult
} from '$lib/types/BookmarkImport.type';

async function parseNetscapeBackupFile(content: string): Promise<ParserBookmark[]> {
	try {
		const bookmarks: ParserBookmark[] = await new Promise((resolve, _reject) => {
			resolve(parse(content));
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

	function processBookmark(item: ParserBookmark, parentSlug?: string) {
		if (item.type === 'folder' && item.children?.length) {
			const category: ImportedCategory = {
				name: item.title!,
				slug: createSlug(item.title!),
				parentSlug,
				createdAt: item.addDate ? new Date(item.addDate) : undefined
			};
			result.categories.push(category);

			item.children?.forEach((child) => processBookmark(child, category.slug));
		} else {
			const bookmark: ImportedBookmark = {
				title: item.title || item.url!,
				url: item.url!,
				description: item.description || '',
				createdAt: item.addDate ? new Date(item.addDate) : undefined,
				icon: item.icon || undefined,
				categorySlug: parentSlug
			};
			result.bookmarks.push(bookmark);
		}
	}

	bookmarks.forEach((bookmark) => processBookmark(bookmark));

	return result;
}

export async function importNetscapeBackup(content: string): Promise<ImportResult> {
	const bookmarks = await parseNetscapeBackupFile(content);

	return translateNetscapeBookmarks(bookmarks);
}
