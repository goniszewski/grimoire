import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
import { sortBy } from 'lodash';

export type sortByType = 'added_asc' | 'added_desc' | 'title_asc' | 'title_desc';
export function sortBookmarks(bookmarks: Bookmark[], sortString: sortByType) {
	const [order, ...fieldNameParts] = sortString.split('_').reverse() as [
		'asc' | 'desc',
		keyof Bookmark
	];
	const field = fieldNameParts.reverse().join('_') as keyof Bookmark;
	let result = sortBy(bookmarks, (b) => {
		// console.log('field', field);
		// console.log('b[field]', b[field]);
		// console.log(
		// 	"typeof b[field] === 'string' ? (b[field] as string).toLowerCase() : b[field]",
		// 	typeof b[field] === 'string' ? (b[field] as string).toLowerCase() : b[field]
		// );
		return typeof b[field] === 'string' ? (b[field] as string).toLowerCase() : b[field];
	});

	if (order === 'desc') {
		result = result.reverse();
	}

	return result;
}
