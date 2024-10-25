import { getUserWithoutSerialization } from '$lib/database/repositories/User.repository';
import { lucia } from '$lib/server/auth';

import { verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

const USER_NOT_FOUND = 'User not found';
const INVALID_USERNAME_OR_PASSWORD = 'Invalid username or password';
export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const login = formData.get('login') as string;
		const password = formData.get('password') as string;

		const existingUser = await getUserWithoutSerialization(login);

		if (!existingUser) {
			return fail(401, {
				login: login,
				invalid: true,
				message: USER_NOT_FOUND
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
				login: login,
				invalid: true,
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
