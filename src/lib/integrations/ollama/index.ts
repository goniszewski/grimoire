import type { llmSettings } from '$lib/types/UserSettings.type';
import { validateUrlRegex } from '$lib/utils/regex-library';

export const defaultConfig = {
	url: 'http://localhost:11434/api',
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

export async function listAvailableModels() {
	return fetch(`${defaultConfig.url}/tags`)
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
	options: {
		system?: string;
	} = {
		...defaultConfig.roles.summarize
	}
): Promise<string> {
	return fetch(`${defaultConfig.url}/generate`, {
		method: 'POST',
		body: JSON.stringify({
			...defaultConfig.defaultOptions,
			system: options.system || defaultConfig.roles.summarize.system,
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
	options: {
		system?: string;
	} = {}
) {
	return generate(prompt, model, options);
}

export async function generateTags(prompt: string, options: llmSettings) {
	const serializedPrompt = prompt.replace(validateUrlRegex, '');

	switch (options.provider) {
		case 'ollama':
			const response = await generate(
				serializedPrompt.length > 1000 ? serializedPrompt.slice(0, 1000) : serializedPrompt,
				options.ollama?.model || 'orca-mini',
				{
					system: defaultConfig.roles.generateTags.system
				}
			);

			return response
				.split(',')
				.slice(0, 3)
				.map((tag) => (tag.split(':')[1] || tag).toLowerCase().trim());
	}
}

export async function getModels(url: string) {
	return fetch(`${url}/api/tags`)
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
