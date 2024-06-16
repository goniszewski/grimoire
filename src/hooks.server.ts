import config from '$lib/config';
import { db } from '$lib/database/db';
import { userSchema } from '$lib/database/schema';
import { themes } from '$lib/enums/themes';
import { lucia } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

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
	if (user?.id) [userData] = await db.select().from(userSchema).where(eq(userSchema.id, user.id));

	if (!userData) throw new Error('User not found');
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
