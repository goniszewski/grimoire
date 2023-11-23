import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { AdminData, Settings } from '$lib/types/Admin.type';

//load cookie from request
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.pb.authStore.isAdmin || !locals.pb.authStore.isValid) {
		return {
			status: 401
		};
	}

	const adminData: AdminData = {
		users: [],
		bookmarksTotalCount: 0,
		backups: [],
		s3Test: false,
		settings: {
			llm: {
				provider: '',
				enabled: false,
				openai: {
					apiKey: ''
				},
				ollama: {
					url: ''
				}
			}
		} as Settings
	};

	adminData.users = await locals.pb.collection('users').getFullList({
		fields: 'id,name,username,email,createdAt,disabled',
		requestKey: 'admin-users'
	});
	await Promise.all(
		adminData.users.map(async (user) => [
			(user.bookmarksCount = await locals.pb
				.collection('bookmarks')
				.getList(1, 1, {
					filter: `owner.id="${user.id}"`,
					requestKey: `admin-bookmarks-${user.id}`
				})
				.then((res) => res.totalPages)),
			(user.categoriesCount = await locals.pb
				.collection('categories')
				.getList(1, 1, {
					filter: `owner.id="${user.id}"`,
					requestKey: `admin-categories-${user.id}`
				})
				.then((res) => res.totalPages)),
			(user.tagsCount = await locals.pb
				.collection('tags')
				.getList(1, 1, {
					filter: `owner.id="${user.id}"`,
					requestKey: `admin-tags-${user.id}`
				})
				.then((res) => res.totalPages))
		])
	);

	adminData.backups = await locals.pb.backups.getFullList();
	adminData.s3Test = await locals.pb.settings.testS3('backups').catch(() => false);
	adminData.settings = {
		...adminData.settings,
		...(await locals.pb.settings.getAll())
	} as Settings;

	return {
		adminData
	};
};

export const actions = {
	updateSettings: async ({ locals, request }) => {
		const data = await request.formData();
		const settings = JSON.parse(data.get('settings') as string);

		const configValidations = <Record<string, any>>{};

		const result = await locals.pb.settings.update(settings);

		if (settings.s3StorageEnabled) {
			configValidations.s3Storage = await locals.pb.settings.testS3('storage').catch(() => false);
		}
		if (settings.backupsS3Enabled) {
			configValidations.s3Backups = await locals.pb.settings.testS3('backups').catch(() => false);
		}

		return {
			status: 200,
			body: {
				result,
				configValidations
			}
		};
	},
	toggleUserDisabled: async ({ locals, request }) => {
		if (!locals.pb.authStore.isAdmin || !locals.pb.authStore.isValid) {
			return {
				status: 401,
				body: {
					result: false
				}
			};
		}

		const data = await request.formData();
		const userId = data.get('userId') as string;
		const disable = data.get('disable') === 'true';
		const isDisabled = await locals.pb
			.collection('users')
			.getOne(userId)
			.then((res) => !!res.disabled);

		console.log({ isDisabled, disable });

		if (isDisabled && disable) {
			return {
				status: 200,
				body: {
					result: true
				}
			};
		}

		const result = await locals.pb
			.collection('users')
			.update(userId, {
				disabled: disable ? new Date().toISOString() : ''
			})
			.then((res) => res.disabled);

		return {
			status: 200,
			body: {
				result
			}
		};
	},
	deleteUser: async ({ locals, request }) => {
		if (!locals.pb.authStore.isAdmin || !locals.pb.authStore.isValid) {
			return {
				status: 401,
				body: {
					result: false
				}
			};
		}

		const data = await request.formData();
		const userId = data.get('userId') as string;

		if (!userId) {
			return {
				status: 400,
				body: {
					result: false
				}
			};
		}

		const bookmarks = await locals.pb
			.collection('bookmarks')
			.getFullList({
				filter: `owner.id="${userId}"`,
				fields: 'id',
				batchSize: 10000
			})
			.then((res) => res.map((item) => item.id));
		const categories = await locals.pb
			.collection('categories')
			.getFullList({
				filter: `owner.id="${userId}"`,
				fields: 'id',
				batchSize: 10000
			})
			.then((res) => res.map((item) => item.id));
		const tags = await locals.pb
			.collection('tags')
			.getFullList({
				filter: `owner.id="${userId}"`,
				fields: 'id',
				batchSize: 10000
			})
			.then((res) => res.map((item) => item.id));

		await Promise.all([
			bookmarks.map((id) =>
				locals.pb.collection('bookmarks').delete(id, {
					requestKey: `remove-user-${userId}-bookmark-${id}}`
				})
			),
			categories.map((id) =>
				locals.pb.collection('categories').delete(id, {
					requestKey: `remove-user-${userId}-category-${id}}`
				})
			),
			tags.map((id) =>
				locals.pb.collection('tags').delete(id, {
					requestKey: `remove-user-${userId}-tag-${id}}`
				})
			)
		]);

		await locals.pb.collection('users').delete(userId);

		return {
			status: 200,
			body: {
				result: true
			}
		};
	}
} satisfies Actions;
