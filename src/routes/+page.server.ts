import type { Actions } from './$types';
import { handlePBError, pb } from '$lib/pb';
import { checkIfImageURL } from '$lib/utils/check-if-image-url';
import { createSlug } from '$lib/utils/create-slug';
import { prepareTags } from '$lib/utils/handle-tags-input';

import type { Bookmark } from '$lib/types/Bookmark.type';

export const actions = {
	addNewBookmark: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}
		const data = await request.formData();

		try {
			const url = data.get('url');
			const domain = data.get('domain');
			const title = data.get('title');
			const description = data.get('description');
			const author = data.get('author');
			const content_text = data.get('content_text');
			const content_html = data.get('content_html');
			const content_type = data.get('content_type');
			const content_published_date = data.get('content_published_date');
			const main_image_url = data.get('main_image_url') as string;
			const icon_url = data.get('icon_url') as string;
			const note = data.get('note');
			const importance = data.get('importance');
			const flagged = data.get('flagged') === 'on' ? new Date().toISOString() : null;
			const category = JSON.parse(data.get('category') as string);
			const tags = data.get('tags') ? JSON.parse(data.get('tags') as string) : [];

			const tagIds = await prepareTags(pb, tags, owner);

			const bookmark = (await pb.collection('bookmarks').create({
				author,
				category: category?.value ? category.value : category,
				tags: tagIds,
				content_html,
				content_published_date,
				content_text,
				content_type,
				description,
				domain,
				flagged,
				icon_url,
				importance,
				main_image_url,
				note,
				owner,
				title,
				url
			})) as Bookmark;

			if (!bookmark.id) {
				return handlePBError(bookmark, pb, true);
			}

			if (main_image_url || icon_url) {
				const attachments = new FormData();

				if (main_image_url && checkIfImageURL(main_image_url)) {
					const main_image = await fetch(main_image_url as string).then((r) => r.blob());
					attachments.append('main_image', main_image);
				}

				if (icon_url && checkIfImageURL(icon_url)) {
					const icon = await fetch(icon_url as string).then((r) => r.blob());
					attachments.append('icon', icon);
				}

				await pb.collection('bookmarks').update(bookmark.id, attachments);
			}
			return {
				bookmark,
				success: true
			};
		} catch (e: any) {
			return handlePBError(e, pb, true);
		}
	},
	deleteBookmark: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = data.get('id') as string;

		await pb.collection('bookmarks').delete(id);

		return {
			id,
			success: true
		};
	},
	updateBookmark: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		let bookmark: Bookmark;

		const id = data.get('id') as string;
		const url = data.get('url');
		const domain = data.get('domain');
		const title = data.get('title');
		const description = data.get('description');
		const author = data.get('author');
		const content_text = data.get('content_text');
		const content_html = data.get('content_html');
		const content_type = data.get('content_type');
		const content_published_date = data.get('content_published_date');
		const main_image_url = data.get('main_image_url') as string;
		const icon_url = data.get('icon_url') as string;
		const note = data.get('note');
		const importance = data.get('importance');
		const flagged = data.get('flagged') === 'on' ? new Date().toISOString() : null;
		const category = JSON.parse(data.get('category') as string);
		const tags = data.get('tags') ? JSON.parse(data.get('tags') as string) : [];

		const tagIds = await prepareTags(pb, tags, owner);

		bookmark = (await pb
			.collection('bookmarks')
			.update(
				id,
				{
					author,
					category: category?.value ? category.value : category,
					tags: tagIds,
					content_html,
					content_published_date,
					content_text,
					content_type,
					description,
					domain,
					flagged,
					icon_url,
					importance,
					main_image_url,
					note,
					owner,
					title,
					url
				},
				{
					expand: 'tags,category'
				}
			)
			.then((res) => ({
				...res,
				...res.expand
			}))) as Bookmark;

		if (main_image_url || icon_url) {
			const attachments = new FormData();

			if (main_image_url && checkIfImageURL(main_image_url)) {
				const main_image = await fetch(main_image_url as string).then((r) => r.blob());
				attachments.append('main_image', main_image);
			}

			if (icon_url && checkIfImageURL(icon_url)) {
				const icon = await fetch(icon_url as string).then((r) => r.blob());
				attachments.append('icon', icon);
			}

			bookmark = (await pb
				.collection('bookmarks')
				.update(id, attachments, {
					expand: 'tags,category'
				})
				.then((res) => ({
					...res,
					...res.expand
				}))) as Bookmark;
		}
		return {
			bookmark,
			success: true
		};
	},
	updateFlagged: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = data.get('id') as string;
		const flagged = data.get('flagged') === 'on' ? new Date().toISOString() : null;

		const { success } = await pb.collection('bookmarks').update(id, {
			flagged
		});

		return {
			success
		};
	},
	updateImportance: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

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

	updateRead: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = data.get('id') as string;
		const read = data.get('read') === 'on' ? new Date().toISOString() : null;

		const { success } = await pb.collection('bookmarks').update(id, {
			read
		});

		return {
			success
		};
	},

	updateIncreasedOpenedCount: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = data.get('id') as string;

		const currentOpenedCount = (await pb.collection('bookmarks').getOne(id))?.opened_times || 0;

		const { success } = await pb.collection('bookmarks').update(id, {
			opened_times: currentOpenedCount + 1,
			opened_last: new Date().toISOString()
		});

		return {
			success
		};
	},
	addNewCategory: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}
		const data = await request.formData();

		const name = data.get('name') as string;
		const description = data.get('description') as string;
		const icon = data.get('icon') as string;
		const color = data.get('color') as string;
		const parent = JSON.parse(data.get('parent') as string);
		const parentValue = parent?.value ? parent.value : parent;
		const archived = data.get('archived') === 'on' ? new Date().toISOString() : null;
		const setPublic = data.get('public') === 'on' ? new Date().toISOString() : null;

		const requestBody = {
			name,
			slug: createSlug(name),
			description,
			icon,
			color,
			parent: parentValue === 'null' ? null : parentValue,
			archived,
			public: setPublic,
			owner,
			initial: false,
			created: new Date().toISOString(),
			updated: new Date().toISOString()
		};

		const { id } = await pb.collection('categories').create(requestBody);

		return {
			id,
			success: true
		};
	},
	updateCategory: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();

		const id = data.get('id') as string;
		const name = data.get('name') as string;
		const description = data.get('description') as string;
		const icon = data.get('icon') as string;
		const color = data.get('color') as string;
		const parent = JSON.parse(data.get('parent') as string);
		const parentValue = parent?.value ? parent.value : parent;
		const archived = data.get('archived') === 'on' ? new Date().toISOString() : null;
		const setPublic = data.get('public') === 'on' ? new Date().toISOString() : null;

		const requestBody = {
			name,
			slug: createSlug(name),
			description,
			icon,
			color,
			parent: parentValue === 'null' ? null : parentValue,
			archived,
			public: setPublic,
			updated: new Date().toISOString()
		};

		const { success } = await pb.collection('categories').update(id, requestBody);

		return {
			success
		};
	},
	deleteCategory: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false
			};
		}

		const data = await request.formData();
		const id = data.get('id') as string;

		await pb.collection('categories').delete(id);

		return {
			success: true
		};
	},
	changeTheme: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return {
				success: false
			};
		}

		const data = await request.formData();
		const theme = data.get('theme') as string;
		const existingSettings = await pb
			.collection('users')
			.getOne(owner)
			.then((res) => res?.settings || {});

		try {
			await pb.collection('users').update(owner, {
				settings: {
					...existingSettings,
					theme
				}
			});

			return {
				success: true
			};
		} catch (e) {
			return {
				success: false
			};
		}
	}
} satisfies Actions;
