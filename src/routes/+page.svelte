<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';

	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import { IconSortAscending, IconSortDescending } from '@tabler/icons-svelte';
	import Select from 'svelte-select';
	import { writable } from 'svelte/store';
	import { sortBookmarks, type sortByType } from '$lib/utils/sort-bookmarks';
	import { currentUser } from '$lib/pb';
	import { searchedValue } from '$lib/stores/search.store';
	import { searchFactory } from '$lib/utils/search';
	import Pagination from '$lib/components/Pagination/Pagination.svelte';

	const sortByOptions = [
		{ label: 'added (desc)', value: 'created_desc' },
		{ label: 'added (asc)', value: 'created_asc' },
		{ label: 'domain (desc)', value: 'domain_desc' },
		{ label: 'domain (asc)', value: 'domain_asc' },
		{ label: 'opened times (desc)', value: 'opened_times_desc' },
		{ label: 'opened times (asc)', value: 'opened_times_asc' }
	];

	export let bookmarks: Bookmark[] = [];
	let sortBySelected = writable<{
		label: string;
		value: sortByType;
	}>(
		sortByOptions[0] as {
			label: string;
			value: sortByType;
		}
	);
	let showOnlyFilters = writable({
		unread: false,
		flagged: false
	});

	const searchEngine = searchFactory($page.data.bookmarks);

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
		const searchedBookmarks = $searchedValue
			? searchEngine.search($searchedValue).map((b) => b.item)
			: $page.data.bookmarks;
		const sortedBookmarks = sortBookmarks(searchedBookmarks, $sortBySelected.value);

		bookmarks = filterBookmarks(sortedBookmarks, $showOnlyFilters);
	}
</script>

{#if $currentUser}
	<div class="flex justify-center ml-auto w-full m-4">
		<div class="flex flex-1 w-full pr-5 items-center">
			<Select
				class="this-select select min-w-fit"
				placeholder="Sort by"
				searchable={false}
				clearable={false}
				bind:value={$sortBySelected}
				items={sortByOptions}
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
			<span class="ml-auto text-sm text-gray-500"
				>{`Showing ${bookmarks.length} out of ${$page.data.bookmarks.length}`}</span
			>
		</div>
		<AddBookmarkButton />
	</div>

	<BookmarkList {bookmarks} />
	<Pagination
		page={$page.data.page}
		limit={$page.data.limit}
		items={$page.data.bookmarksCount}
		position="right"
	/>
{/if}

<style>
	:global(.this-select) {
		border: 0 !important;
		border-color: rgba(209, 213, 219, 0.5) !important;
		max-width: 10rem;
	}
</style>
