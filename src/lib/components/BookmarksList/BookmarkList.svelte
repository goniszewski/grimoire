<script lang="ts">
	import BookmarkCard from '../BookmarkCard/BookmarkCard.svelte';
	import { currentUser, pb } from '$lib/pb';
	import { page } from '$app/stores';
</script>

{#if $currentUser?.id}
	{#if $page.data.bookmarks.length > 0}
		<div class="flex flex-wrap gap-4">
			{#each $page.data.bookmarks as bookmark}
				<BookmarkCard {bookmark} />
			{/each}
		</div>
	{:else}
		<p>No bookmarks yet.</p>
	{/if}
{:else}
	NO USER
{/if}
