<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';

	import { applyAction, enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { env } from '$env/dynamic/public';
	import Pagination from '$lib/components/Pagination/Pagination.svelte';
	import { defaultUserSettings } from '$lib/config';
	import { bookmarksStore } from '$lib/stores/bookmarks.store';
	import { searchEngine, searchedValue } from '$lib/stores/search.store';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import type { Bookmark } from '$lib/types/Bookmark.type';
	import type { UserSettings } from '$lib/types/UserSettings.type';
	import { initializeSearch } from '$lib/utils/search';
	import { sortBookmarks } from '$lib/utils/sort-bookmarks';
	import {
		IconLayout2,
		IconListDetails,
		IconSortAscending,
		IconSortDescending
	} from '@tabler/icons-svelte';
	import _ from 'lodash';
	import Select from 'svelte-select';
	import { writable } from 'svelte/store';

	const sortByOptions = [
		{ label: 'added (desc)', value: 'created_desc' },
		{ label: 'added (asc)', value: 'created_asc' },
		{ label: 'domain (desc)', value: 'domain_desc' },
		{ label: 'domain (asc)', value: 'domain_asc' },
		{ label: 'opened times (desc)', value: 'opened_times_desc' },
		{ label: 'opened times (asc)', value: 'opened_times_asc' }
	];

	$searchEngine = initializeSearch($page.data.bookmarksForIndex);

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
			const searchedBookmarksIds = $searchEngine.search($searchedValue).map((b) => b.item.id);
			_.throttle(() => {
				fetch(`/api/bookmarks?ids=${searchedBookmarksIds.join(',')}`)
					.then((r) => r.json())
					.then((r) => {
						$bookmarksToDisplay = r.bookmarks;
					});
			}, 250)();
		} else {
			$bookmarksToDisplay = $page.data.bookmarks;
		}
	}
	$: {
		const sortedBookmarks = sortBookmarks(
			$bookmarksToDisplay,
			$userSettingsStore.bookmarksSortedBy
		);
		bookmarksStore.set(filterBookmarks(sortedBookmarks, $userSettingsStore));
	}

	let bookmarksViewForm: HTMLFormElement;
</script>

{#if $page.data.user?.id}
	<div class="m-4 ml-auto flex flex-1 w-full flex-col justify-center sm:flex-row">
		<form
			class="flex w-full flex-1 flex-wrap items-center pr-5"
			bind:this={bookmarksViewForm}
			method="POST"
			action="/settings/?/updateUserSettings"
			use:enhance={({ formData }) => {
				$userSettingsStore = {
					...($page.data.user?.settings || defaultUserSettings),
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
					<IconLayout2 class="swap-on h-5 w-5" />
					<IconListDetails class="swap-off h-5 w-5" />
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
							<IconSortAscending class="h-5 w-5" />
						{:else}
							<IconSortDescending class="h-5 w-5" />
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
				>{`Showing ${$bookmarksStore.length} out of ${$page.data.bookmarks.length}`}</span
			>
		</form>
		<AddBookmarkButton />
	</div>

	<BookmarkList bookmarks={$bookmarksStore} />
	<Pagination
		page={$page.data.page}
		limit={$page.data.limit}
		items={$page.data.bookmarksCount}
		position="right"
	/>
{:else if $page.data.noUsersFound}
	<div class="flex h-full flex-col items-center justify-center">
		<h1 class="text-2xl">Initialization Wizard 🧙</h1>
		<div class="my-4 flex max-w-2xl flex-col gap-2 text-center">
			<p class="text-lg">Looks like you're about to start using Grimoire for the first time!</p>
			{#if env?.PUBLIC_SIGNUP_DISABLED === 'true'}
				<p class="text-lg">
					Please enable public signup in your <code>.env</code> file and
					<strong><a href="/signup" class="link">create your first User</a></strong> to start using Grimoire.
				</p>
			{:else}
				<p class="text-lg">
					Please <strong><a href="/signup" class="link">create your first User</a></strong> or check
					out the
					<strong><a href="/admin/login" class="link">Admin Panel</a></strong> (use the credentials
					you set in your
					<code>.env</code> file).
				</p>
			{/if}
			<p class="mt-4">
				To learn about differences between Admin and User accounts, please check out
				<a href="https://grimoire.pro/docs/admins-vs-users" class="link">this page</a>.
			</p>
		</div>
	</div>
{:else}
	<div class="flex h-full flex-col items-center justify-center">
		<h1 class="text-2xl">Grimoire welcomes!</h1>
		<p class="text-lg">
			Please <a href="/login" class="link">login</a> or
			<a href="/signup" class="link">signup</a>
			to see your bookmarks
		</p>
	</div>
{/if}
