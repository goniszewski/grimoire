import { version } from '$app/environment';
import { getUserCount } from '$lib/database/repositories/User.repository';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const dbConnected = await getUserCount().then((count) => count >= 0);

	return json(
		{
			currentServerTime: new Date().toISOString(),
			database: dbConnected ? 'CONNECTED' : 'FAILED TO CONNECT',
			appVersion: version
		},
		{
			status: 200
		}
	);
};
