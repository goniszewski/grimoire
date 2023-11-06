import { redirect } from '@sveltejs/kit';

import type { Actions } from './$types';
export const actions: Actions = {
	default: async ({ locals, request, cookies }) => {
		const data = Object.fromEntries(await request.formData()) as {
			usernameOrEmail: string;
			password: string;
		};

		let authResponse;

		try {
			authResponse = await locals.pb.admins.authWithPassword(data.usernameOrEmail, data.password);

			// cookies.set('adminToken', authResponse.token, {
			// 	path: '/admin',
			// 	httpOnly: true,
			// 	sameSite: 'strict',
			// 	maxAge: 10 * 60 * 24,
			// });
		} catch (e) {
			console.error(e);
			throw e;
		}

		if (authResponse) {
			return {
				status: 200
			};
		} else {
			return {
				status: 401,
				body: {
					success: false,
					error: 'Unauthorized'
				}
			};
		}
	}
} satisfies Actions;
