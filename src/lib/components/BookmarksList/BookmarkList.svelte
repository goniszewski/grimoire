<script lang="ts">
	import BookmarkCard from '../BookmarkCard/BookmarkCard.svelte';
	import { user } from '$lib/pb';
	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/types/Bookmark.type';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import BookmarkListItem from '../BookmarkListItem/BookmarkListItem.svelte';

	export let bookmarks: Bookmark[] = [];
</script>

{#if $user.isValid}
	{#if $page.data.bookmarks.length > 0}
		{#if $userSettingsStore.bookmarksView === 'grid'}
			<div class="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
				{#each bookmarks as bookmark (bookmark.id)}
					<BookmarkCard {bookmark} />
				{/each}
			</div>
		{:else if $userSettingsStore.bookmarksView === 'list'}
			<div class="flex flex-col w-full gap-2">
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
