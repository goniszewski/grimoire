import type { Actions, PageServerLoad } from './$types';
import { pb } from '$lib/pb';
import type { Category } from '$lib/interfaces/Category.interface';
import { getFileUrl } from '$lib/utils';

export const load = (async ({ locals }) => {
	if (!locals.user) {
		return {
			categories: [],
			bookmarks: [],
			status: 401
		};
	}

	const categories = await pb.collection('categories').getList<Category>(1, 1000, {
		filter: `owner = "${locals.user!.id}"`,
		sort: 'name'
	});

	const bookmarks = await pb.collection('bookmarks').getList(1, 50, {
		filter: `owner = "${locals.user!.id}"`,
		expand: 'tags,category',
		sort: '-created'
	});

	return {
		categories: structuredClone(categories.items),
		bookmarks: structuredClone(
			bookmarks.items.map((bookmark) => ({
				// TODO: export this logic to a function
				...bookmark,
				main_image: getFileUrl('bookmarks', bookmark.id, bookmark.main_image),
				icon: getFileUrl('bookmarks', bookmark.id, bookmark.icon),
				...bookmark.expand
			}))
		)
	};
}) satisfies PageServerLoad;

export const actions = {
	updateImportance: async ({ request, locals }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const importance = data.get('importance');

		const { success } = await pb.collection('bookmarks').update(id, {
			importance
		});

		return {
			success
		};
	},
	addNewBookmark: async ({ request, locals }) => {
		const owner = locals.user!.id;
		const data = await request.formData();

		const url = data.get('url');
		const domain = data.get('domain');
		const title = data.get('title');
		const description = data.get('description');
		const author = data.get('author');
		const content_text = data.get('content_text');
		const content_html = data.get('content_html');
		const content_type = data.get('content_type');
		const content_published_date = data.get('content_published_date');
		const main_image_url = data.get('main_image_url');
		const icon_url = data.get('icon_url');
		const note = data.get('note');
		const importance = data.get('importance');
		const flagged = data.get('flagged') === 'on' ? new Date().toISOString() : null;
		const category = data.get('category');

		const { id } = await pb.collection('bookmarks').create({
			owner,
			url,
			domain,
			title,
			description,
			author,
			content_text,
			content_html,
			content_type,
			content_published_date,
			main_image_url,
			icon_url,
			note,
			importance,
			flagged,
			category
		});

		if (!id) {
			return {
				success: false
			};
		}

		if (main_image_url || icon_url) {
			const attachments = new FormData();

			if (main_image_url) {
				const main_image = await fetch(main_image_url as string).then((r) => r.blob());
				attachments.append('main_image', main_image);
			}

			if (icon_url) {
				const icon = await fetch(icon_url as string).then((r) => r.blob());
				console.log('icon', icon.size, 'bytes');
				attachments.append('icon', icon);
			}

			await pb.collection('bookmarks').update(id, attachments);
		}
		return {
			success: true,
			id
		};
	}
} satisfies Actions;
