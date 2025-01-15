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
import type { Metadata } from '$lib/types/Metadata.type';
import { importBookmarks } from '$lib/utils/import-bookmarks';
import { showToast } from '$lib/utils/show-toast';
import { derived, writable } from 'svelte/store';
import { IconFileTypeHtml } from '@tabler/icons-svelte';

const defaultCategory = '[No parent]';

const user = $page.data.user;
const step = writable<number>(3);
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
				const { metadata }: { metadata: Metadata } = await response.json();
				processedItems.update((count) => count + 1);

				return {
					...item,
					...metadata,
					title: item.title || metadata.title,
					imported: true,
					icon: item.icon || metadata.iconUrl
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
				name:
					importedData.categories.find((category) => category.slug === bookmark.categorySlug)
						?.name || defaultCategory
			},
			description: bookmark.description || '',
			selected: false,
			importance: null,
			flagged: null,
			note: null,
			domain: '',
			author: null,
			contentHtml: null,
			contentText: null,
			contentPublishedDate: null,
			contentType: null,
			mainImageUrl: null,
			iconUrl: null,
			imported: true
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

{#if !user}
	<p>Not logged in.</p>
{:else if $step === 1}
	<div class="hero bg-base-200">
		<div class="hero-content flex-col lg:flex-row">
			<IconFileTypeHtml size={300} stroke={1.2} class="rounded-md p-10 text-info" />
			<div>
				<h1 class="text-4xl font-bold">Import bookmarks from HTML file</h1>
				<p class="py-6">
					Use this tool to import your bookmarks exported as HTML file (from browser or any
					compatible tool)
				</p>
				<input
					type="file"
					title="Select backup file"
					id="backup"
					name="backup"
					accept=".html,.htm"
					multiple={false}
					class="file-input file-input-bordered file-input-primary file-input-md w-full max-w-xs"
					on:change={onFileSelected} />
			</div>
		</div>
	</div>
{:else if $step === 2}
	<div class="flex w-full max-w-4xl flex-col">
		<form
			method="POST"
			use:enhance={({ formData }) => {
				formData.set(
					'bookmarks',
					JSON.stringify(
						$importBookmarkStore.map((bookmark) => ({
							url: bookmark.url,
							domain: bookmark.domain,
							title: bookmark.title,
							description: bookmark.description,
							category: bookmark.category,
							mainImageUrl: bookmark.mainImageUrl,
							iconUrl: bookmark.iconUrl,
							author: bookmark.author,
							contentText: bookmark.contentText,
							contentHtml: bookmark.contentHtml,
							contentType: bookmark.contentType,
							contentPublishedDate: bookmark.contentPublishedDate,
							importance: bookmark.importance,
							flagged: bookmark.flagged,
							note: bookmark.note,
							bookmarkTags: bookmark.bookmarkTags
						}))
					)
				);

				return async ({ update, result }) => {
					if (result.type === 'success' && result?.data?.data) {
						showToast.success('Bookmarks imported successfully');
						const { data } = result.data;
						if (data) {
							// @ts-ignore-next-line
							importResult.set(data);
							step.set(3);
						}
					} else {
						showToast.error('Failed to import bookmarks');
					}
					update();
				};
			}}>
			<div class="mb-4 flex w-full gap-2 pl-12">
				<button
					type="submit"
					class="btn btn-primary btn-sm"
					disabled={$isFetchingMetadata || $importBookmarkStore.length === 0}
					aria-label="Import bookmarks">
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
		</form>
		<Pagination
			page={$page.data.page}
			limit={$page.data.limit}
			items={$itemsCount}
			position="right" />
	</div>
{:else if $step === 3 && $importResult?.total}
	<div class="flex w-full flex-col items-center justify-center">
		<h1 class="mb-8 text-2xl font-bold">Import results</h1>
		<div class="flex w-full flex-col items-center justify-center">
			{#if $importResult.successful}
				<div>
					<span class="text-xl font-bold text-success">
						{$importResult.successful}
					</span>
					<span class="text-xl">bookmarks imported successfully.</span>
				</div>
			{/if}
			{#if $importResult.failed}
				<div>
					<span class="text-xl font-bold text-error">
						{$importResult.failed}
					</span>
					<span class="text-xl">bookmarks failed to import.</span>
				</div>
			{/if}
			<div class="mt-4">
				<span class="text-xl font-bold">{$importResult.total}</span>
				<span class="text-xl">bookmarks in total.</span>
			</div>

			<div class="mt-8 flex w-full flex-col gap-4">
				{#if $importResult.failed}
					<div class="collapse bg-base-200">
						<input type="checkbox" />
						<div class="collapse-title text-xl font-semibold">Click here to see failed items</div>
						<div class="collapse-content">
							<div class="flex flex-col gap-4">
								<div class="overflow-x-auto">
									<table class="table">
										<thead>
											<tr>
												<th>#</th>
												<th>Title</th>
												<th>Category</th>
												<th>URL</th>
											</tr>
										</thead>
										<tbody>
											{#each $importResult.results.filter((item) => !item.success) as { bookmark }, i (bookmark.id)}
												<tr class="bg-base-200">
													<th>{i + 1}</th>
													<td class="break-all font-bold">{bookmark.title}</td>
													<td>{bookmark.category}</td>
													<td
														><a class="link link-primary" href={bookmark.url} target="_blank"
															>{bookmark.url.slice(0, 10)}{bookmark.url.length > 10 ? '...' : ''}</a
														></td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				{/if}
				<div class="mt-4 flex flex-col items-center justify-center">
					<a class="btn btn-primary btn-sm ml-4" href="/import">back to import page</a>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex w-full flex-col items-center justify-center">
		<h1 class="mb-8 text-2xl font-bold">Import failed to complete</h1>
		<p class="mb-4 text-xl">Unexpected error occurred while importing bookmarks 🔥</p>
		<p>(check your console for more details)</p>
		<div class="flex w-full flex-col items-center justify-center">
			<div class="flex flex-col items-center justify-center">
				<div class="mt-4 flex flex-col items-center justify-center">
					<a class="btn btn-primary btn-sm ml-4" href="/import">try again</a>
				</div>
			</div>
		</div>
	</div>
{/if}
