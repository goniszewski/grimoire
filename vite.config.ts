import { defineConfig } from 'vitest/config';

import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(() => {
	return {
		plugins: [sveltekit()],
		test: {
			include: ['src/**/*.{test,spec}.{js,ts}']
		}
	};
});
