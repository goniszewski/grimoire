import { executeImport } from '$lib/utils/bookmark-import/execute-import';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Actions } from './$types';

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
		const bookmarks = JSON.parse(requestBody.get('bookmarks') as string);

		console.log('bookmarks', bookmarks);

		const validationSchema = joi.object({
			bookmarks: joi
				.array()
				.items(
					joi.object({
						url: joi.string().uri().required(),
						title: joi.string().required(),
						description: joi.string().allow('').optional(),
						category: joi.string().required(),
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
				.required()
		});

		const { error } = validationSchema.validate(bookmarks);

		if (error) {
			return { success: false, error: error.message , status: 400 };
		}

		try {
			const result = await executeImport(bookmarks, ownerId);

			return { success: true, data: result, status: 201 };
		} catch (error: any) {
			console.error('Error importing bookmarks:', error?.message);

			return { success: false, error: error?.message ,  status: 500 };
		}
	}
};
