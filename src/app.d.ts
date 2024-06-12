// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: import('lucia').User | null;
			session: import('lucia').Session | null;
		}
		interface PageData {
			categories: import('$lib/types/Category.type').Category[];
			bookmarks: import('$lib/types/Bookmark.type').Bookmark[];
			tags: import('$lib/types/dto/Tag.dto').TagWithBookmarks[];
			bookmarksForIndex: import('$lib/types/Bookmark.type').Bookmark[];
			bookmarksCount: number;
			noUsersFound: boolean;
			page: number;
			limit: number;
		}
	}
}
declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		UserId: number;
	}
}

export {};
