import type { Bookmark, BookmarkEdit } from '$lib/types/Bookmark.type';
import { writable } from 'svelte/store';

export const editBookmarkStore = writable<Partial<Bookmark> | BookmarkEdit>({});
