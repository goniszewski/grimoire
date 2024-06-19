import { createUser, getUserByUsername } from '$lib/database/repositories/User.repository';
import { lucia } from '$lib/server/auth';
import Joi from 'joi';

import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';
export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const name = formData.get('name');
		const email = formData.get('email');
		const password = formData.get('password');
		const passwordConfirm = formData.get('passwordConfirm');
		// username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
		const validationSchema = Joi.object({
			username: Joi.string()
				.min(3)
				.max(31)
				.regex(/^[a-z0-9_-]+$/),
			email: Joi.string().email(),
			password: Joi.string().min(6).max(255),
			passwordConfirm: Joi.string().valid(Joi.ref('password'))
		});

		const { error } = validationSchema.validate({
			username,
			name,
			email,
			password,
			passwordConfirm
		});

		if (
			error ||
			typeof username !== 'string' ||
			typeof name !== 'string' ||
			typeof email !== 'string' ||
			typeof password !== 'string'
		) {
			return fail(400, {
				message: error!.message
			});
		}

		const passwordHash = await hash(password, {
			// recommended minimum parameters
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		const userExists = await getUserByUsername(username).then((user) => !!user);

		if (userExists) {
			return fail(400, {
				message: 'User with this username / email already exists'
			});
		}

		const user = await createUser({
			username,
			name,
			email,
			passwordHash
		});

		const session = await lucia.createSession(user.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		redirect(302, '/');
	}
};
