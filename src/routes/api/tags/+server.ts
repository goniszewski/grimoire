import { authenticateUserApiRequest, pb } from '$lib/pb';
import { createSlug } from '$lib/utils';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Tag } from '$lib/types/Tag.type';

export async function GET({ locals, request }) {
	const { owner, error } = await authenticateUserApiRequest(locals.pb, request);

	if (error) {
		return error;
	}

	try {
		const tags = await pb.collection('tags').getFullList({
			filter: `owner="${owner}"`
		});

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
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
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
		const tag = (await pb.collection('tags').create({
			name: requestBody.name,
			slug: createSlug(requestBody.name),
			owner
		})) as Tag;

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
