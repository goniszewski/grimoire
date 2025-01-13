<script lang="ts">
import { enhance } from '$app/forms';
import { page } from '$app/stores';
import BulkList from '$lib/components/BulkList/BulkList.svelte';
import Pagination from '$lib/components/Pagination/Pagination.svelte';
import Select from '$lib/components/Select/Select.svelte';
import { editBookmarkCategoriesStore, editBookmarkStore } from '$lib/stores/edit-bookmark.store';
import { importBookmarkStore } from '$lib/stores/import-bookmarks.store';
import type { ImportExecutionResult } from '$lib/types/BookmarkImport.type';
import type { BulkListItem } from '$lib/types/common/BulkList.type';
import { importBookmarks } from '$lib/utils/import-bookmarks';
import { showToast } from '$lib/utils/show-toast';
import { derived, writable } from 'svelte/store';

const defaultCategory = '[No parent]';

const step = writable<number>(1);
const isFetchingMetadata = writable<boolean>(true);
const selectedCategory = writable<string>();
const processedItems = writable<number>(0);
const importResult = writable<ImportExecutionResult>();

const currentItems = derived([importBookmarkStore, page], ([$importBookmarkStore, $page]) => {
	return $importBookmarkStore.slice(
		($page.data.page - 1) * $page.data.limit,
		$page.data.page * $page.data.limit
	);
});
const { isAnySelected, length: itemsCount } = importBookmarkStore;

const processMetadataQueue = async (items: BulkListItem[]) => {
	const CONCURRENT_REQUESTS = 2;
	const queue = [...items.filter((item) => !item.contentHtml)];
	const results: BulkListItem[] = [];

	while (queue.length > 0) {
		const batch = queue.splice(0, CONCURRENT_REQUESTS);
		const batchPromises = batch.map(async (item) => {
			if (item.contentHtml) {
				return item;
			}
			try {
				const response = await fetch('/api/fetch-metadata', {
					method: 'POST',
					body: JSON.stringify({ url: item.url }),
					headers: { 'Content-Type': 'application/json' }
				});
				const { metadata } = await response.json();
				processedItems.update((count) => count + 1);

				return {
					...metadata,
					...item,
					imported: true,
					icon: item.icon || metadata.iconUrl,
					title: item.title || metadata.title
				};
			} catch (error) {
				console.error(`Failed to fetch metadata for ${item.url}:`, error);
				return item;
			}
		});

		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);
		importBookmarkStore.set(results.concat(queue));
	}

	const failedItemsCount = results.filter((item) => !item.contentHtml).length;

	isFetchingMetadata.set(false);
	showToast.success(
		`Successfully fetched metadata for ${results.length - failedItemsCount} bookmarks from ${
			items.length
		} items (failed for ${failedItemsCount}).`,
		{
			icon: failedItemsCount ? '⚠️' : '🎉',
			duration: 3000
		}
	);
};

const categoriesOptions = writable<{ value: string; label: string }[]>([]);

$: {
	$categoriesOptions = [
		...[...new Set($importBookmarkStore.map((item) => item.category.name))].map((category) => ({
			value: category,
			label: category,
			group: 'Imported'
		})),
		...$page.data.categories.map((c) => ({
			value: `${c.id}`,
			label: c.name,
			group: 'Existing'
		}))
	];
}

const onFileSelected = async (event: Event) => {
	const input = event.target as HTMLInputElement;
	if (input.files && input.files.length > 0) {
		const fileContent = await input.files[0].text();
		const importedData = await importBookmarks(fileContent, 'netscape');
		const updatedBookmarks = importedData.bookmarks.map((bookmark, i) => ({
			...bookmark,
			id: i + 1,
			icon: bookmark.icon || null,
			category: {
				name: bookmark.categorySlug || defaultCategory
			},
			description: bookmark.description || '',
			selected: false,
			importance: null,
			flagged: null,
			note: null
		}));
		$editBookmarkCategoriesStore = [...new Set(updatedBookmarks.map((item) => item.category.name))];

		importBookmarkStore.set(updatedBookmarks);
		processMetadataQueue($importBookmarkStore);

		step.set(2);
	}
};

const onSelectCategory = (
	e: CustomEvent<{
		value: string;
		label: string;
	}>
) => {
	$selectedCategory = e.detail.label;
};
const onSetSelectedCategory = () => {
	importBookmarkStore.update((items) =>
		items.map((item) =>
			item.selected
				? {
						...item,
						category: {
							name: $selectedCategory
						}
					}
				: item
		)
	);
};
</script>

{#if $step === 1}
	<h1 class="mb-8 text-2xl font-bold">Import bookmarks from HTML file</h1>
	<input
		type="file"
		title="Select backup file"
		id="backup"
		name="backup"
		accept=".html,.htm"
		multiple={false}
		class="file-input file-input-bordered file-input-primary file-input-md w-full max-w-xs"
		on:change={onFileSelected} />
{:else if $step === 2}
	<form
		method="POST"
		use:enhance={({ formData }) => {
			formData.set(
				'bookmarks',
				JSON.stringify(
					$importBookmarkStore.map((bookmark) => ({
						url: bookmark.url,
						title: bookmark.title,
						description: bookmark.description,
						category: bookmark.category.name,
						bookmarkTags: bookmark.bookmarkTags
					}))
				)
			);

			return async ({ update, result }) => {
				if (result.type === 'success') {
					showToast.success('Bookmarks imported successfully');
					step.set(3);
				} else {
					showToast.error('Failed to import bookmarks');
				}
				update();
			};
		}}>
		<div class="flex max-w-6xl flex-col">
			<div class="mb-4 flex w-full gap-2 pl-12">
				<button
					type="submit"
					class="btn btn-primary btn-sm"
					disabled={$isFetchingMetadata || $importBookmarkStore.length === 0}
					aria-label="Import selected bookmarks">
					{#if $isFetchingMetadata}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					IMPORT
				</button>

				{#if $isAnySelected && !$isFetchingMetadata}
					<Select
						name="category"
						searchable
						placeholder="Change category"
						size="md"
						items={$categoriesOptions}
						groupBy
						onSelect={onSelectCategory} />
					<button
						class="btn btn-secondary btn-sm"
						aria-label="Set selected category"
						on:click={onSetSelectedCategory}>
						SET
					</button>
				{/if}

				<div class="ml-auto flex gap-2">
					<button
						class="btn btn-error btn-sm"
						disabled={!$isAnySelected}
						aria-label="Delete selected bookmarks"
						on:click={importBookmarkStore.removeSelected}>DELETE</button>
				</div>
			</div>
			<div class="flex min-h-6 flex-col items-center gap-2">
				<div class="flex items-center justify-center">
					{#if $isFetchingMetadata}
						<span class="mr-2">Fetching metadata...</span>
						<progress
							class="progress progress-primary w-56"
							value={$processedItems}
							max={$importBookmarkStore.length}
							aria-label={`Processing ${$processedItems} of ${$importBookmarkStore.length} items`}>
							{Math.round(($processedItems / $importBookmarkStore.length) * 100)}%
						</progress>
					{:else}
						<span class="mr-2" role="status">
							Done! {$importBookmarkStore.length === $processedItems
								? 'All items processed.'
								: `${$processedItems} of ${$importBookmarkStore.length} items processed 🪄`}
						</span>
					{/if}
				</div>
			</div>

			<BulkList itemList={currentItems} isLoading={$isFetchingMetadata} />
			<Pagination
				page={$page.data.page}
				limit={$page.data.limit}
				items={$itemsCount}
				position="right" />
		</div>
	</form>
{:else if $step === 3}
	<div class="flex flex-col items-center justify-center">
		<h1 class="mb-8 text-2xl font-bold">Import results</h1>
		<div class="flex flex-col items-center justify-center">
			{#if $importResult.successful}
				<div class="alert alert-success">
					<div>
						<span class="text-lg font-bold">Success!</span>
						<span class="text-sm">
							{$importResult.successful} bookmarks imported successfully.
						</span>
					</div>
				</div>
			{/if}
			{#if $importResult.failed}
				<div class="alert alert-error">
					<div>
						<span class="text-lg font-bold">Error!</span>
						<span class="text-sm">
							{$importResult.failed} bookmarks failed to import.
						</span>
					</div>
				</div>
			{/if}
			<div class="flex flex-col items-center justify-center">
				<span>
					Total bookmarks: {$importResult.total}
				</span>
			</div>
		</div>
	</div>
{/if}
