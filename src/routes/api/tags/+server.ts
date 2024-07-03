import {
	createTag,
	getTagByName,
	getTagsByUserId
} from '$lib/database/repositories/Tag.repository';
import joi from 'joi';

import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const tags = await getTagsByUserId(ownerId);

		return json(
			{ tags },
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
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = await request.json();

	const validationSchema = joi.object({
		name: joi.string().required()
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
		const existingTag = await getTagByName(requestBody.name, ownerId);

		if (existingTag?.id) {
			return json(
				{
					success: false,
					error: 'Tag with this name already exists'
				},
				{
					status: 403
				}
			);
		}

		const tag = await createTag(requestBody, ownerId);

		if (!tag.id) {
			return json(
				{
					success: false,
					error: 'Tag creation failed'
				},
				{
					status: 500
				}
			);
		}

		return json(
			{ tag },
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
