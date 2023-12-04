import { pb } from '$lib/pb.js';
import { getFileUrl } from '$lib/utils';

import { json } from '@sveltejs/kit';

export async function GET({ locals, url }) {
	const owner = locals.user?.id;

	if (!owner) {
		return json(
			{
				success: false,
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	}

	const { searchParams } = url;
	const ids = JSON.parse(searchParams.get('ids') || '[]') as string[];

	try {
		const bookmarks = await pb
			.collection('bookmarks')
			.getFullList({
				filter: ids.map((id) => `id="${id}"`).join('||'),
				expand: 'tags.name'
			})
			.then((res) =>
				res.map((bookmark) => ({
					...bookmark,
					icon: getFileUrl('bookmarks', bookmark.id, bookmark.icon),
					main_image: getFileUrl('bookmarks', bookmark.id, bookmark.main_image),
					...bookmark.expand
				}))
			);

		return json(
			{ bookmarks },
			{
				status: 200
			}
		);
	} catch (error: any) {
		return json(
			{
				success: false,
				error: error?.message
			},
			{
				status: 500
			}
		);
	}
}
