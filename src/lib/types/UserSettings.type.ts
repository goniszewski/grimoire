import type { sortByType } from '$lib/utils/sort-bookmarks';

export type UserSettings = {
	bookmarksView: 'list' | 'grid';
	bookmarksSortedBy: sortByType;
	bookmarksOnlyShowFlagged: boolean;
	bookmarksOnlyShowRead: boolean;
	theme: 'light' | 'dark';
};
