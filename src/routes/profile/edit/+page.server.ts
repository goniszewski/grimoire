import type { UserSettings } from '$lib/pb';
import type { Actions } from '../../$types';
import { pb } from '$lib/pb';

export const actions = {
	updateUser: async ({ locals, request }) => {},
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

		const success = await pb
			.collection('users')
			.update(owner, {
				settings
			})
			.then((res) => res.success)
			.catch((err) => {
				console.error('Error updating user settings. Details:', JSON.stringify(err, null, 2));
				return false;
			});

		return {
			success
		};
	}
} satisfies Actions;
