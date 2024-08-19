import config from '$lib/config';
import { createCategory } from '$lib/database/repositories/Category.repository';
import {
    createUser, getUserByUsername, getUserCount
} from '$lib/database/repositories/User.repository';
import { lucia } from '$lib/server/auth';
import { createSlug } from '$lib/utils/create-slug';
import Joi from 'joi';

import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions, PageServerLoad } from './$types';
export const load = (async () => {
	const signupDisabled = config.SIGNUP_DISABLED;

	return {
		signupDisabled
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async (event) => {
		if (config.SIGNUP_DISABLED) {
			throw redirect(303, '/');
		}

		const formData = await event.request.formData();
		const username = formData.get('username');
		const name = formData.get('name');
		const email = formData.get('email');
		const password = formData.get('password');
		const passwordConfirm = formData.get('passwordConfirm');
		// username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
		const validationSchema = Joi.object<{
			name: string;
			username: string;
			email: string;
			password: string;
			passwordConfirm: string;
		}>({
			name: Joi.string().min(3).max(31).optional(),
			username: Joi.string().min(3).max(31),
			email: Joi.string().email().optional(),
			password: Joi.string().min(6).max(255),
			passwordConfirm: Joi.string().valid(Joi.ref('password'))
		});

		const { error, value } = validationSchema.validate({
			username,
			name,
			email,
			password,
			passwordConfirm
		});

		if (error) {
			return fail(400, {
				message: error!.message
			});
		}

		const passwordHash = await hash(value.password, {
			// recommended minimum parameters
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		const userExists = await getUserByUsername(value.username).then((user) => !!user);
		const isFirstUser = await getUserCount().then((count) => count === 0);

		if (userExists) {
			return fail(400, {
				message: 'User with this username / email already exists'
			});
		}

		const user = await createUser({
			username: value.username,
			name: value.name,
			email: value.email,
			passwordHash,
			isAdmin: isFirstUser
		});

		await createCategory(user.id, {
			name: 'Uncategorized',
			slug: createSlug('uncategorized'),
			color: '#ccc',
			initial: true
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
