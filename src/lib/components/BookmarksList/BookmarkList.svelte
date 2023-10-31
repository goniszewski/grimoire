<script lang="ts">
	import BookmarkCard from '../BookmarkCard/BookmarkCard.svelte';
	import { currentUser } from '$lib/pb';
	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';

	export let bookmarks: Bookmark[] = [];
</script>

{#if $currentUser?.id}
	{#if $page.data.bookmarks.length > 0}
		<div class="w-full columns-sm gap-8">
			{#each bookmarks as bookmark}
				<BookmarkCard {bookmark} />
			{/each}
		</div>
	{:else}
		<p>No bookmarks yet.</p>
	{/if}
{:else}
	USER NOT LOGGED IN
{/if}
