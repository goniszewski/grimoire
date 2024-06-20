import { env } from '$env/dynamic/public';

import type { User } from './types/User.type';
import type { UserSettings } from './types/UserSettings.type';

const getProcessEnvValue = (key: string) =>
	typeof process === 'object' ? process.env[key] : undefined;

const config = {
	IS_DEV: import.meta.env.DEV,
	ORIGIN: env.PUBLIC_ORIGIN || getProcessEnvValue('PUBLIC_ORIGIN') || 'http://localhost:5173',
	HTTPS_ONLY:
		(env.PUBLIC_HTTPS_ONLY || getProcessEnvValue('PUBLIC_HTTPS_ONLY')) === 'true' || false,
	SIGNUP_DISABLED:
		(env.PUBLIC_SIGNUP_DISABLED || getProcessEnvValue('PUBLIC_SIGNUP_DISABLED')) === 'true' || false
};

console.info('Configuration used', config);

export default config;

export const defaultUserSettings: UserSettings = {
	theme: 'light',
	uiAnimations: true,
	bookmarksView: 'grid',
	bookmarksSortedBy: 'created_desc',
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
	avatarId: null,
	email: '',
	name: '',
	username: '',
	disabled: null,
	verified: false,
	settings: defaultUserSettings,
	isAdmin: false,
	passwordHash: ''
};
