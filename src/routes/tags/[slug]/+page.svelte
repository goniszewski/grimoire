<script lang="ts">
	import { page } from '$app/stores';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
	import Pagination from '$lib/components/Pagination/Pagination.svelte';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import type { Category } from '$lib/interfaces/Category.interface';
	import type { Tag } from '$lib/interfaces/Tag.interface';

	let slug: string;
	let tag: Tag | undefined;
	let bookmarks: Bookmark[] = [];

	$: {
		slug = $page.params.slug;
		tag = $page.data.tags.find((c) => c.slug === slug);
		bookmarks = $page.data.bookmarks.filter((b) => b.tags.find((t) => t.id === tag?.id));
	}
</script>

<div class="flex flex-col gap-8 w-full">
	<h1 class="text-2xl">Tag: {tag?.name}</h1>

	<EditBookmarkModal />

	{#if bookmarks.length > 0}
		<div class="flex flex-wrap gap-4">
			<BookmarkList {bookmarks} />
			<Pagination
				page={$page.data.page}
				limit={$page.data.limit}
				items={$page.data.bookmarks.length}
				position="right"
			/>
		</div>
	{:else}
		<p>No bookmarks yet.</p>
	{/if}
</div>
