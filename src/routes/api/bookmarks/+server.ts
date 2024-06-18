import { db } from '$lib/database/db';
import { bookmarkSchema } from '$lib/database/schema';
import { getFileUrl } from '$lib/utils/get-file-url';
import { getMetadataFromHtml } from '$lib/utils/get-metadata';
import { prepareTags } from '$lib/utils/handle-tags-input';
import { initializeSearch, searchIndexKeys } from '$lib/utils/search';
import { serializeBookmarkList } from '$lib/utils/serialize-bookmark-list';
import { urlDataToBlobConverter } from '$lib/utils/url-data-to-blob-converter';
import { sql } from 'drizzle-orm';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Bookmark } from '$lib/types/Bookmark.type.js';
import type {
	AddBookmarkRequestBody,
	UpdateBookmarkRequestBody
} from '$lib/types/api/Bookmarks.type';
import type Client from 'pocketbase';
const prepareRequestedTags = (
	requestBody: AddBookmarkRequestBody | UpdateBookmarkRequestBody,
	userTags: { id: string; name: string }[]
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
						value: existingTag.id
					});
				}

				return acc;
			},
			[] as { label: string; value: string }[]
		) || []
	);
};

const getBookmarksByIds = async (ids: string[], owner: number) => {
	const filterExpression =
		ids.length > 0
			? sql`id IN (${sql.join(ids, sql`, `)}) AND owner=${owner}`
			: sql`owner=${owner}`;

	const recordsRaw = await db.query.bookmarkSchema.findMany({
		where: sql`${filterExpression}`,
		with: {
			category: true,
			owner: true,
			bookmarksToTags: {
				with: {
					tag: true
				}
			}
		}
	});

	const records = recordsRaw.map((record) => {
		const { bookmarksToTags, ...rest } = record;

		return {
			...rest,
			tags: bookmarksToTags.map((bookmarkToTag) => bookmarkToTag.tag)
		};
	});

	return serializeBookmarkList(records);
};

const getBookmarkByUrl = async (url: string, owner: string, pb: Client) => {
	const cleanUrl = new URL(url);
	cleanUrl.hash = '';
	cleanUrl.search = '';

	const filterExpression = `url LIKE '${cleanUrl.toString()}%' AND owner = '${owner}'`;

	const recordsRaw = await db.query.bookmarkSchema.findMany({
		where: sql`${filterExpression}`,
		with: {
			category: true,
			owner: true,
			bookmarksToTags: {
				with: {
					tag: true
				}
			}
		}
	});

	const records = recordsRaw.map((record) => {
		const { bookmarksToTags, ...rest } = record;

		return {
			...rest,
			tags: bookmarksToTags.map((bookmarkToTag) => bookmarkToTag.tag)
		};
	});

	return serializeBookmarkList(records);
};

const getBookmarksByFilter = async (filter: string, owner: number) => {
	const records = await db.query.bookmarkSchema.findMany({
		where: (bookmarks, { eq }) => eq(bookmarks.ownerId, owner),
		columns: searchIndexKeys.reduce(
			(acc, key) => ({
				...acc,
				[key]: true
			}),
			{ id: true }
		),
		with: {
			bookmarksToTags: {
				with: {
					tag: true
				}
			}
		}
	});

	const serializedRecords = records.map(({ bookmarksToTags, ...record }) => ({
		...record,
		tags: bookmarksToTags.map(({ tag }) => tag.name)
	}));

	const searchEngine = initializeSearch(records);
	const res = searchEngine.search(filter).map((b) => b.item);
	return res;
};

export async function GET({ locals, url, request }) {
	let owner = locals.pb.authStore.model?.id;
	let bookmarks: Bookmark[] = [];

	if (!owner) {
		const { owner: apiOwner, error } = await authenticateUserApiRequest(locals.pb, request);

		owner = apiOwner;

		if (error) {
			return error;
		}
	}

	const idsParam = url.searchParams.get('ids')?.split(',') || [];
	const urlParam = url.searchParams.get('url');
	const filterParam = url.searchParams.get('filter');

	try {
		if (urlParam) {
			const bookmark = await getBookmarkByUrl(urlParam, owner, locals.pb);

			bookmarks = bookmark ? [bookmark] : [];
		} else if (filterParam) {
			bookmarks = await getBookmarksByFilter(filterParam, owner, locals.pb);
		} else {
			bookmarks = await getBookmarksByIds(idsParam, owner, locals.pb);
		}

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

export async function POST({ locals, request }) {
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
	}

	const requestBody: AddBookmarkRequestBody = await request.json();

	const validationSchema = joi.object<AddBookmarkRequestBody>({
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
		category: joi.string().required(),
		tags: joi.array().items(joi.string().optional()).optional(),
		screenshot: joi.string().allow('').optional()
	});

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json(
			{
				success: false,
				error: error.message
			},
			{
				status: 400
			}
		);
	}

	try {
		const userTags = await locals.pb.collection('tags').getFullList<{ id: string; name: string }>({
			fields: 'id,name',
			filter: `owner="${owner}"`
		});

		const tags = prepareRequestedTags(requestBody, userTags);
		const tagIds = await prepareTags(locals.pb, tags, owner);

		const metadata = await getMetadataFromHtml(requestBody?.content_html || '', requestBody.url);

		const record = await locals.pb.collection('bookmarks').create<Bookmark>({
			owner,
			category: requestBody.category,
			content_html: metadata?.content_html || requestBody.content_html,
			content_published_date:
				requestBody.content_published_date || metadata?.content_published_date,
			content_text: requestBody.content_text || metadata?.content_text,
			content_type: requestBody.content_type || metadata?.content_type,
			description: requestBody.description || metadata?.description,
			domain: new URL(requestBody.url).hostname,
			icon_url: requestBody.icon_url || metadata?.icon_url,
			importance: requestBody.importance,
			main_image_url: requestBody.main_image_url || metadata?.main_image_url,
			note: requestBody.note,
			title: requestBody.title || metadata?.title,
			url: requestBody.url,
			author: requestBody.author || metadata?.author,
			tags: tagIds,
			flagged: requestBody.flagged ? new Date().toISOString() : null
		});

		const bookmark = removePocketbaseFields(record);

		if (!bookmark.id) {
			return json(
				{
					success: false,
					error: 'Bookmark creation failed'
				},
				{
					status: 400
				}
			);
		}

		if (record.main_image_url || record.icon_url || requestBody.screenshot) {
			const attachments = new FormData();

			if (record.main_image_url) {
				const main_image = await fetch(record.main_image_url as string).then((r) => r.blob());
				attachments.append('main_image', main_image);
			}

			if (record.icon_url) {
				const icon = await fetch(record.icon_url as string).then((r) => r.blob());
				attachments.append('icon', icon);
			}

			if (requestBody.screenshot) {
				const screenshot = urlDataToBlobConverter(requestBody.screenshot);

				attachments.append('screenshot', screenshot);
			}

			if (requestBody.icon) {
				const icon = urlDataToBlobConverter(requestBody.icon);

				attachments.append('icon', icon);
			}

			await locals.pb.collection('bookmarks').update(bookmark.id, attachments);
		}

		return json(
			{ bookmark },
			{
				status: 201
			}
		);
	} catch (error: any) {
		console.error('Error creating bookmark from API request', error?.message);

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

export async function PATCH({ locals, request }) {
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
	}

	const requestBody: UpdateBookmarkRequestBody = await request.json();

	const validationSchema = joi.object<UpdateBookmarkRequestBody>({
		id: joi.string().required(),
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

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json(
			{
				success: false,
				error: error.message
			},
			{
				status: 400
			}
		);
	}

	const { id, ...updatedFields } = requestBody;

	try {
		const currentBookmark = await locals.pb
			.collection('bookmarks')
			.getOne<Bookmark & { owner: string }>(id);

		if (!currentBookmark || currentBookmark.owner !== owner) {
			return json(
				{
					success: false,
					error: 'Bookmark not found'
				},
				{
					status: 404
				}
			);
		}

		const userTags = await locals.pb.collection('tags').getFullList<{ id: string; name: string }>({
			fields: 'id,name',
			filter: `owner="${owner}"`
		});

		const preparedTags = prepareRequestedTags(requestBody, userTags);
		const newTags = await prepareTags(locals.pb, preparedTags, owner);

		const tags = [...userTags.map((tag) => tag.id), ...newTags];

		const record = await locals.pb.collection('bookmarks').update<Bookmark>(
			id,
			{
				...updatedFields,
				tags,
				flagged: requestBody.flagged ? new Date().toISOString() : null
			},
			{
				filter: `owner="${owner}"`
			}
		);

		const bookmark = removePocketbaseFields(record);

		if (!bookmark.id) {
			return json(
				{
					success: false,
					error: 'Bookmark update failed'
				},
				{
					status: 400
				}
			);
		}

		if (requestBody.main_image_url || requestBody.icon_url) {
			const attachments = new FormData();

			if (requestBody.main_image_url) {
				const main_image = await fetch(requestBody.main_image_url as string).then((r) => r.blob());
				attachments.append('main_image', main_image);
			}

			if (requestBody.icon_url) {
				const icon = await fetch(requestBody.icon_url as string).then((r) => r.blob());
				attachments.append('icon', icon);
			}

			if (requestBody.screenshot) {
				const screenshot = urlDataToBlobConverter(requestBody.screenshot);

				attachments.append('screenshot', screenshot);
			}

			await locals.pb.collection('bookmarks').update(bookmark.id, attachments);
		}

		return json(
			{ bookmark },
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

export async function DELETE({ locals, request, url }) {
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
	}

	try {
		const id = url.searchParams.get('id') || '';

		if (!id) {
			return json(
				{
					success: false,
					error: 'Bookmark ID is required'
				},
				{
					status: 400
				}
			);
		}

		const currentBookmark = await locals.pb
			.collection('bookmarks')
			.getOne<Bookmark & { owner: string }>(id);

		if (!currentBookmark || currentBookmark.owner !== owner) {
			return json(
				{
					success: false,
					error: 'Bookmark not found'
				},
				{
					status: 404
				}
			);
		}

		const success = await locals.pb.collection('bookmarks').delete(id, {
			query: {
				owner
			}
		});

		return json(
			{ success },
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
				status: 404
			}
		);
	}
}
