import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
import { sortBy } from 'lodash';

export type sortByType = 'added_asc' | 'added_desc' | 'title_asc' | 'title_desc';
export function sortBookmarks(bookmarks: Bookmark[], sortString: sortByType) {
	const [by, order] = sortString.split('_') as [keyof Bookmark, 'asc' | 'desc'];
	let result = sortBy(bookmarks, (b) =>
		typeof b[by] === 'string' ? (b[by] as string).toLowerCase() : b[by]
	);

	if (order === 'desc') {
		result = result.reverse();
	}

	return result;
}
