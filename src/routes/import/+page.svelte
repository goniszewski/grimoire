<script lang="ts">
import { page } from '$app/stores';
import BulkList from '$lib/components/BulkList/BulkList.svelte';
import Pagination from '$lib/components/Pagination/Pagination.svelte';
import Select from '$lib/components/Select/Select.svelte';
import { importBookmarkStore } from '$lib/stores/import-bookmarks.store';
import type { BulkListItem } from '$lib/types/common/BulkList.type';
import { importBookmarks } from '$lib/utils/import-bookmarks';
import { showToast } from '$lib/utils/show-toast';
import { derived, writable } from 'svelte/store';

const step = writable<number>(1);
const isFetchingMetadata = writable<boolean>(true);
const defaultCategory = '[No parent]';
const selectedCategory = writable<string>();
const processedItems = writable<number>(0);

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

	isFetchingMetadata.set(true);

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
		`Successfully imported ${results.length - failedItemsCount} bookmarks from ${
			items.length
		} items (${failedItemsCount} failed).`,
		{
			icon: failedItemsCount ? '⚠️' : '🎉',
			duration: 3000
		}
	);
};

const categoriesOptions = writable<{ value: string; label: string }[]>([]);

$: {
	$categoriesOptions = [
		...[...new Set($importBookmarkStore.map((item) => item.category))].map((category) => ({
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
			category: bookmark.categorySlug || defaultCategory,
			description: bookmark.description || undefined,
			selected: false
		}));

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
	$selectedCategory = e.detail.value;
};
const onSetSelectedCategory = () => {
	importBookmarkStore.update((items) =>
		items.map((item) => (item.selected ? { ...item, category: $selectedCategory } : item))
	);
};
</script>

<div class="flex max-w-4xl flex-col">
	{#if $step === 1}
		<h1 class="mb-4 text-2xl font-bold">Import bookmarks from HTML file</h1>
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
		<div class="mb-4 flex w-full gap-2 pl-12">
			<button
				class="btn btn-primary btn-sm"
				disabled={$isFetchingMetadata}
				on:click={importBookmarkStore.removeSelected}>IMPORT</button>

			{#if $isAnySelected && !$isFetchingMetadata}
				<Select
					name="category"
					searchable
					placeholder="Change category"
					size="md"
					items={$categoriesOptions}
					onSelect={onSelectCategory} />
				<button class="btn btn-primary btn-sm" on:click={onSetSelectedCategory}> SET </button>
			{/if}

			<div class="ml-auto flex gap-2">
				<button
					class="btn btn-primary btn-sm"
					disabled={!$isAnySelected && !$selectedCategory}
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
						max={$importBookmarkStore.length}>
					</progress>
				{:else}
					<span class="mr-2">
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
	{/if}
</div>
