<script lang="ts">
import { enhance } from '$app/forms';
import { page } from '$app/stores';
import Select from '$lib/components/Select/Select.svelte';
import _ from 'lodash';
import SvelteSelect from 'svelte-select';

import { writable, type Writable } from 'svelte/store';

import { invalidate } from '$app/navigation';
import { editBookmarkCategoriesStore, editBookmarkStore } from '$lib/stores/edit-bookmark.store';
import { importBookmarkStore } from '$lib/stores/import-bookmarks.store';
import { searchEngine } from '$lib/stores/search.store';
import type { Bookmark, BookmarkEdit } from '$lib/types/Bookmark.type';
import { updateBookmarkInSearchIndex } from '$lib/utils/search';
import { showToast } from '$lib/utils/show-toast';

let form: HTMLFormElement;
export let closeModal: () => void;

let error = '';
const loading = writable(false);
const bookmark = writable<BookmarkEdit | Partial<Bookmark>>();

$: $bookmark = { ...$editBookmarkStore };

const categoryItems = [
	...$page.data.categories.map((c) => ({
		value: `${c.id}`,
		label: c.name
	})),
	...$editBookmarkCategoriesStore.map((c) => ({
		value: c,
		label: c
	}))
];

const bookmarkTagsInput: Writable<
	| {
			value: string;
			label: string;
			created?: boolean;
	  }[]
	| null
> = writable(null);

$: $bookmarkTagsInput =
	(isImportedBookmark($bookmark)
		? $bookmark.bookmarkTags?.map((t) => ({
				value: t.value,
				label: t.label
			}))
		: ($bookmark as Partial<Bookmark>).tags?.map((t) => ({ value: `${t.id}`, label: t.name }))) ||
	null;

const bookmarkTags = writable<
	{
		value: string;
		label: string;
		created?: boolean;
	}[]
>([...$page.data.tags.map((t) => ({ value: `${t.id}`, label: t.name }))]);
let tagsInputFilterText: '';

function handleTagsFilter(e: CustomEvent<{ value: string; label: string; created?: boolean }[]>) {
	if (
		!$bookmarkTagsInput?.find((i) => i.label === tagsInputFilterText) &&
		e.detail.length === 0 &&
		tagsInputFilterText.length > 0
	) {
		const prev = $bookmarkTags.filter((i) => !i.created);
		$bookmarkTags = [
			...prev,
			{ value: tagsInputFilterText, label: tagsInputFilterText, created: true }
		];
	}
}

function handleTagsInput(e: CustomEvent<{ value: string; label: string; created?: boolean }[]>) {
	if (!e.detail) {
		$bookmarkTags = [];
		return e;
	}
	const lastItemIndex = e.detail.length - 1;
	e.detail[lastItemIndex] = {
		...e.detail[lastItemIndex],
		label: e.detail[lastItemIndex].label.replace(/#/g, ''),
		value: e.detail[lastItemIndex].value
	};

	return e;
}

function handleTagsChange() {
	$bookmarkTags = [
		...$bookmarkTags.map((i) => {
			if (i.label.startsWith('#')) {
				i.label = i.label.replace(/#/g, '');
				i.value = i.value.replace(/#/g, '');
			}
			if (i.created) {
				delete i.created;
			}
			return i;
		})
	];
}

function isImportedBookmark(
	bookmark: BookmarkEdit | Partial<Bookmark>
): bookmark is BookmarkEdit & { imported: boolean } {
	return 'imported' in bookmark;
}

function handleSubmit() {
	if (isImportedBookmark($bookmark) && $bookmark.imported) {
		const formData = new FormData(form);
		let rawData = Object.fromEntries(formData as any);
		delete rawData.tags;
		// editBookmarkStore.set({
		// 	...$bookmark,
		// 	...rawData,
		// 	category: JSON.parse(rawData.category)?.label,
		// 	bookmarkTags: $bookmarkTags
		// });
		importBookmarkStore.updateItem(+$bookmark.id, {
			...$bookmark,
			...rawData,
			category: JSON.parse(rawData.category)?.label,
			bookmarkTags: $bookmarkTags
		});
		closeModal();
	} else {
		form.submit();
	}
}

const onGetMetadata = _.debounce(
	async (event: Event) => {
		const validateUrlRegex =
			/^(?:(?:https?|ftp):\/\/|www\.|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/;
		const target = event.target as HTMLButtonElement;
		const url = target.value;
		error = '';

		loading.set(true);

		if (!url.match(validateUrlRegex)) {
			error = 'Invalid URL';
			loading.set(false);
			return;
		}

		fetch(`/api/fetch-metadata`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url })
		})
			.then((res) => res.json())
			.then((data) => {
				$bookmark = {
					...$bookmark,
					...data?.metadata
				};
			})
			.catch((err) => {
				console.error(err);
				error = 'Failed to fetch metadata';
			})
			.finally(() => {
				loading.set(false);
			});
	},
	500,
	{
		leading: false,
		trailing: true,
		maxWait: 1000
	}
);
</script>

{#if $bookmark?.id}
	<form
		bind:this={form}
		method="POST"
		action="/?/updateBookmark"
		use:enhance={() =>
			async ({ update, result }) => {
				if (result.type === 'success') {
					await invalidate('app:main-page');
					showToast.success('Bookmark updated', {
						position: 'bottom-center'
					});

					updateBookmarkInSearchIndex(
						$searchEngine,
						// @ts-ignore-next-line
						result?.data?.bookmark
					);
				}

				if (result.type === 'error') {
					showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
						position: 'bottom-center'
					});
				}
				closeModal();
				update();
			}}>
		<input type="text" class="hidden" name="id" value={$bookmark.id} />

		<div class="w-full">
			<div class="form-control flex w-full gap-4">
				<input type="text" class="hidden" name="domain" value={$bookmark.domain} />
				<input type="text" class="hidden" name="content_html" value={$bookmark.contentHtml} />
				<input
					type="text"
					class="hidden"
					name="content_published_date"
					value={$bookmark.contentPublishedDate} />

				{#if error}
					<div class="alert alert-error">{error}</div>
				{/if}
				<div class="join">
					<input
						type="text"
						placeholder="Paste link here..."
						class="input join-item input-bordered input-secondary w-full"
						name="url"
						value={$bookmark.url}
						on:input={onGetMetadata}
						disabled={$loading} />
				</div>

				{#if $loading}
					<div class="loading loading-lg m-auto my-10" />
				{/if}
				<div class="flex w-full flex-col">
					<div class="flex w-full flex-col items-start justify-between gap-2 md:flex-row">
						<div class="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
							<div class="flex flex-none flex-col">
								{#if typeof $bookmark.category === 'string' || $bookmark.category?.id}
									<label for="category" class="label">Category</label>
									<Select
										name="category"
										searchable
										items={categoryItems}
										value={`${$bookmark.category?.id || $bookmark.category}`}
										placeholder={'Select category'}
										border={false}
										className="this-select input input-bordered w-full md:min-w-28" />
								{/if}
							</div>
							<div class="flex w-full flex-1 flex-col">
								<label for="tags" class="label">Tags</label>
								<SvelteSelect
									name="tags"
									searchable
									multiple
									listAutoWidth={true}
									on:input={handleTagsInput}
									on:filter={handleTagsFilter}
									on:change={handleTagsChange}
									bind:filterText={tagsInputFilterText}
									bind:value={$bookmarkTagsInput}
									items={$bookmarkTags}
									class="this-select input input-bordered min-w-full flex-1">
									<div slot="item" let:item>
										{item.created ? 'Create tag: ' : ''}
										{item.label}
									</div>
								</SvelteSelect>
							</div>
						</div>
						<div class="ml-4 flex w-full gap-4 md:w-4/12">
							<div class="flex w-full flex-col">
								<label for="importance" class="label">Importance</label>
								<div class="rating rating-md">
									<input
										type="radio"
										name="importance"
										class="rating-hidden"
										value=""
										checked={!$bookmark.importance} />
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="1"
										checked={$bookmark.importance === 1} />
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="2"
										checked={$bookmark.importance === 2} />
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="3"
										checked={$bookmark.importance === 3} />
								</div>
							</div>
							<div class="flex w-full flex-col">
								<label for="flag" class="label whitespace-nowrap">Flag it?</label>
								<label class="label max-w-fit cursor-pointer gap-2">
									<!-- <span class="label-text">Flag</span> -->
									<input
										type="checkbox"
										name="flagged"
										class="checkbox-error checkbox"
										checked={!!$bookmark.flagged} />
								</label>
							</div>
						</div>
					</div>
					<div class="flex w-full flex-col">
						<label for="title" class="label">Title</label>
						<input
							type="text"
							class="input input-bordered"
							name="title"
							value={$bookmark.title}
							required
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.title = event.target.value;
							}} />
					</div>
					<div class="flex w-full flex-col">
						<label for="icon" class="label">Icon</label>
						<div class="flex gap-2">
							<input
								type="text"
								class="input input-bordered w-9/12"
								name="icon_url"
								value={$bookmark.iconUrl}
								on:input={(event) => {
									// @ts-ignore-next-line
									$bookmark.icon_url = event.target.value;
								}} />
							{#if $bookmark.iconUrl}
								<img class="m-auto h-8 w-8 md:ml-8" src={$bookmark.iconUrl} alt={$bookmark.title} />
							{/if}
						</div>
					</div>
					<div class="flex w-auto flex-col">
						<label for="description" class="label">Description</label>
						<textarea
							class="textarea textarea-bordered"
							name="description"
							value={$bookmark.description}
							on:change={(event) => {
								// @ts-ignore-next-line
								$bookmark.description = event.target.value;
							}} />
					</div>
					<div class="flex flex-col gap-2">
						<label for="main image" class="label">Main image</label>
						{#if $bookmark.mainImageUrl}
							<img
								class="m-auto max-h-64 rounded-md"
								src={$bookmark.mainImageUrl}
								alt={$bookmark.title} />
						{/if}
						<input
							type="text"
							class="input input-bordered w-full"
							name="main_image_url"
							value={$bookmark.mainImageUrl}
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.main_image_url = event.target.value;
							}} />
					</div>
					<div class="flex w-auto flex-col">
						<label for="content_text" class="label">Content (text)</label>
						<textarea
							class="textarea textarea-bordered"
							name="content_text"
							value={$bookmark.contentText}
							placeholder="Extracted if possible..."
							on:input={(event) => {
								// @ts-ignore-next-line
								bookmark.content_text = event.target.value;
							}} />
					</div>
					<div class="flex w-full flex-col">
						<label for="author" class="label">Author</label>
						<input
							type="text"
							class="input input-bordered"
							name="author"
							value={$bookmark.author}
							placeholder="Extracted if possible..."
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.author = event.target.value;
							}} />
					</div>
					<div class="flex w-auto flex-col">
						<label for="note" class="label">Your note</label>
						<textarea
							class="textarea textarea-bordered"
							name="note"
							value={$bookmark.note}
							placeholder="Add your note here..."
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.note = event.target.value;
							}} />
					</div>
				</div>

				<button
					class="btn btn-primary mx-auto my-6 w-full max-w-xs"
					on:click|preventDefault={handleSubmit}
					disabled={$loading || !$bookmark.url || !$bookmark.title}>Save</button>
			</div>
		</div>
	</form>
{/if}
