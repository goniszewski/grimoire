<script lang="ts">
	import { page } from '$app/stores';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import type { Bookmark } from '$lib/types/Bookmark.type';
	import BookmarkCard from '../BookmarkCard/BookmarkCard.svelte';
	import BookmarkListItem from '../BookmarkListItem/BookmarkListItem.svelte';

	export let bookmarks: Bookmark[] = [];
</script>

{#if $page.data.user?.id}
	{#if $page.data.bookmarks.length > 0}
		{#if $userSettingsStore.bookmarksView === 'grid'}
			<div class="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{#each bookmarks as bookmark (bookmark.id)}
					<BookmarkCard {bookmark} />
				{/each}
			</div>
		{:else if $userSettingsStore.bookmarksView === 'list'}
			<div class="flex w-full flex-col gap-2">
				{#each bookmarks as bookmark (bookmark.id)}
					<BookmarkListItem {bookmark} />
				{/each}
			</div>
		{/if}
	{:else}
		<p>No bookmarks yet.</p>
	{/if}
{:else}
	USER NOT LOGGED IN
{/if}
