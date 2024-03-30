import express from 'express';
import proxy from 'express-http-proxy';

import { handler } from '../build/handler.js';

const app = express();

const config = {
	POCKETBASE_URL: process.env.PUBLIC_POCKETBASE_URL || 'http://pocketbase',
	PORT: process.env.PORT || 5137,
	INTERNAL_PATH: '/internal/pb'
};

app.use(
	config.INTERNAL_PATH,
	proxy(config.POCKETBASE_URL, {
		proxyReqPathResolver: function (req) {
			return req.url.replace(config.INTERNAL_PATH, '');
		}
	})
);

app.use(handler);

app.listen(process.env.PORT || 5137, () => {
	console.log(`Server is running on http://localhost:${config.PORT}`);
});
