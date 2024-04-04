import type { BookmarkDto } from '$lib/types/dto/Bookmark.dto';
import { getFileUrl } from './get-file-url';

export const serializeBookmarkList = (bookmarks: BookmarkDto[]) =>
	structuredClone(
		bookmarks.map((bookmark) => ({
			...bookmark,
			icon: getFileUrl('bookmarks', bookmark.id, bookmark.icon),
			main_image: getFileUrl('bookmarks', bookmark.id, bookmark.main_image),
			screenshot: getFileUrl('bookmarks', bookmark.id, bookmark.screenshot),
			...bookmark.expand
		}))
	);
