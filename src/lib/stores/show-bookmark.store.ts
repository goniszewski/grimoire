import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
import { writable } from 'svelte/store';

export const showBookmarkStore = writable<Partial<Bookmark>>({});
