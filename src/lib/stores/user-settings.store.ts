import type { UserSettings } from '$lib/types/UserSettings.type';
import { writable } from 'svelte/store';

const defaults: Partial<UserSettings> = {
	bookmarksView: 'grid',
	bookmarksSortedBy: 'created_desc',
	bookmarksOnlyShowFlagged: false,
	bookmarksOnlyShowRead: false
};

export const userSettingsStore = writable<UserSettings>(defaults);
