import type { Category } from '$lib/interfaces/Category.interface';
import { writable } from 'svelte/store';

type viewOptions = {
	bookmarksView: 'list' | 'grid';
};

const defaults: viewOptions = {
	// bookmarksView: 'grid'
	bookmarksView: 'list'
};

export const viewOptionsStore = writable<viewOptions>(defaults);
