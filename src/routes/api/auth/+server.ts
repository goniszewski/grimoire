import {
	getUserByEmail,
	getUserByUsername,
	getUserWithoutSerialization
} from '$lib/database/repositories/User.repository';
import { lucia } from '$lib/server/auth';
import joi from 'joi';

import { verify } from '@node-rs/argon2';
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
		const existingUser = await getUserWithoutSerialization(login);

		if (!existingUser) {
			const randomMs = Math.floor(Math.random() * 1000);

			await new Promise((resolve) => setTimeout(resolve, randomMs));
			return json(
				{
					success: false,
					error: 'Incorrect username or password'
				},
				{
					status: 400
				}
			);
		}
		const validPassword = await verify(existingUser.passwordHash, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return json(
				{
					success: false,
					error: 'Incorrect username or password'
				},
				{
					status: 400
				}
			);
		}

		const session = await lucia.createSession(existingUser.id, {});

		return json(
			{
				success: true,
				token: session.id
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
