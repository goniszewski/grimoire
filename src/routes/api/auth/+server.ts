import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ locals, request }) => {
	const body = await request.json();

	const schema = joi.object({
		login: joi.string().required(),
		password: joi.string().required()
	});

	const { value, error } = schema.validate(body);

	if (error) {
		return json(
			{
				success: false,
				error: error?.message
			},
			{
				status: 400
			}
		);
	}

	const { login, password } = value;

	try {
		const authResponse = await locals.pb.collection('users').authWithPassword(login, password);

		const { token } = authResponse;

		return json(
			{
				success: true,
				token
			},
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
				status: error?.status || 500
			}
		);
	}
};
