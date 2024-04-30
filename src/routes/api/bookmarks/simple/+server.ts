import { authenticateUserApiRequest, removePocketbaseFields } from '$lib/pb';
import { getMetadata } from '$lib/utils/get-metadata';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Bookmark } from '$lib/types/Bookmark.type.js';
import type { RequestHandler } from '@sveltejs/kit';
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
	}

	const bookmarkUrl = Buffer.from(url.searchParams.get('url') || '', 'base64').toString('utf-8');

	const validationSchema = joi.string().uri();

	const { error } = validationSchema.validate(bookmarkUrl);

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
		const metadata = await getMetadata(bookmarkUrl);
		const defaultCategory = await locals.pb
			.collection('categories')
			.getFirstListItem(`owner="${owner}" && initial=true`, {
				fields: 'id'
			});

		const record = await locals.pb.collection('bookmarks').create<Bookmark>({
			owner,
			category: defaultCategory?.id,
			content_html: metadata.content_html,
			content_published_date: metadata.content_published_date,
			content_text: metadata.content_text,
			content_type: metadata.content_type,
			description: metadata.description,
			domain: metadata.domain,
			icon_url: metadata.icon_url,
			importance: 0,
			main_image_url: metadata.main_image_url,
			note: 'From bookmarklet',
			title: metadata.title,
			url: bookmarkUrl,
			author: metadata.author
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

		if (metadata.main_image_url || metadata.icon_url) {
			const attachments = new FormData();

			if (metadata.main_image_url) {
				const main_image = await fetch(metadata.main_image_url as string).then((r) => r.blob());
				attachments.append('main_image', main_image);
			}

			if (metadata.icon_url) {
				const icon = await fetch(metadata.icon_url as string).then((r) => r.blob());
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
};
