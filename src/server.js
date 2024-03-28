import express from 'express';
import proxy from 'express-http-proxy';

import { handler } from '../build/handler.js';
import { urls } from '$lib/enums/urls.js';

const app = express();

const config = {
	POCKETBASE_URL: process.env.PUBLIC_POCKETBASE_URL || 'http://pocketbase',
	PORT: process.env.PORT || 5137
};

app.use(
	urls.INTERNAL_PB,
	proxy(config.POCKETBASE_URL, {
		proxyReqPathResolver: function (req) {
			return req.url.replace(urls.INTERNAL_PB, '');
		}
	})
);

app.use(handler);

app.listen(process.env.PORT || 5137, () => {
	console.log(`Server is running on http://localhost:${config.PORT}`);
});
