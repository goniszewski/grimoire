import { getMetadata } from '$lib/utils';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	const { url } = await request.json();

	console.log({ url });

	const metadata = await getMetadata(url);

	return json(
		{ metadata },
		{
			status: 200
		}
	);
}
