<script lang="ts">
	import BookmarkCard from '../BookmarkCard/BookmarkCard.svelte';
	import { user } from '$lib/pb';
	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import BookmarkListItem from '../BookmarkListItem/BookmarkListItem.svelte';

	export let bookmarks: Bookmark[] = [];
</script>

{#if user.isValid}
	{#if $page.data.bookmarks.length > 0}
		{#if $userSettingsStore.bookmarksView === 'grid'}
			<div class="w-full columns-[22rem] gap-6">
				{#each bookmarks as bookmark}
					<BookmarkCard {bookmark} />
				{/each}
			</div>
		{:else if $userSettingsStore.bookmarksView === 'list'}
			<div class="flex flex-col w-full gap-2">
				{#each bookmarks as bookmark}
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
