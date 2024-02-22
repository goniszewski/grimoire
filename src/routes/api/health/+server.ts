import { json } from '@sveltejs/kit';

import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json(
		{
			currentServerTime: new Date().toISOString()
		},
		{
			status: 200
		}
	);
};
