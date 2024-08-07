import type { Actions } from './$types';
import { db } from '$lib/database/db';
import {
	addTagToBookmark,
	createBookmark,
	deleteBookmark,
	getBookmarkById,
	updateBookmark
} from '$lib/database/repositories/Bookmark.repository';
import {
	createCategory,
	deleteCategory,
	updateCategory
} from '$lib/database/repositories/Category.repository';
import { updateUserSettings } from '$lib/database/repositories/User.repository';
import { Storage } from '$lib/storage/storage';
import { createSlug } from '$lib/utils/create-slug';
import { prepareTags } from '$lib/utils/handle-tags-input';

import type { Theme } from '$lib/enums/themes';

const storage = new Storage();

export const actions = {
	addNewBookmark: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}
		const data = await request.formData();

		try {
			const url = data.get('url') as string;
			const domain = data.get('domain') as string;
			const title = data.get('title') as string;
			const description = data.get('description') as string;
			const author = data.get('author') as string;
			const contentText = data.get('content_text') as string;
			const contentHtml = data.get('content_html') as string;
			const contentType = data.get('content_type') as string;
			const contentPublishedDate = data.get('content_published_date') as string;
			const mainImageUrl = data.get('main_image_url') as string;
			const iconUrl = data.get('icon_url') as string;
			const note = data.get('note') as string;
			const importance = parseInt((data.get('importance') || '0') as string);
			const flagged = data.get('flagged') === 'on' ? new Date() : null;
			const category = JSON.parse(data.get('category') as string);
			const tags = data.get('tags') ? JSON.parse(data.get('tags') as string) : [];

			const tagIds = await prepareTags(db, tags, ownerId);

			const mainImageId = await storage.storeImage(mainImageUrl, title, ownerId);
			const iconId = await storage.storeImage(iconUrl, title, ownerId);

			const bookmarkData = {
				ownerId,
				url,
				author,
				categoryId: category?.value ? category.value : category,
				title,
				contentHtml,
				contentPublishedDate,
				contentText,
				contentType,
				description,
				domain,
				flagged,
				iconUrl,
				importance,
				mainImageUrl,
				note,
				mainImageId,
				iconId
			};

			const bookmark = await createBookmark(ownerId, bookmarkData);

			if (!bookmark.id) {
				return {
					success: false,
					error: 'Failed to add bookmark'
				};
			}

			await Promise.all(tagIds.map((tagId) => addTagToBookmark(bookmark.id, ownerId, tagId)));

			return {
				bookmark,
				success: true
			};
		} catch (e: any) {
			return {
				success: false,
				error: e.message
			};
		}
	},
	deleteBookmark: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);

		await deleteBookmark(id, ownerId);

		return {
			id,
			success: true
		};
	},
	updateBookmark: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		console.log('Got data');

		const id = parseInt(data.get('id') as string, 10);
		const url = data.get('url') as string;
		const domain = data.get('domain') as string;
		const title = data.get('title') as string;
		const description = data.get('description') as string;
		const author = data.get('author') as string;
		const contentText = data.get('content_text') as string;
		const contentHtml = data.get('content_html') as string;
		const contentType = data.get('content_type') as string;
		const contentPublishedDate = data.get('content_published_date') as string;
		const mainImageUrl = data.get('main_image_url') as string;
		const iconUrl = data.get('icon_url') as string;
		const note = data.get('note') as string;
		const importance = parseInt((data.get('importance') || '0') as string);
		const flagged = data.get('flagged') === 'on' ? new Date() : null;
		const category = data.get('category') ? JSON.parse(data.get('category') as string) : null;
		const tags = data.get('tags') ? JSON.parse(data.get('tags') as string) : [];
		const read = data.get('read') === 'on' ? new Date() : null;

		const tagIds = await prepareTags(db, tags, ownerId);
		console.log('Prepared tags');

		const mainImageId = await storage.storeImage(mainImageUrl, title, ownerId);
		const iconId = await storage.storeImage(iconUrl, title, ownerId);
		console.log('Stored images');

		const bookmarkData = {
			author,
			category: category?.value ? category.value : category,
			tags: tagIds,
			contentHtml,
			contentPublishedDate,
			contentText,
			contentType,
			description,
			domain,
			flagged,
			iconUrl,
			importance,
			mainImageUrl,
			note,
			title,
			url,
			read,
			...(mainImageId ? { mainImageId } : {}),
			...(iconId ? { iconId } : {})
		};
		console.log('Prepared bookmark data');

		const bookmark = await updateBookmark(id, ownerId, bookmarkData);
		console.log('Updated bookmark');

		await Promise.all(tagIds.map((tagId) => addTagToBookmark(bookmark.id, ownerId, tagId)));
		console.log('Added tags to bookmark');

		return {
			bookmark,
			success: true
		};
	},
	updateFlagged: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		const flagged = data.get('flagged') === 'on' ? new Date() : null;

		await updateBookmark(id, ownerId, { flagged });

		return {
			success: true
		};
	},
	updateImportance: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		const importance = parseInt((data.get('importance') || '0') as string);

		await updateBookmark(id, ownerId, { importance });

		return {
			success: true
		};
	},

	updateRead: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		const read = data.get('read') === 'on' ? new Date() : null;

		await updateBookmark(id, ownerId, { read });

		return {
			success: true
		};
	},

	updateIncreasedOpenedCount: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);

		const bookmark = await getBookmarkById(id, ownerId);

		if (!bookmark) {
			return {
				success: false,
				error: 'Bookmark not found'
			};
		}

		await updateBookmark(id, ownerId, {
			openedTimes: bookmark.openedTimes + 1,
			openedLast: new Date()
		});

		return {
			success: true
		};
	},
	addNewCategory: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
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
		const archived = data.get('archived') === 'on' ? new Date() : null;
		const setPublic = data.get('public') === 'on' ? new Date() : null;

		const categoryBody = {
			name,
			slug: createSlug(name),
			description,
			icon,
			color,
			parentId: parentValue === 'null' ? null : parentValue,
			archived,
			public: setPublic,
			ownerId,
			initial: false
		};

		const { id } = await createCategory(ownerId, categoryBody);

		return {
			id,
			success: true
		};
	},
	updateCategory: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();

		const id = parseInt(data.get('id') as string, 10);
		const name = data.get('name') as string;
		const description = data.get('description') as string;
		const icon = data.get('icon') as string;
		const color = data.get('color') as string;
		const parent = JSON.parse(data.get('parent') as string);
		const parentValue = parent?.value ? parent.value : parent;
		const archived = data.get('archived') === 'on' ? new Date() : null;
		const setPublic = data.get('public') === 'on' ? new Date() : null;

		const categoryBody = {
			name,
			slug: createSlug(name),
			description,
			icon,
			color,
			parentId: parentValue === 'null' ? null : parentValue,
			archived,
			public: setPublic
		};

		await updateCategory(id, ownerId, categoryBody);

		return {
			success: true
		};
	},
	deleteCategory: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);

		await deleteCategory(id, ownerId);

		return {
			success: true
		};
	},
	changeTheme: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false
			};
		}

		const data = await request.formData();
		const theme = data.get('theme') as Theme;

		try {
			await updateUserSettings(ownerId, {
				theme
			});
			console.debug('User theme updated');

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
