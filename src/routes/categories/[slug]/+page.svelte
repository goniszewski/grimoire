<script lang="ts">
	import { page } from '$app/stores';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import type { Category } from '$lib/interfaces/Category.interface';

	let slug: string;
	let category: Category | undefined;
	let bookmarks: Bookmark[] = [];

	$: {
		slug = $page.params.slug;
		category = $page.data.categories.find((c) => c.slug === slug);
		bookmarks = $page.data.bookmarks.filter((b) => b.category.id === category?.id);
	}
</script>

<div class="flex flex-col gap-8 w-full">
	<h1 class="text-2xl">Category: {category?.name}</h1>

	<EditBookmarkModal />

	{#if bookmarks.length > 0}
		<div class="flex flex-wrap gap-4">
			<BookmarkList {bookmarks} />
		</div>
	{:else}
		<p>No bookmarks yet.</p>
	{/if}
</div>
