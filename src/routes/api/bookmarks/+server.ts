import { authenticateUserApiRequest, removePocketbaseFields } from '$lib/pb';
import { getFileUrl, prepareTags } from '$lib/utils';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Bookmark } from '$lib/types/Bookmark.type.js';
import type { BookmarkDto } from '$lib/types/dto/Bookmark.dto.js';
import type {
	AddBookmarkRequestBody,
	UpdateBookmarkRequestBody
} from '$lib/types/api/Bookmarks.type';

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
				const existingTag = userTags.find((userTag) => userTag.name === tag.name);

				if (!existingTag) {
					acc.push({
						label: tag.name,
						value: tag.name
					});
				}

				return acc;
			},
			[] as { label: string; value: string }[]
		) || []
	);
};

export async function GET({ locals, url, request }) {
	let owner = locals.pb.authStore.model?.id;

	if (!owner) {
		const { owner: apiOwner, error } = await authenticateUserApiRequest(locals.pb, request);

		owner = apiOwner;

		if (error) {
			return error;
		}
	}

	const ids = url.searchParams.get('ids')?.split(',') || [];

	const filterExpression = ids[0]
		? `(${ids.map((id) => `id="${id}"`).join('||')} && owner="${owner}")`
		: `owner="${owner}"`;

	try {
		const records = await locals.pb
			.collection('bookmarks')
			.getFullList<BookmarkDto>({
				filter: filterExpression,
				expand: 'category,tags'
			})
			.then((res) => {
				return res.map(({ expand, ...bookmark }) => ({
					...bookmark,
					icon: getFileUrl('bookmarks', bookmark.id, bookmark.icon),
					main_image: getFileUrl('bookmarks', bookmark.id, bookmark.main_image),
					...(expand || {})
				}));
			});

		const bookmarks = removePocketbaseFields(records);

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
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.string().required(),
		tags: joi
			.array()
			.items(
				joi.object({
					name: joi.string().required()
				})
			)
			.optional()
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

		const record = await locals.pb.collection('bookmarks').create<Bookmark>({
			owner,
			category: requestBody.category,
			content_html: requestBody.content_html,
			content_published_date: requestBody.content_published_date,
			content_text: requestBody.content_text,
			content_type: requestBody.content_type,
			description: requestBody.description,
			domain: new URL(requestBody.url).hostname,
			icon_url: requestBody.icon_url,
			importance: requestBody.importance,
			main_image_url: requestBody.main_image_url,
			note: requestBody.note,
			title: requestBody.title,
			url: requestBody.url,
			author: requestBody.author,
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

			await locals.pb.collection('bookmarks').update(bookmark.id, attachments);
		}

		return json(
			{ bookmark },
			{
				status: 201
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
		tags: joi
			.array()
			.items(
				joi.object({
					name: joi.string().required()
				})
			)
			.optional()
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

		console.log({
			userTags,
			preparedTags,
			newTags
		});

		const tags = [...userTags.map((tag) => tag.id), ...newTags];

		console.log({ tags });

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
