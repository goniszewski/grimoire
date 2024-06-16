import type { Bookmark } from '$lib/types/Bookmark.type';
import type { BookmarkDbo } from '$lib/types/dbo/BookmarkDbo.type';
import { getFileUrl } from './get-file-url';

export const serializeBookmarkList = (bookmarks: BookmarkDbo[]) =>
	structuredClone(
		bookmarks.map((bookmark) => {
			const icon = getFileUrl(bookmark.icon?.relativePath);
			const mainImage = getFileUrl(bookmark.mainImage?.relativePath);
			const screenshot = getFileUrl(bookmark.screenshot?.relativePath);

			return {
				...bookmark,
				icon,
				mainImage,
				screenshot
			};
		})
	);
