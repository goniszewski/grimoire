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
			categories: import('$lib/interfaces/Category.interface').Category[];
			bookmarks: import('$lib/interfaces/Bookmark.interface').Bookmark[];
		}
		interface LayoutData {}
		// interface Platform {}
	}
}

export {};
