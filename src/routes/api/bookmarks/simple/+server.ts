import { createBookmark, updateBookmark } from '$lib/database/repositories/Bookmark.repository';
import { getInitialCategory } from '$lib/database/repositories/Category.repository';
import { Storage } from '$lib/storage/storage';
import { getMetadata } from '$lib/utils/get-metadata';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from '@sveltejs/kit';

const storage = new Storage();

export const POST: RequestHandler = async ({ locals, url }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
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
		const defaultCategory = await getInitialCategory(ownerId);

		if (!defaultCategory) {
			return json(
				{
					success: false,
					error: 'No default category found'
				},
				{
					status: 400
				}
			);
		}

		const bookmark = await createBookmark(ownerId, {
			categoryId: defaultCategory?.id,
			contentHtml: metadata.contentHtml,
			contentPublishedDate: metadata.contentPublishedDate?.toString(),
			contentText: metadata.contentText,
			contentType: metadata.contentType,
			description: metadata.description,
			domain: metadata.domain,
			iconUrl: metadata.iconUrl,
			importance: 0,
			mainImageUrl: metadata.mainImageUrl,
			note: 'From bookmarklet',
			title: metadata.title,
			url: bookmarkUrl,
			author: metadata.author
		});

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

		const { id: mainImageId } = await storage.storeImage(
			metadata.mainImageUrl,
			metadata.title,
			ownerId
		);
		const { id: iconId } = await storage.storeImage(metadata.iconUrl, metadata.title, ownerId);
		const updatedBookmark = await updateBookmark(bookmark.id, ownerId, {
			mainImageId,
			iconId
		});

		return json(
			{ bookmark: updatedBookmark },
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
