import { pb } from '$lib/pb.js';
import { getFileUrl, prepareTags } from '$lib/utils';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Bookmark } from '$lib/types/Bookmark.type.js';

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

	const requestBody = await request.json();

	const validationSchema = joi.object({
		url: joi.string().uri().required(),
		title: joi.string().required(),
		description: joi.string().allow('').optional(),
		author: joi.string().allow('').optional(),
		content_text: joi.string().allow('').optional(),
		content_html: joi.string().allow('').optional(),
		content_type: joi.string().allow('').optional(),
		content_published_date: joi.date().allow(null).optional(),
		note: joi.string().allow('').optional(),
		main_image: joi.string().allow('').optional(),
		icon: joi.string().allow('').optional(),
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.string().required(),
		tags: joi.array().items(joi.string()).optional()
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
		const tags = requestBody.tags || [];
		const tagIds = await prepareTags(pb, tags, owner);

		const bookmark = (await pb.collection('bookmarks').create({
			owner,
			content_html: requestBody.content_html,
			content_published_date: requestBody.content_published_date,
			content_text: requestBody.content_text,
			content_type: requestBody.content_type,
			description: requestBody.description,
			domain: requestBody.domain,
			icon_url: requestBody.icon_url,
			importance: requestBody.importance,
			main_image_url: requestBody.main_image_url,
			note: requestBody.note,
			title: requestBody.title,
			url: requestBody.url,
			author: requestBody.author,
			tags: tagIds,
			flagged: requestBody.flagged ? new Date().toISOString() : null
		})) as Bookmark;

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

			await pb.collection('bookmarks').update(bookmark.id, attachments);
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

export async function PATCH({ locals, request }) {
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

	const requestBody = await request.json();

	const { id, ...updatedFields } = requestBody;

	const validationSchema = joi.object({
		url: joi.string().uri().optional(),
		title: joi.string().optional(),
		description: joi.string().allow('').optional(),
		author: joi.string().allow('').optional(),
		content_text: joi.string().allow('').optional(),
		content_html: joi.string().allow('').optional(),
		content_type: joi.string().allow('').optional(),
		content_published_date: joi.date().optional(),
		note: joi.string().allow('').optional(),
		main_image: joi.string().allow('').optional(),
		icon: joi.string().allow('').optional(),
		importance: joi.number().min(0).max(3).optional(),
		flagged: joi.boolean().optional(),
		category: joi.string().optional(),
		tags: joi.array().items(joi.string()).optional()
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
		const currentBookmark = await pb.collection('bookmarks').getOne(id);

		if (!currentBookmark) {
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

		const tags = requestBody.tags || [];

		const tagIds = await prepareTags(pb, tags, owner);

		const bookmark = (await pb.collection('bookmarks').update(id, {
			...updatedFields,
			tags: tagIds,
			flagged: requestBody.flagged ? new Date().toISOString() : null
		})) as Bookmark;

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

			await pb.collection('bookmarks').update(bookmark.id, attachments);
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

export async function DELETE({ locals, request }) {
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

	const { id } = await request.json();

	try {
		const result = await pb.collection('bookmarks').delete(id);

		return json(
			{ result },
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
