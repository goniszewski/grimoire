import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';
import { writable } from 'svelte/store';

import { error, fail, json } from '@sveltejs/kit';

import config from './config';

import type { RecordModel } from 'pocketbase';
import type { User } from './types/User.type';
import type { UserSettings } from './types/UserSettings.type';

export const pb = new PocketBase(config.ORIGIN + '/internal');

export const user = writable(
	pb.authStore as BaseAuthStore & {
		model: User;
	}
);

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
	avatar: '',
	email: '',
	name: '',
	username: '',
	disabled: '',
	verified: false,
	settings: defaultUserSettings
};

export async function handlePBError(e: any, pb: PocketBase, form?: boolean) {
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

export type authenticateUserApiRequestResponse = {
	owner: string;
	disabled: boolean | null;
	userRecord: RecordModel | null;
	error: Response | null;
};

export async function authenticateUserApiRequest(
	pb: PocketBase,
	request: Request
): Promise<authenticateUserApiRequestResponse> {
	const authKey = request.headers.get('Authorization') ?? '';

	const response: authenticateUserApiRequestResponse = {
		owner: '',
		disabled: null,
		userRecord: null,
		error: null
	};

	try {
		const [login, password] = atob(authKey.split(' ')[1]).split(':');

		const user = await pb
			.collection('users')
			.authWithPassword(login, password)
			.then((user) => user.record);

		response.owner = user.id;
		response.disabled = !!user.disabled;
		response.userRecord = user;
	} catch (error: any) {
		response.error = json(
			{
				success: false,
				error: `Problem with authorization token: ${error?.message}`
			},
			{
				status: 401
			}
		);
	}

	if (!response.owner) {
		response.error = json(
			{
				success: false,
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	} else if (response.disabled) {
		response.error = json(
			{
				success: false,
				error: 'User disabled'
			},
			{
				status: 401
			}
		);
	}

	return response;
}

export const removePocketbaseFields = <T extends Partial<RecordModel> | Partial<RecordModel>[]>(
	record: T
): T => {
	const keys = ['collectionId', 'collectionName'];
	const removeFields = <T>(obj: T): T => {
		if (Array.isArray(obj)) {
			return obj.map((item) => removeFields(item)) as unknown as T;
		}

		if (typeof obj === 'object' && obj !== null) {
			for (const key in obj) {
				if (keys.includes(key)) {
					delete obj[key];
				} else {
					obj[key] = removeFields(obj[key]);
				}
			}
		}

		return obj;
	};

	return removeFields(record) as T;
};
