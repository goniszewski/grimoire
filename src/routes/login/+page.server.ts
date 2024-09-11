import { getUserWithoutSerialization } from '$lib/database/repositories/User.repository';
import { lucia } from '$lib/server/auth';

import { verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

const INVALID_USERNAME_OR_PASSWORD = 'Invalid username or password';
export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (
			typeof username !== 'string' ||
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				username,
				message: 'Wrong username format'
			});
		}
		if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
			return fail(400, {
				message: 'Wrong password format'
			});
		}

		const existingUser = await getUserWithoutSerialization(username);

		if (!existingUser) {
			const randomMs = Math.floor(Math.random() * 1000);

			return new Promise((resolve) => {
				setTimeout(() => {
					resolve(
						fail(401, {
							username,
							message: INVALID_USERNAME_OR_PASSWORD
						})
					);
				}, randomMs);
			});
		}

		const validPassword = await verify(existingUser.passwordHash, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return fail(401, {
				username,
				message: INVALID_USERNAME_OR_PASSWORD
			});
		}

		const session = await lucia.createSession(existingUser.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		redirect(302, '/');
	}
};
