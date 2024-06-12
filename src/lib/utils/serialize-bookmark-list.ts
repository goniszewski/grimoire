import type { Bookmark } from '$lib/types/Bookmark.type';
import { checkIfImageURL } from './check-if-image-url';
import { getFileUrl } from './get-file-url';

export const serializeBookmarkList = (bookmarks: Bookmark[]) =>
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
