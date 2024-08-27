import type { Actions } from '../$types';

import type { UserSettings } from '$lib/types/UserSettings.type';
import { updateUserSettings } from '$lib/database/repositories/User.repository';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		user: locals.user
	};
};

export const actions = {
	updateUserSettings: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const settings = JSON.parse(data.get('settings') as string) as UserSettings;

		const updatedSettings = await updateUserSettings(owner, settings)
			.then(({ settings }) => settings)
			.catch((err) => {
				console.error('Error updating user settings. Details:', JSON.stringify(err, null, 2));
				return null;
			});

		if (!updatedSettings) {
			return {
				success: false,
				error: 'Error updating user settings'
			};
		}

		return {
			updatedSettings
		};
	}
} satisfies Actions;
