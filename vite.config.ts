import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	console.log(JSON.stringify(env.ORIGIN), JSON.stringify('http://localhost:3000'));

	return {
		define: {
			'process.env.PUBLIC_ORIGIN': JSON.stringify(env.ORIGIN || 'http://localhost:5173')
		},
		plugins: [sveltekit()],
		server: {
			proxy: {
				'/internal': {
					target: env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090',
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/internal/, '')
				}
			}
		},
		test: {
			include: ['src/**/*.{test,spec}.{js,ts}']
		}
	};
});
