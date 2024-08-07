import Fuse from 'fuse.js';

import type { FuseIndex, IFuseOptions } from 'fuse.js';
import type { Bookmark } from '$lib/types/Bookmark.type';

const defaultOptions = {
	includeScore: true,
	shouldSort: true,
	threshold: 0.3,
	keys: [
		{
			name: 'title',
			weight: 0.7
		},
		{
			name: 'domain',
			weight: 0.5
		},
		{
			name: 'description',
			weight: 0.3
		},
		{
			name: 'url',
			weight: 0.2
		},
		{
			name: 'tags.name',
			weight: 0.2
		}
	]
};
export const searchIndexKeys = defaultOptions.keys.map((key) => key.name);

export const searchFactory = (
	data: any[],
	options: IFuseOptions<any> = {},
	index?: FuseIndex<any>
) => new Fuse(data, { ...defaultOptions, ...options }, index);

export const createSearchIndex = (data: any[]) => Fuse.createIndex(searchIndexKeys, data);

export const initializeSearch = (bookmarks: any[]) => {
	const index = createSearchIndex(bookmarks);

	return searchFactory(bookmarks, {}, index);
};

export const addBookmarkToSearchIndex = async ($searchInstance: Fuse<any>, bookmark: Bookmark) =>
	$searchInstance.add(bookmark);

export const removeBookmarkFromSearchIndex = async (
	$searchInstance: Fuse<any>,
	bookmarkId: number
) => $searchInstance.remove((b) => b.id === bookmarkId);

export const updateBookmarkInSearchIndex = async (
	$searchInstance: Fuse<any>,
	bookmark: Bookmark
) => {
	removeBookmarkFromSearchIndex($searchInstance, bookmark.id);

	return addBookmarkToSearchIndex($searchInstance, bookmark);
};
