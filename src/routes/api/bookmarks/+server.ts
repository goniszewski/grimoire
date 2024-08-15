import { db } from '$lib/database/db';
import {
    createBookmark, deleteBookmark, getBookmarkById, getBookmarkByUrl, getBookmarksByIds,
    setScreenshotToBookmark, updateBookmark, upsertTagsForBookmark
} from '$lib/database/repositories/Bookmark.repository';
import { getTagsByUserId } from '$lib/database/repositories/Tag.repository';
import { FileSourceEnum } from '$lib/enums/files';
import { Storage } from '$lib/storage/storage';
import { getMetadata } from '$lib/utils/get-metadata';
import { initializeSearch, searchIndexKeys } from '$lib/utils/search';
import { urlDataToBlobConverter } from '$lib/utils/url-data-to-blob-converter';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';
import type { Bookmark } from '$lib/types/Bookmark.type.js';
import type {
	AddBookmarkRequestBody,
	UpdateBookmarkRequestBody
} from '$lib/types/api/Bookmarks.type';

const storage = new Storage();

const prepareRequestedTags = (
	requestBody: AddBookmarkRequestBody | UpdateBookmarkRequestBody,
	userTags: { id: number; name: string }[]
): {
	label: string;
	value: string;
}[] => {
	return (
		requestBody.tags?.reduce(
			(acc, tag) => {
				const existingTag = userTags.find((userTag) => userTag.name === tag);

				if (!existingTag) {
					acc.push({
						label: tag,
						value: tag
					});
				} else {
					acc.push({
						label: existingTag.name,
						value: existingTag.id.toString()
					});
				}

				return acc;
			},
			[] as { label: string; value: string }[]
		) || []
	);
};

const getBookmarksByFilter = async (filter: string, ownerId: number) => {
	const records = await db.query.bookmarkSchema.findMany({
		where: (bookmarks, { eq }) => eq(bookmarks.ownerId, ownerId),
		columns: searchIndexKeys.reduce(
			(acc, key) => ({
				...acc,
				[key]: true
			}),
			{ id: true }
		),
		with: {
			tags: {
				with: {
					tag: true
				}
			}
		}
	});

	const serializedRecords = records.map(({ tags, ...record }) => ({
		...record,
		tags: tags.map(({ tag }) => tag.name)
	}));

	const searchEngine = initializeSearch(records);
	const res = searchEngine.search(filter).map((b) => b.item);
	return res;
};

export const GET: RequestHandler = async ({ locals, url }) => {
	let bookmarks: Bookmark[] = [];
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const idsParam: number[] =
		url.searchParams
			.get('ids')
			?.split(',')
			.map((id: string) => parseInt(id, 10)) || [];
	const urlParam = url.searchParams.get('url');
	const filterParam = url.searchParams.get('filter');

	try {
		if (urlParam) {
			const bookmark = await getBookmarkByUrl(urlParam, ownerId);
			bookmarks = bookmark ? [bookmark] : [];
		} else if (filterParam) {
			bookmarks = await getBookmarksByFilter(filterParam, ownerId);
		} else {
			bookmarks = await getBookmarksByIds(idsParam, ownerId);
		}

		return json({ bookmarks }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = await request.json();

	const oldValidationSchema = joi.object({
		url: joi.string().uri().required(),
		title: joi.string().required(),
		description: joi.string().allow('').optional(),
		author: joi.string().allow('').optional(),
		content_text: joi.string().allow('').optional(),
		content_html: joi.string().allow('').optional(),
		content_type: joi.string().allow('').optional(),
		content_published_date: joi.date().allow(null).optional(),
		note: joi.string().allow('').optional(),
		main_image_url: joi.string().allow('').optional(),
		icon_url: joi.string().allow('').optional(),
		icon: joi.string().allow('').optional(),
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.number().required(),
		tags: joi.array().items(joi.string().optional()).optional(),
		screenshot: joi.string().allow('').optional()
	});

	const newValidationSchema = joi.object({
		url: joi.string().uri().required(),
		title: joi.string().required(),
		description: joi.string().allow('').optional(),
		author: joi.string().allow('').optional(),
		contentText: joi.string().allow('').optional(),
		contentHtml: joi.string().allow('').optional(),
		contentType: joi.string().allow('').optional(),
		contentPublishedDate: joi.date().allow(null).optional(),
		note: joi.string().allow('').optional(),
		mainImageUrl: joi.string().allow('').optional(),
		iconUrl: joi.string().allow('').optional(),
		icon: joi.string().allow('').optional(),
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.number().required(),
		tags: joi.array().items(joi.string().optional()).optional(),
		screenshot: joi.string().allow('').optional()
	});

	const combinedSchema = joi.alternatives().try(oldValidationSchema, newValidationSchema);

	const { error } = combinedSchema.validate(requestBody);
	if (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}

	try {
		const tags = requestBody.tags || [];

		const metadata = await getMetadata(requestBody.url, requestBody.contentHtml);

		const { id: mainImageId } = await storage.storeImage(
			requestBody.mainImageUrl || metadata?.mainImageUrl,
			requestBody.title,
			ownerId
		);
		const { id: iconId } = await storage.storeImage(
			requestBody.iconUrl || metadata?.iconUrl,
			requestBody.title,
			ownerId
		);

		const bookmarkData = {
			ownerId,
			url: requestBody.url,
			categoryId: requestBody.category,
			title: requestBody.title || metadata?.title,
			description: requestBody.description || metadata?.description,
			author: requestBody.author || metadata?.author,
			contentText: requestBody.contentText || metadata?.contentText,
			contentHtml: metadata?.contentHtml || requestBody.contentHtml,
			contentType: requestBody.contentType || metadata?.contentType,
			contentPublishedDate: requestBody.contentPublishedDate || metadata?.contentPublishedDate,
			domain: new URL(requestBody.url).hostname,
			iconUrl: requestBody.iconUrl || metadata?.iconUrl,
			importance: requestBody.importance,
			mainImageUrl: requestBody.mainImageUrl || metadata?.mainImageUrl,
			note: requestBody.note,
			flagged: requestBody.flagged ? new Date() : null,
			mainImageId,
			iconId
		};

		const bookmark = await createBookmark(ownerId, bookmarkData);

		if (!bookmark.id) {
			return json({ success: false, error: 'Bookmark creation failed' }, { status: 400 });
		}

		if (tags.length) {
			await upsertTagsForBookmark(bookmark.id, ownerId, tags);
		}

		if (requestBody.screenshot) {
			const screenshot = urlDataToBlobConverter(requestBody.screenshot);
			const addedScreenshot = await storage.storeFile(screenshot, {
				ownerId,
				relatedEntityId: bookmark.id,
				source: FileSourceEnum.WebExtension
			});

			await setScreenshotToBookmark(bookmark.id, ownerId, addedScreenshot.id);
		}

		return json({ bookmark }, { status: 201 });
	} catch (error: any) {
		console.error('Error creating bookmark from API request', error?.message);
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = await request.json();

	const oldValidationSchema = joi.object<UpdateBookmarkRequestBody>({
		id: joi.number().required(),
		url: joi.string().uri().optional(),
		title: joi.string().optional(),
		description: joi.string().allow('').optional(),
		author: joi.string().allow('').optional(),
		content_text: joi.string().allow('').optional(),
		content_html: joi.string().allow('').optional(),
		content_type: joi.string().allow('').optional(),
		content_published_date: joi.date().optional(),
		note: joi.string().allow('').optional(),
		main_image_url: joi.string().allow('').optional(),
		icon_url: joi.string().allow('').optional(),
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.string().optional(),
		tags: joi.array().items(joi.string().required()).optional(),
		screenshot: joi.string().allow('').optional()
	});

	const newValidationSchema = joi.object({
		id: joi.number().required(),
		url: joi.string().uri().optional(),
		title: joi.string().optional(),
		description: joi.string().allow('').optional(),
		author: joi.string().allow('').optional(),
		contentText: joi.string().allow('').optional(),
		contentHtml: joi.string().allow('').optional(),
		contentType: joi.string().allow('').optional(),
		contentPublishedDate: joi.date().optional(),
		note: joi.string().allow('').optional(),
		mainImageUrl: joi.string().allow('').optional(),
		iconUrl: joi.string().allow('').optional(),
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.string().optional(),
		tags: joi.array().items(joi.string().required()).optional(),
		screenshot: joi.string().allow('').optional()
	});

	const combinedSchema = joi.alternatives().try(oldValidationSchema, newValidationSchema);

	const { error, value } = combinedSchema.validate(requestBody);

	if (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}

	const { id, ...updatedFields } = value;

	try {
		const currentBookmark = await getBookmarkById(id, ownerId);

		if (!currentBookmark) {
			return json({ success: false, error: 'Bookmark not found' }, { status: 404 });
		}

		const tagNames = value.tags?.map((tag: string) => tag);

		const { id: mainImageId } = await storage.storeImage(
			updatedFields.mainImageUrl,
			updatedFields.title || currentBookmark.title,
			ownerId
		);
		const { id: iconId } = await storage.storeImage(
			updatedFields.iconUrl,
			updatedFields.title || currentBookmark.title,
			ownerId
		);

		const bookmarkData = {
			...updatedFields,
			categoryId: updatedFields.category,
			flagged: updatedFields.flagged ? new Date() : null,
			mainImageId,
			iconId
		};

		const bookmark = await updateBookmark(id, ownerId, bookmarkData);

		if (tagNames.length) {
			await upsertTagsForBookmark(id, ownerId, tagNames);
		}

		if (requestBody.screenshot) {
			const screenshot = urlDataToBlobConverter(requestBody.screenshot);
			await storage.storeFile(screenshot, {
				ownerId,
				relatedEntityId: id,
				source: FileSourceEnum.WebExtension
			});
		}

		return json({ bookmark }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const id = parseInt(url.searchParams.get('id') || '', 10);

		if (!id) {
			return json({ success: false, error: 'Bookmark ID is required' }, { status: 400 });
		}

		const success = await deleteBookmark(id, ownerId);

		return json({ success }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 404 });
	}
};
