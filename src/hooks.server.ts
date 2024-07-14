import { getUserById } from '$lib/database/repositories/User.repository';
import { themes } from '$lib/enums/themes';
import { lucia } from '$lib/server/auth';

import type { Theme } from '$lib/enums/themes';
import type { Handle } from '@sveltejs/kit';
import type { User } from '$lib/types/User.type';
export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(lucia.sessionCookieName);
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		const sessionCookie = lucia.createSessionCookie(session.id);

		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	if (!session) {
		const sessionCookie = lucia.createBlankSessionCookie();
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	let userData: User | null = null;
	if (user?.id) userData = await getUserById(user.id);

	if (!userData) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}
	const theme: Theme = userData.settings.theme || (event.cookies.get('theme') as Theme) || 'light';

	event.locals.user = userData;
	event.locals.session = session;

	const response = await resolve(event, {
		transformPageChunk({ html }) {
			return html.replace('data-theme=""', `data-theme="${themes[theme]}"`);
		}
	});

	return response;
};
