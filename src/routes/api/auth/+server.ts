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
				status: 401
			}
		);
	}

	const { login, password } = value;

	try {
		const authReponse = await locals.pb.collection('users').authWithPassword(login, password);

		const { token } = authReponse;

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
				status: 400
			}
		);
	}
};
