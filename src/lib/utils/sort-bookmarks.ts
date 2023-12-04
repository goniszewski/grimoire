import type { Bookmark } from '$lib/types/Bookmark.type';
import _ from 'lodash';

export type sortByType =
	| 'created_asc'
	| 'created_desc'
	| 'title_asc'
	| 'title_desc'
	| 'created_asc'
	| 'created_desc';
export function sortBookmarks(bookmarks: Bookmark[], sortString: sortByType) {
	const [order, ...fieldNameParts] = sortString.split('_').reverse() as [
		'asc' | 'desc',
		keyof Bookmark
	];
	const field = fieldNameParts.reverse().join('_') as keyof Bookmark;
	let result = _.sortBy(bookmarks, (b) => {
		return typeof b[field] === 'string' ? (b[field] as string).toLowerCase() : b[field];
	});

	if (order === 'desc') {
		result = result.reverse();
	}

	return result;
}
