import { getUserById } from '$lib/database/repositories/User.repository';
import { themes } from '$lib/enums/themes';
import { lucia, validateRequest } from '$lib/server/auth';

import type { Theme } from '$lib/enums/themes';
import type { User } from '$lib/types/User.type';
import type { Session, User as LuciaUser } from 'lucia';
import type { Cookies, Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const { session, user } = await validateRequest(event);
	const { userData, theme } = await getUserDataAndTheme(session, user, event.cookies);

	try {
		setEventLocals(event, userData, session);
		setSessionCookie(event, session);
	} catch (error) {
		console.error('Error setting event locals or session cookie:', error);
	}

	return await resolveWithTheme(event, resolve, theme);
};

async function getUserDataAndTheme(
	session: Session | null,
	user: LuciaUser | null,
	cookies: Cookies
): Promise<{ userData: User | null; theme: Theme }> {
	let userData: User | null = null;
	let theme: Theme;

	if (session && user?.id) {
		userData = await getUserById(user.id);
		theme = userData?.settings.theme || 'light';
	} else {
		theme = (cookies.get('theme') as Theme) || 'light';
	}

	return { userData, theme };
}

function setEventLocals(
	event: { locals: Record<string, any> },
	userData: User | null,
	session: Session | null
): void {
	event.locals.user = userData;
	event.locals.session = session;
}

function setSessionCookie(event: { cookies: Cookies }, session: Session | null): void {
	const cookieOptions = {
		path: '.',
		...(session ? lucia.createSessionCookie(session.id) : lucia.createBlankSessionCookie())
			.attributes
	};

	event.cookies.set(lucia.sessionCookieName, session ? session.id : '', cookieOptions);
}

async function resolveWithTheme(
	event: Parameters<Handle>[0]['event'],
	resolve: Parameters<Handle>[0]['resolve'],
	theme: Theme
): Promise<Response> {
	return await resolve(event, {
		transformPageChunk({ html }) {
			return html.replace('data-theme=""', `data-theme="${themes[theme]}"`);
		}
	});
}
