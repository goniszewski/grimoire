<script lang="ts">
	import { page } from '$app/stores';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
	import Pagination from '$lib/components/Pagination/Pagination.svelte';
	import { bookmarksStore } from '$lib/stores/bookmarks.store';
	import type { Tag } from '$lib/types/Tag.type';

	let slug: string;
	let tag: Tag | undefined;

	$: {
		slug = $page.params.slug;
		tag = $page.data.tags.find((c) => c.slug === slug);
		bookmarksStore.set($page.data.bookmarks.filter((b) => b.tags?.find((t) => t.id === tag?.id)));
	}
</script>

<div class="flex w-full flex-col gap-8">
	<h1 class="text-2xl">Tag: {tag?.name}</h1>

	<EditBookmarkModal />

	{#if $bookmarksStore.length > 0}
		<div class="flex flex-wrap gap-4">
			<BookmarkList bookmarks={$bookmarksStore} />
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
