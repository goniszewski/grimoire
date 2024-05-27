import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

import handler from '../build/handler.js';

const app = express();

const config = {
	POCKETBASE_URL: process.env.PUBLIC_POCKETBASE_URL || 'http://pocketbase',
	PORT: process.env.PORT || 5137,
	INTERNAL_PATH: '/internal/pb'
};

app.use(
	config.INTERNAL_PATH,
	createProxyMiddleware({
		target: config.POCKETBASE_URL,
		changeOrigin: true,
		ws: true,
		pathRewrite: (path) => path.replace(config.INTERNAL_PATH, '')
	})
);

app.use(handler);

app.listen(process.env.PORT || 5137, () => {
	console.log(`Server is running on http://localhost:${config.PORT}`);
});
