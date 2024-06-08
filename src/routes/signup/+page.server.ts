import { db } from '$lib/database/db';
import { userSchema } from '$lib/database/schema';
import { lucia } from '$lib/server/auth';
import { count, eq, or } from 'drizzle-orm';
import Joi from 'joi';

import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';
export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
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
			email,
			password,
			passwordConfirm
		});

		if (
			error ||
			typeof username !== 'string' ||
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

		const userExists = await db
			.select({ count: count() })
			.from(userSchema)
			.where(or(eq(userSchema.name, username), eq(userSchema.email, email)))
			.then((user) => user[0].count !== 0);

		if (userExists) {
			return fail(400, {
				message: 'User with this username / email already exists'
			});
		}

		const [user] = await db
			.insert(userSchema)
			.values({
				name: username,
				email,
				passwordHash
			})
			.returning();

		const session = await lucia.createSession(user.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		redirect(302, '/');
	}
};
