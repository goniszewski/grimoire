import type { Actions } from './$types';
import { db } from '$lib/database/db';
import {
    bookmarkSchema, bookmarksToTagsSchema, categorySchema, userSchema
} from '$lib/database/schema';
import { handlePBError, pb } from '$lib/pb';
import { Storage } from '$lib/storage/storage';
import { createSlug } from '$lib/utils/create-slug';
import { prepareTags } from '$lib/utils/handle-tags-input';
import { file } from 'bun';
import { and, eq } from 'drizzle-orm';

import type { UserSettings } from '$lib/types/UserSettings.type';
import type { Theme } from '$lib/enums/themes';

const storeImage = async (url: string, title: string, ownerId: number) => {
	const storage = new Storage();

	if (url && url.length > 0) {
		const arrayBuffer = await fetch(url).then((r) => r.arrayBuffer());
		const fileName = `${createSlug(title)}.${url.split('.').pop()}`;
		const imageFile = file(arrayBuffer);

		const [{ id }] = await storage.storeFile(imageFile, {
			ownerId,
			fileName
		});
		return id;
	}
};

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

			const bookmarkData: typeof bookmarkSchema.$inferInsert = {
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
				note
			};

			const [bookmark] = await db.insert(bookmarkSchema).values(bookmarkData).returning();

			if (!bookmark.id) {
				return handlePBError(bookmark, pb, true);
			}

			await Promise.all(
				tagIds.map((tagId) =>
					db.insert(bookmarksToTagsSchema).values({
						bookmarkId: bookmark.id,
						tagId
					})
				)
			);

			const mainImageId = await storeImage(mainImageUrl, title, ownerId);
			const iconId = await storeImage(iconUrl, title, ownerId);

			if (mainImageId || iconId) {
				await db
					.update(bookmarkSchema)
					.set({
						mainImageId: mainImageId,
						iconId: iconId
					})
					.where(eq(bookmarkSchema.id, bookmark.id));
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
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);

		await db.delete(bookmarkSchema).where(eq(bookmarkSchema.id, id));

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
		const category = JSON.parse(data.get('category') as string);
		const tags = data.get('tags') ? JSON.parse(data.get('tags') as string) : [];

		const tagIds = await prepareTags(db, tags, ownerId);

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
			owner: ownerId,
			title,
			url
		};

		const [bookmark] = await db
			.update(bookmarkSchema)
			.set(bookmarkData)
			.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)))
			.returning();

		await Promise.all(
			tagIds.map((tagId) =>
				db.insert(bookmarksToTagsSchema).values({
					bookmarkId: bookmark.id,
					tagId
				})
			)
		);

		const mainImageId = await storeImage(mainImageUrl, title, ownerId);
		const iconId = await storeImage(iconUrl, title, ownerId);

		if (mainImageId || iconId) {
			await db
				.update(bookmarkSchema)
				.set({
					mainImageId: mainImageId,
					iconId: iconId
				})
				.where(eq(bookmarkSchema.id, bookmark.id));
		}

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

		await db
			.update(bookmarkSchema)
			.set({ flagged })
			.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)));

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

		await db
			.update(bookmarkSchema)
			.set({ importance })
			.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)));

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

		await db
			.update(bookmarkSchema)
			.set({ read })
			.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)));

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

		const [{ opened_times }] = await db
			.select({
				opened_times: bookmarkSchema.openedTimes
			})
			.from(bookmarkSchema)
			.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)));

		await db
			.update(bookmarkSchema)
			.set({
				openedTimes: opened_times ?? 0 + 1,
				openedLast: new Date()
			})
			.where(and(eq(bookmarkSchema.id, id), eq(bookmarkSchema.ownerId, ownerId)));

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

		const categoryBody: typeof categorySchema.$inferInsert = {
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

		const [{ id }] = await db.insert(categorySchema).values(categoryBody).returning({
			id: categorySchema.id
		});

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

		const categoryBody: Partial<typeof categorySchema.$inferInsert> = {
			name,
			slug: createSlug(name),
			description,
			icon,
			color,
			parentId: parentValue === 'null' ? null : parentValue,
			archived,
			public: setPublic
		};

		await db
			.update(categorySchema)
			.set(categoryBody)
			.where(and(eq(categorySchema.id, id), eq(categorySchema.ownerId, ownerId)));

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

		await db
			.delete(categorySchema)
			.where(and(eq(categorySchema.id, id), eq(categorySchema.ownerId, ownerId)));

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
		const existingSettings = await db
			.select({
				settings: userSchema.settings
			})
			.from(userSchema)
			.where(eq(userSchema.id, ownerId));

		try {
			await db
				.update(userSchema)
				.set({
					settings: {
						...existingSettings[0].settings,
						theme
					}
				})
				.where(eq(userSchema.id, ownerId));

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
