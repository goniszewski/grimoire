import { dev } from '$app/environment';
import { db } from '$lib/database/db';
import { sessionSchema, userSchema } from '$lib/database/schema';
import { Lucia } from 'lucia';

import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle';

import type { User } from 'lucia';

import type { RequestEvent } from '@sveltejs/kit';

export const adapter = new DrizzleSQLiteAdapter(db, sessionSchema, userSchema);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev
		}
	},
	getUserAttributes: (attributes) => {
		return {
			// attributes has the type of DatabaseUserAttributes
			username: attributes.username
		};
	}
});

export const validateRequest = async (request: RequestEvent) => {
	const authorizationHeader = request.request.headers.get('authorization');
	const sessionId =
		request.cookies.get(lucia.sessionCookieName) ||
		lucia.readBearerToken(authorizationHeader ?? '');

	if (!sessionId)
		return {
			user: null,
			session: null
		};

	const { user, session } = await lucia.validateSession(sessionId);

	return {
		user,
		session
	};
};

declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: DatabaseUserAttributes;
	}
}

interface DatabaseUserAttributes {
	username: string;
}
