import { executeImport } from '$lib/utils/bookmark-import/execute-import';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = await request.json();

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

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}

	try {
		const result = await executeImport(requestBody.bookmarks, ownerId);

		return json(result, { status: 201 });
	} catch (error: any) {
		console.error('Error importing bookmarks:', error?.message);

		return json({ success: false, error: error?.message }, { status: 500 });
	}
};
