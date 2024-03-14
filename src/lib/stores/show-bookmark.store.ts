import type { Bookmark } from '$lib/types/Bookmark.type';
import { writable } from 'svelte/store';

export const showBookmarkStore = writable<Bookmark>();
