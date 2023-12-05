// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			pb: import('pocketbase').default;
			user: import('pocketbase').default['authStore']['model'];
		}
		interface PageData {
			categories: import('$lib/types/Category.type').Category[];
			bookmarks: import('$lib/types/Bookmark.type').Bookmark[];
			tags: import('$lib/types/dto/Tag.dto').TagWithBookmarks[];
			bookmarksForIndex: import('$lib/types/Bookmark.type').Bookmark[];
			bookmarksCount: number;
			page: number;
			limit: number;
		}
	}
}

export {};
