import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { pb } from '$lib/pb';

import type { AdminData, Settings } from '$lib/types/Admin.type';

//load cookie from request
export const load: PageServerLoad = async ({ params }) => {
	if (!pb.authStore.isAdmin || !pb.authStore.isValid) {
		return {
			status: 401
		};
	}

	const adminData: AdminData = {
		users: [],
		bookmarksTotalCount: 0,
		backups: [],
		s3Test: false,
		settings: {} as Settings
	};

	adminData.users = await pb.collection('users').getFullList();
	adminData.bookmarksTotalCount = await pb
		.collection('bookmarks')
		.getList(1, 1, {
			fields: 'id',
			count: true,
			requestKey: 'admin-bookmarksTotalCount'
		})
		.then((res) => res.totalItems);
	adminData.backups = await pb.backups.getFullList();
	adminData.s3Test = await pb.settings.testS3('backups').catch(() => false);
	adminData.settings = (await pb.settings.getAll()) as Settings;

	return {
		adminData
	};
};

const actions = {
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
	}
} satisfies Actions;
