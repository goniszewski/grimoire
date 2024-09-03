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

		const settings = await request.formData();

		const mappedSettings: UserSettings = {
			theme: settings.get('theme') as UserSettings['theme'],
			uiAnimations: settings.get('uiAnimations') === 'on',
			llm: {
				enabled: settings.get('llmEnabled') === 'on',
				provider: settings.get('llmProvider') as UserSettings['llm']['provider'],
				ollama: {
					url: settings.get('llmOllamaUrl') as string,
					model: settings.get('llmOllamaModel') as string,
					summarize: {
						enabled: settings.get('llmOllamaSummarizeEnabled') === 'on',
						system: settings.get('llmOllamaSystemmsg') as string
					},
					generateTags: {
						enabled: settings.get('llmOllamaGenerateTagsEnabled') === 'on',
						system: settings.get('llmOllamaSystemmsg') as string
					}
				},
				openai: {
					apiKey: settings.get('llmOpenaiApikey') as string
				}
			}
		};

		console.log('Received mappedSettings:', JSON.stringify(mappedSettings, null, 2));

		const updatedSettings = await updateUserSettings(owner, mappedSettings)
			.then(({ settings }) => settings)
			.catch((err) => {
				console.error('Error updating user settings. Details:', JSON.stringify(err, null, 2));
				return null;
			});

		console.log('Updated settings:', JSON.stringify(updatedSettings, null, 2));

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
