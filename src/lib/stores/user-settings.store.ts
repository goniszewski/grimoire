import { defaultUserSettings } from '$lib/config';
import { writable } from 'svelte/store';

import type { UserSettings } from '$lib/types/UserSettings.type';
export const userSettingsStore = writable<UserSettings>(defaultUserSettings);
