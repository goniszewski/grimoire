import type { UserSettings } from '$lib/pb';
import { writable } from 'svelte/store';

const defaults: UserSettings = {
	bookmarksView: 'grid',
	bookmarksSortedBy: 'created_desc',
	bookmarksOnlyShowFlagged: false,
	bookmarksOnlyShowRead: false
};

export const userSettingsStore = writable<UserSettings>(defaults);
