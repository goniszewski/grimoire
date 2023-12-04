<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';

	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/types/Bookmark.type';
	import {
		IconLayout2,
		IconListDetails,
		IconSortAscending,
		IconSortDescending
	} from '@tabler/icons-svelte';
	import Select from 'svelte-select';
	import { sortBookmarks } from '$lib/utils/sort-bookmarks';
	import { user } from '$lib/pb';
	import { searchedValue } from '$lib/stores/search.store';
	import { searchFactory } from '$lib/utils/search';
	import Pagination from '$lib/components/Pagination/Pagination.svelte';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import { applyAction, enhance } from '$app/forms';
	import type { UserSettings } from '$lib/types/UserSettings.type';
	import { writable } from 'svelte/store';

	const sortByOptions = [
		{ label: 'added (desc)', value: 'created_desc' },
		{ label: 'added (asc)', value: 'created_asc' },
		{ label: 'domain (desc)', value: 'domain_desc' },
		{ label: 'domain (asc)', value: 'domain_asc' },
		{ label: 'opened times (desc)', value: 'opened_times_desc' },
		{ label: 'opened times (asc)', value: 'opened_times_asc' }
	];

	export let bookmarks: Bookmark[] = [];

	const searchEngine = searchFactory($page.data.bookmarks);

	function filterBookmarks(bookmarks: Bookmark[], settings: UserSettings) {
		return bookmarks.filter((b) => {
			if (settings.bookmarksOnlyShowRead && !!b.read) {
				return false;
			}
			if (settings.bookmarksOnlyShowFlagged && !b.flagged) {
				return false;
			}
			return true;
		});
	}

	const bookmarksToDisplay = writable<Bookmark[]>($page.data.bookmarks);

	$: {
		if ($searchedValue.trim()) {
			bookmarksToDisplay.set($page.data.bookmarks);
			const searchedBookmarksIds = searchEngine.search($searchedValue).map((b) => b.item.id);
			fetch(`/api/bookmarks?ids=${JSON.stringify(searchedBookmarksIds)}`)
				.then((r) => r.json())
				.then((r) => {
					$bookmarksToDisplay = r.bookmarks;
				});
		}
	}
	$: {
		const sortedBookmarks = sortBookmarks(
			$bookmarksToDisplay,
			$userSettingsStore.bookmarksSortedBy
		);
		bookmarks = filterBookmarks(sortedBookmarks, $userSettingsStore);
	}

	let bookmarksViewForm: HTMLFormElement;
</script>

{#if $user.isValid && $user.model}
	<div class="flex flex-col sm:flex-row justify-center ml-auto w-full m-4">
		<form
			class="flex flex-1 w-full pr-5 items-center flex-wrap"
			bind:this={bookmarksViewForm}
			method="POST"
			action="/settings/?/updateUserSettings"
			use:enhance={({ formData }) => {
				$userSettingsStore = {
					...($user.model?.settings || {}),
					bookmarksView: formData.get('bookmarksView') === 'on' ? 'list' : 'grid',
					// @ts-ignore
					bookmarksSortedBy: JSON.parse(formData.get('bookmarksSortedBy') || '{}')?.value,
					bookmarksOnlyShowRead: formData.get('bookmarksOnlyShowRead') === 'on',
					bookmarksOnlyShowFlagged: formData.get('bookmarksOnlyShowFlagged') === 'on'
				};

				formData.set('settings', JSON.stringify($userSettingsStore));

				return async ({ result }) => {
					if (result.type === 'success') {
						await applyAction(result);
					}
				};
			}}
		>
			<div class="tooltip flex flex-col justify-center" data-tip="Change view">
				<label class="link swap swap-rotate px-1 hover:text-secondary">
					<input
						type="checkbox"
						name="bookmarksView"
						checked={$userSettingsStore.bookmarksView === 'list'}
						on:change={() => {
							bookmarksViewForm.requestSubmit();
						}}
					/>
					<IconLayout2 class="w-5 h-5 swap-on" />
					<IconListDetails class="w-5 h-5 swap-off" />
				</label>
			</div>
			<div class="tooltip" data-tip="Sort items">
				<Select
					class="this-select select min-w-fit "
					placeholder="Sort by"
					searchable={false}
					clearable={false}
					items={sortByOptions}
					name="bookmarksSortedBy"
					value={sortByOptions.find((o) => o.value === $userSettingsStore.bookmarksSortedBy)}
					on:change={() => {
						bookmarksViewForm.requestSubmit();
					}}
				>
					<div slot="prepend">
						{#if $userSettingsStore.bookmarksSortedBy.includes('_asc')}
							<IconSortAscending class="w-5 h-5" />
						{:else}
							<IconSortDescending class="w-5 h-5" />
						{/if}
					</div>
				</Select>
			</div>
			<div class="flex">
				<div class="tooltip cursor-pointer" data-tip="Show only unread">
					<label class="label cursor-pointer gap-2">
						<span class="label-text hover:text-secondary">Only unread</span>
						<input
							type="checkbox"
							name="bookmarksOnlyShowRead"
							checked={$userSettingsStore.bookmarksOnlyShowRead}
							class="checkbox"
							on:change={() => {
								bookmarksViewForm.requestSubmit();
							}}
						/>
					</label>
				</div>
				<div class="tooltip cursor-pointer" data-tip="Show only flagged">
					<label class="label cursor-pointer gap-2">
						<span class="label-text hover:text-secondary">Only flagged</span>
						<input
							type="checkbox"
							name="bookmarksOnlyShowFlagged"
							checked={$userSettingsStore.bookmarksOnlyShowFlagged}
							class="checkbox"
							on:change={() => {
								bookmarksViewForm.requestSubmit();
							}}
						/>
					</label>
				</div>
			</div>
			<span class="ml-auto text-sm text-gray-500"
				>{`Showing ${bookmarks.length} out of ${$page.data.bookmarks.length}`}</span
			>
		</form>
		<AddBookmarkButton />
	</div>

	<BookmarkList {bookmarks} />
	<Pagination
		page={$page.data.page}
		limit={$page.data.limit}
		items={$page.data.bookmarksCount}
		position="right"
	/>
{:else}
	<div class="flex flex-col items-center justify-center h-full">
		<h1 class="text-2xl">Grimoire welcomes!</h1>
		<p class="text-lg">
			Please <a href="/login" class="link">login</a> or
			<a href="/signup" class="link">signup</a>
			to see your bookmarks
		</p>
	</div>
{/if}
