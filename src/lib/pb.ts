import { env } from '$env/dynamic/public';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { writable } from 'svelte/store';

import type { User } from './types/User.type';
import type { UserSettings } from './types/UserSettings.type';

export const pb = new PocketBase(env.PUBLIC_POCKETBASE_URL);

export const user = writable(
	pb.authStore as BaseAuthStore & {
		model: User;
	}
);

export const defaultUserSettings: UserSettings = {
	theme: 'light',
	uiAnimations: true,
	bookmarksView: 'grid',
	bookmarksSortedBy: 'added_desc',
	bookmarksOnlyShowFlagged: false,
	bookmarksOnlyShowRead: false,
	llm: {
		enabled: false,
		provider: 'ollama',
		ollama: {
			url: '',
			model: '',
			generateTags: {
				enabled: false,
				system: ''
			},
			summarize: {
				enabled: false,
				system: ''
			}
		},
		openai: {
			apiKey: ''
		}
	}
};

export const defaultUser: Omit<User, 'id' | 'created' | 'updated'> = {
	avatar: '',
	email: '',
	name: '',
	username: '',
	disabled: '',
	verified: false,
	settings: defaultUserSettings
};
