import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { writable } from 'svelte/store';

import type { sortByType } from './utils/sort-bookmarks';

export type UserSettings = {
	bookmarksView: 'list' | 'grid';
	bookmarksSortedBy: sortByType;
	bookmarksOnlyShowFlagged: boolean;
	bookmarksOnlyShowRead: boolean;
};

export type User = {
	avatar: string;
	collectionId: string;
	collectionName: string;
	created: string;
	email: string;
	emailVisibility: boolean;
	id: string;
	name: string;
	settings?: UserSettings;
	updated: string;
	username: string;
	verified: boolean;
};

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
export const user = pb.authStore as BaseAuthStore & {
	model: User;
};

export const currentUser = writable(pb.authStore.model);
