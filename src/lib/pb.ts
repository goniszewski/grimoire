import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';
import { writable } from 'svelte/store';

import { error, fail } from '@sveltejs/kit';

import config from './config';

import type { User } from './types/User.type';
import type { UserSettings } from './types/UserSettings.type';
export const pb = new PocketBase(config.POCKETBASE_URL);

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

export async function handlePBError(e: any, pb: PocketBase, form?: boolean) {
	console.info('handlePBError', e, form);
	if (!(e instanceof ClientResponseError)) {
		throw error(500, e?.message);
	}

	const tokenValid = await pb
		.collection('users')
		.authRefresh()
		.then(() => true)
		.catch(() => false);

	switch (e.status) {
		case 400:
			if (!form) {
				throw error(400, 'Bad request');
			}
			console.log({
				invalid: true,
				...(e.data?.data || {})
			});

			return fail(400, {
				invalid: true,
				...(e.data?.data || {})
			});
		case 401:
			if (!form) {
				throw error(401, 'Unauthorized');
			}
			return fail(401, {
				invalid: true
			});
		case 404:
			if (!tokenValid) {
				if (!form) {
					throw error(401, 'Unauthorized');
				}
				return fail(401, {
					invalid: true
				});
			}
			throw error(404, 'Not found');
		case 409:
			if (form) {
				return fail(409, {
					exists: true
				});
			}
			throw error(409, 'Conflict');
		case 500:
			throw error(500, 'Internal server error');
		case 0:
			throw error(500, `Could not connect to PocketBase instance at ${pb.baseUrl}`);
		default:
			throw error(e.status, e.message);
	}
}
