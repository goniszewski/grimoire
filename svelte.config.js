import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const packagePath = fileURLToPath(new URL('package.json', import.meta.url));
const packageJson = readFileSync(packagePath, 'utf-8');
const PKG = JSON.parse(packageJson);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess({
		postcss: true
	}),

	kit: {
		adapter: adapter(),
		version: { name: PKG.version },
		csrf: {
			checkOrigin: false
		}
	}
};

export default config;
