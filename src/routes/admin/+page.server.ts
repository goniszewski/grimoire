import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { AdminData, Settings } from '$lib/types/Admin.type';
import { getBookmarksCountForUser } from '$lib/database/repositories/Bookmark.repository';
import { getCategoryCountForUser } from '$lib/database/repositories/Category.repository';
import { getTagCountForUser } from '$lib/database/repositories/Tag.repository';
import {
    deleteUser, disableUser, getUsersForAdminPanel, isUserDisabled
} from '$lib/database/repositories/User.repository';

//load cookie from request
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdmin) {
		return {
			status: 401
		};
	}

	const adminData: AdminData = {
		users: [],
		bookmarksTotalCount: 0,
		backups: [],
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

	adminData.users = await getUsersForAdminPanel();
	await Promise.all(
		adminData.users.map(async (user) => [
			(user.bookmarksCount = await getBookmarksCountForUser(user.id)),
			(user.categoriesCount = await getCategoryCountForUser(user.id)),
			(user.tagsCount = await getTagCountForUser(user.id))
		])
	);

	return {
		adminData
	};
};

export const actions = {
	updateSettings: async ({ locals, request }) => {
		const data = await request.formData();
		const settings = JSON.parse(data.get('settings') as string);

		const configValidations = <Record<string, any>>{};

		// TODO: re-add admin configs
		// const result = await locals.pb.settings.update(settings);

		// if (settings.s3StorageEnabled) {
		// 	configValidations.s3Storage = await locals.pb.settings.testS3('storage').catch(() => false);
		// }
		// if (settings.backupsS3Enabled) {
		// 	configValidations.s3Backups = await locals.pb.settings.testS3('backups').catch(() => false);
		// }

		// return {
		// 	status: 200,
		// 	body: {
		// 		result,
		// 		configValidations
		// 	}
		// };
	},
	toggleUserDisabled: async ({ locals, request }) => {
		if (!locals.user?.isAdmin) {
			return {
				status: 401,
				body: {
					result: false
				}
			};
		}

		const data = await request.formData();
		const userId = parseInt(data.get('userId') as string, 10);
		const disable = data.get('disable') === 'true';
		const isDisabled = await isUserDisabled(userId);

		if (isDisabled && disable) {
			return {
				status: 200,
				body: {
					result: true
				}
			};
		}

		const result = await disableUser(userId);

		return {
			status: 200,
			body: {
				result
			}
		};
	},
	deleteUser: async ({ locals, request }) => {
		if (!locals.user?.isAdmin) {
			return {
				status: 401,
				body: {
					result: false
				}
			};
		}

		const data = await request.formData();
		const userId = parseInt(data.get('userId') as string, 10);

		if (!userId) {
			return {
				status: 400,
				body: {
					result: false
				}
			};
		}

		await Promise.all([
			// TODO: remove all user files
		]);

		await deleteUser(userId);

		return {
			status: 200,
			body: {
				result: true
			}
		};
	}
} satisfies Actions;
