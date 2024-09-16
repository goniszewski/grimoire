import { getMetadata } from '$lib/utils/get-metadata';
import chalk from 'chalk';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { url } = await request.json();

	console.debug('Fetching metadata for URL: ', chalk.blue.underline(url) + '\n');
	const metadata = await getMetadata(url);
	console.debug('Fetched metadata', {
		...metadata,
		contentHtml: `${metadata.contentHtml.slice(0, 100)}...`,
		contentText: `${metadata.contentText.slice(0, 100)}...`
	});

	return json(
		{ metadata },
		{
			status: 200
		}
	);
};
