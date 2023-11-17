import { defaultUserSettings } from '$lib/pb';
import { writable } from 'svelte/store';

import type { UserSettings } from '$lib/types/UserSettings.type';
export const userSettingsStore = writable<UserSettings>(defaultUserSettings);
