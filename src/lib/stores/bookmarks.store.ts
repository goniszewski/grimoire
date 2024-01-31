import { writable } from 'svelte/store';

import type { Bookmark } from '$lib/types/Bookmark.type';

const { subscribe, set, update } = writable<Bookmark[]>([]);
export const bookmarksStore = {
	subscribe,
	set,
	update,
	add: (bookmark: Bookmark) => update((bookmarks) => [...bookmarks, bookmark]),
	remove: (bookmarkId: string) =>
		update((bookmarks) => bookmarks.filter((bookmark) => bookmark.id !== bookmarkId))
};
