import config from '$lib/config';
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
) => {
	const fuse = new Fuse(data, { ...defaultOptions, ...options }, index);

	return fuse;
};

export const createSearchIndex = (data: any[]) => {
	const createdIndex = Fuse.createIndex(searchIndexKeys, data);

	return createdIndex;
};

export const initializeSearch = (bookmarks: any[]) => {
	const index = createSearchIndex(bookmarks);

	return searchFactory(bookmarks, {}, index);
};

export const addBookmarkToSearchIndex = async ($searchInstance: Fuse<any>, bookmark: Bookmark) => {
	const searchIndexingDisabled = config.SEARCH_INDEXING_DISABLED;

	if (searchIndexingDisabled) {
		return;
	}

	return $searchInstance.add(bookmark);
};

export const removeBookmarkFromSearchIndex = async (
	$searchInstance: Fuse<any>,
	bookmarkId: string
) => {
	const searchIndexingDisabled = config.SEARCH_INDEXING_DISABLED;

	if (searchIndexingDisabled) {
		return;
	}

	$searchInstance.remove((b) => b.id === bookmarkId);
};
