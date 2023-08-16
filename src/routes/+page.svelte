<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';

	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import { IconSortAscending, IconSortDescending } from '@tabler/icons-svelte';
	import Select from 'svelte-select';
	import { writable } from 'svelte/store';
	import { sortBookmarks, type sortByType } from '$lib/utils/sort-bookmarks';
	import { currentUser } from '$lib/pb';
	import ShowBookmarkModal from '$lib/components/ShowBookmarkModal/ShowBookmarkModal.svelte';

	let bookmarks: Bookmark[] = [];
	let sortBySelected = writable<{
		label: string;
		value: sortByType;
	}>({ label: 'added (desc)', value: 'added_desc' });
	let showOnlyFilters = writable({
		unread: false,
		flagged: false
	});

	function filterBookmarks(bookmarks: Bookmark[], filters: { unread: boolean; flagged: boolean }) {
		return bookmarks.filter((b) => {
			if (filters.unread && !!b.read) {
				return false;
			}
			if (filters.flagged && !b.flagged) {
				return false;
			}
			return true;
		});
	}

	$: {
		const sortedBookmarks = sortBookmarks($page.data.bookmarks, $sortBySelected.value);
		bookmarks = filterBookmarks(sortedBookmarks, $showOnlyFilters);
	}
</script>

{#if $currentUser}
	<div class="flex justify-center ml-auto w-full m-4">
		<div class="flex flex-1">
			<Select
				class="this-select select min-w-fit"
				placeholder="Sort by"
				searchable={false}
				clearable={false}
				bind:value={$sortBySelected}
				items={[
					{ label: 'added (asc)', value: 'added_asc' },
					{ label: 'added (desc)', value: 'added_desc' },
					{ label: 'title (asc)', value: 'title_asc' },
					{ label: 'title (desc)', value: 'title_desc' }
				]}
			>
				<div slot="prepend">
					{#if $sortBySelected.value.includes('_asc')}
						<IconSortAscending class="w-5 h-5" />
					{:else}
						<IconSortDescending class="w-5 h-5" />
					{/if}
				</div>
			</Select>

			<label class="label cursor-pointer gap-2">
				<span class="label-text">Only unread</span>
				<input type="checkbox" bind:checked={$showOnlyFilters.unread} class="checkbox" />
			</label>
			<label class="label cursor-pointer gap-2">
				<span class="label-text">Only flagged</span>
				<input type="checkbox" bind:checked={$showOnlyFilters.flagged} class="checkbox" />
			</label>
		</div>
		<AddBookmarkButton />
	</div>
	<AddBookmarkModal />
	<EditBookmarkModal />
	<ShowBookmarkModal />

	<BookmarkList {bookmarks} />
{/if}

<style>
	:global(.this-select) {
		border: 0 !important;
		border-color: rgba(209, 213, 219, 0.5) !important;
		max-width: 10rem;
	}
</style>
