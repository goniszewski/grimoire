const defaultConfig = {
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
				'Act as a writer. Generate tags for the provided text. Output only the text and nothing else, do not chat, no preamble, get to the point.'
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
) {
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

export async function generateTags(
	prompt: string,
	model: string,
	options: {
		system?: string;
	} = {
		...defaultConfig.roles.generateTags
	}
) {
	return generate(prompt, model, options);
}
