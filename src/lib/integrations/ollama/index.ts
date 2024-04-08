import type { ollamaSettings } from '$lib/types/UserSettings.type';
import { validateUrlRegex } from '$lib/utils';

export const defaultConfig = {
	url: 'http://localhost:11434',
	defaultOptions: {
		stream: false
	},
	roles: {
		summarize: {
			system:
				'Act as a writer. Summarize the provided content of a website. Output only the text and nothing else, do not chat, no preamble, get to the point.'
		},
		generateTags: {
			system:
				'Act as a writer. Generate most appropriate tags for the provided text. Write only three comma separated tags, output only the text and nothing else, do not chat, no preamble, get to the point.'
		}
	}
};

const getValidApiUrl = (url: string) => {
	switch (url.length > 0) {
		case url.endsWith('/api/'):
			return url.slice(0, -5);
		case url.endsWith('/api'):
			return url.slice(0, -4);
		case url.endsWith('/'):
			return url.slice(0, -1);
		default:
			return url;
	}
};

export async function listAvailableModels(providedConfig: Partial<ollamaSettings> = {}) {
	return fetch(`${getValidApiUrl(providedConfig?.url || defaultConfig.url)}/api/tags`)
		.then((res) => res.json())
		.then(
			(res: {
				models: {
					name: string;
					description: string;
				}[];
			}) => res.models.map((model) => model.name)
		);
}

async function generate(
	prompt: string,
	model: string,
	providedConfig: Partial<ollamaSettings> = {}
): Promise<string> {
	return fetch(`${getValidApiUrl(providedConfig?.url || defaultConfig.url)}/api/generate`, {
		method: 'POST',
		body: JSON.stringify({
			...defaultConfig.defaultOptions,
			system: providedConfig?.summarize?.system || defaultConfig.roles.summarize.system,
			prompt,
			model
		})
	})
		.then((res) => res.json())
		.then((res) => res.response);
}

export async function summarize(
	prompt: string,
	model: string,
	providedConfig: Partial<ollamaSettings> = {}
) {
	return generate(prompt, model, providedConfig);
}

export async function generateTags(prompt: string, options: ollamaSettings) {
	const serializedPrompt = prompt.replace(validateUrlRegex, '');

	const response = await generate(
		serializedPrompt.length > 1000 ? serializedPrompt.slice(0, 1000) : serializedPrompt,
		options?.model || 'orca-mini',
		options
	);

	return response
		.split(',')
		.slice(0, 3)
		.map((tag) => (tag.split(':')[1] || tag).toLowerCase().trim());
}
