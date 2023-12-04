import config from '$lib/config';
import { pb } from '$lib/pb';
import Fuse from 'fuse.js';
import path from 'path';

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
const indexKeys = defaultOptions.keys.map((key) => key.name);

export const searchFactory = (
	data: any[],
	options: IFuseOptions<any> = {},
	index?: FuseIndex<any>
) => {
	const fuse = new Fuse(data, { ...defaultOptions, ...options }, index);

	return fuse;
};

export const createSearchIndex = (data: any[], userId: string) => {
	const createdIndex = Fuse.createIndex(indexKeys, data);

	return createdIndex;
};

export const initializeSearch = async (userId: string) => {
	let bookmarksForIndex = [] as Record<string, any>[];
	const searchIndexingDisabled = config.SEARCH_INDEXING_DISABLED;

	if (searchIndexingDisabled) {
		return searchFactory(bookmarksForIndex, {});
	}

	bookmarksForIndex = await pb.collection('bookmarks').getFullList({
		fields: 'id,title,domain,description,url,tags.name',
		expand: 'tags.name',
		filter: `owner.id="${userId}"`,
		batchSize: 100000
	});

	const index = createSearchIndex(bookmarksForIndex, userId);

	return searchFactory(bookmarksForIndex, {}, index);
};

export const addBookmarkToSearchIndex = async (
	searchInstance: Fuse<any>,
	bookmark: Bookmark,
	_userId: string
) => {
	const searchIndexingDisabled = config.SEARCH_INDEXING_DISABLED;

	if (searchIndexingDisabled) {
		return;
	}

	return searchInstance.add(bookmark);
};

export const removeBookmarkFromSearchIndex = async (
	searchInstance: Fuse<any>,
	bookmarkId: string,
	_userId: string
) => {
	const searchIndexingDisabled = config.SEARCH_INDEXING_DISABLED;

	if (searchIndexingDisabled) {
		return;
	}

	searchInstance.remove((b) => b.id === bookmarkId);
};
