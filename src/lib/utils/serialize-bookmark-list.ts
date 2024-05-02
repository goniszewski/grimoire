import type { BookmarkDto } from '$lib/types/dto/Bookmark.dto';
import { checkIfImageURL } from './check-if-image-url';
import { getFileUrl } from './get-file-url';

export const serializeBookmarkList = (bookmarks: BookmarkDto[]) =>
	structuredClone(
		bookmarks.map((bookmark) => {
			const icon = getFileUrl('bookmarks', bookmark.id, bookmark.icon);
			const main_image = getFileUrl('bookmarks', bookmark.id, bookmark.main_image);
			const screenshot = getFileUrl('bookmarks', bookmark.id, bookmark.screenshot);

			return {
				...bookmark,
				icon: checkIfImageURL(icon) ? icon : '',
				main_image: checkIfImageURL(main_image) ? main_image : '',
				screenshot: checkIfImageURL(screenshot) ? screenshot : '',
				...bookmark.expand
			};
		})
	);
