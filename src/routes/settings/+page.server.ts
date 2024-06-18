import type { Actions } from '../$types';

import type { UserSettings } from '$lib/types/UserSettings.type';
import type { User } from '$lib/types/User.type';
import { db } from '$lib/database/db';
import { userSchema } from '$lib/database/schema';
import { eq } from 'drizzle-orm';

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
		const [currentSettings] = await db
			.select({
				settings: userSchema.settings
			})
			.from(userSchema)
			.where(eq(userSchema.id, owner));

		const updatedSettings = await db
			.update(userSchema)
			.set({
				settings: {
					...currentSettings.settings,
					...settings
				}
			})
			.where(eq(userSchema.id, owner))
			.returning({
				settings: userSchema.settings
			})
			.then(([{ settings }]) => settings)
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
