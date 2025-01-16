import { executeImport } from '$lib/utils/bookmark-import/execute-import';
import joi from 'joi';

import type { Actions } from './$types';
import type { BookmarkEdit } from '$lib/types/Bookmark.type';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const ownerId = locals.user?.id;

		if (!ownerId) {
			return {
				success: false,
				error: 'Unauthorized'
			};
		}

		const requestBody = await request.formData();
		const bookmarks:BookmarkEdit[] = JSON.parse(requestBody.get('bookmarks') as string);

		const validationSchema = joi
			.array()
			.items(
				joi.object({
					url: joi.string().uri().required(),
					domain: joi.string().allow('').optional(),
					title: joi.string().required(),
					description: joi.string().allow(null, '').optional(),
					category: joi.object({
						id: joi.number(),
						name: joi.string().required(),
					}).required(),
					mainImageUrl: joi.string().allow(null, '').optional(),
					iconUrl: joi.string().allow(null, '').optional(),
					author: joi.string().allow(null, '').optional(),
					contentText: joi.string().allow(null, '').optional(),
					contentHtml: joi.string().allow(null, '').optional(),
					contentType: joi.string().allow(null, '').optional(),
					contentPublishedDate: joi.date().allow(null).optional(),
					importance: joi.number().allow(null).required(),
					flagged: joi.boolean().allow(null).required(),
					note: joi.string().allow(null, '').optional(),
					bookmarkTags: joi
						.array()
						.items(
							joi.object({
								label: joi.string().required(),
								value: joi.string().required()
							})
						)
						.optional()
				})
			)
			.required();

		const { error } = validationSchema.validate(bookmarks);

		console.log('Validation error:', error);

		if (error) {
			return { success: false, error: error.message, status: 400 };
		}

		try {
			const result = await executeImport(bookmarks, ownerId);

			console.log('executeImport result:', JSON.stringify(result, null, 2));

			return { success: true, data: result, status: 201 };
		} catch (error: any) {
			console.error('Error importing bookmarks:', error?.message);

			return { success: false, error: error?.message, status: 500 };
		}
	}
};
