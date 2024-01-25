import config from '$lib/config';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const url = config.POCKETBASE_URL + '/api/files' + request.url.split('/internal/files')[1];

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Authorization: request.headers.get('Authorization') ?? ''
		}
	});

	const body = await response.blob();

	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});
};
