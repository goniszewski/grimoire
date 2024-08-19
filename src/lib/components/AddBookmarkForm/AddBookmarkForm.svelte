<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { generateTags } from '$lib/integrations/ollama';
	import { searchEngine } from '$lib/stores/search.store';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import type { Metadata } from '$lib/types/Metadata.type';
	import { validateUrlRegex } from '$lib/utils/regex-library';
	import { addBookmarkToSearchIndex } from '$lib/utils/search';
	import { showToast } from '$lib/utils/show-toast';

	import { IconInfoCircle } from '@tabler/icons-svelte';
	import _ from 'lodash';
	import { onDestroy } from 'svelte';
	import Select from 'svelte-select';
	import { writable, type Writable } from 'svelte/store';

	const defaultFormValues: Metadata = {
		url: '',
		domain: '',
		title: '',
		description: '',
		author: '',
		contentText: '',
		contentHtml: '',
		contentType: '',
		mainImageUrl: '',
		iconUrl: '',
		contentPublishedDate: null
	};
	const defaultCategory = $page.data.categories.find((c) => Boolean(c.initial))!;
	const categorySelectItems = $page.data.categories.map((c) => ({
		value: `${c.id}`,
		label: c.name
	}));

	onDestroy(() => {
		bookmarkTagsInput.set(null);
		metadata = { ...defaultFormValues };
	});

	let metadata: Metadata = { ...defaultFormValues };
	export let closeModal: () => void;

	const bookmarkTagsInput: Writable<
		| {
				value: string;
				label: string;
				created?: boolean;
		  }[]
		| null
	> = writable(null);

	const bookmarkTags = writable<
		{
			value: string;
			label: string;
			created?: boolean;
		}[]
	>([...$page.data.tags.map((t) => ({ value: `${t.id}`, label: t.name }))]);
	const loadingTags = writable(false);

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
			value: e.detail[lastItemIndex].value.replace(/#/g, '')
		};

		return e;
	}

	function handleTagsChange() {
		$bookmarkTags = [
			...$bookmarkTags?.map((i) => {
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

	let note = '';
	let error = '';
	let warning = '';
	const loading = writable(false);

	const onGetMetadata = _.debounce(
		async (event: Event) => {
			const target = event.target as HTMLButtonElement;
			const url = target.value;
			error = '';

			loading.set(true);

			if (!url) {
				metadata = { ...defaultFormValues };
				loading.set(false);
				return;
			}
			if (!url.match(validateUrlRegex)) {
				error = 'Invalid URL';
				loading.set(false);
				return;
			}

			const bookmarkExists = $page.data.bookmarks.find((b) => b.url === url);
			if (bookmarkExists) {
				warning = `Be warned, bookmark with this URL already exists as '${bookmarkExists.title}' in '${bookmarkExists.category?.name}' category.`;
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
					metadata = data?.metadata || { ...defaultFormValues };

					if (!metadata.contentText || !$userSettingsStore?.llm || !$userSettingsStore.llm.enabled)
						return;

					$loadingTags = true;

					const generateTagsPromise = generateTags(
						metadata.contentText,
						$userSettingsStore?.llm?.ollama
					);

					showToast
						.promise(
							generateTagsPromise,
							{
								loading: 'Generating tags...',
								success: 'Tags generated!',
								error: 'Failed to generate tags.'
							},
							{
								position: 'bottom-right'
							}
						)
						.then((tags) => {
							$loadingTags = false;
							bookmarkTagsInput.set(tags!.map((t) => ({ value: t, label: t })));
						})
						.catch((err) => {
							$loadingTags = false;
							console.error(err);
						});
				})
				.catch((err) => {
					console.error(err);
					error = 'Failed to fetch metadata';
				})
				.finally(() => {
					loading.set(false);
				});
		},
		1000,
		{
			leading: false,
			trailing: true,
			maxWait: 1000
		}
	);
</script>

<form
	method="POST"
	action="/?/addNewBookmark"
	use:enhance={({ formData }) => {
		if (!formData.get('category') && defaultCategory) {
			formData.set('category', `${defaultCategory?.id}`);
		}
		return async ({ update, result }) => {
			if (result.type === 'success' && result?.data?.bookmark) {
				// @ts-ignore-next-line
				addBookmarkToSearchIndex($searchEngine, result.data.bookmark);

				metadata = { ...defaultFormValues };
				bookmarkTagsInput.set(null);

				update();
				closeModal();
			}
		};
	}}
>
	<div class="w-full">
		<div class="form-control flex w-full gap-4">
			<input type="text" class="hidden" name="domain" value={metadata.domain} />
			<input type="text" class="hidden" name="content_html" value={metadata.contentHtml} />
			<input
				type="text"
				class="hidden"
				name="content_published_date"
				value={metadata.contentPublishedDate}
			/>

			{#if error}
				<div class="alert alert-error">{error}</div>
			{/if}
			{#if warning}
				<div class="alert alert-warning">
					<IconInfoCircle />
					{warning}
				</div>
			{/if}
			<div class="join">
				<input
					type="text"
					placeholder="Paste link here..."
					class="input join-item input-bordered input-secondary w-full"
					name="url"
					value={metadata.url}
					on:input={onGetMetadata}
					disabled={$loading}
				/>
				{#if metadata.url}
					<button
						class="btn btn-primary join-item"
						on:click={() => {
							// @ts-ignore-next-line
							metadata.url = '';
						}}
						disabled={!metadata.url || $loading}
					>
						X
					</button>
				{/if}
			</div>

			{#if $loading}
				<div class="loading loading-lg m-auto my-10" />
			{/if}
			{#if !$loading && metadata.url}
				<div class="flex w-full flex-col">
					<div class="flex w-full flex-col items-start justify-between gap-2 md:flex-row">
						<div class="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
							<div class="flex flex-none flex-col">
								<label for="category" class="label">Category</label>
								<Select
									name="category"
									searchable
									placeholder="Select category..."
									value={`${defaultCategory.id}`}
									items={categorySelectItems}
									class="this-select input input-bordered w-full"
								/>
							</div>
							<div class="flex w-full flex-1 flex-col">
								<label for="tags" class="label">Tags</label>
								<Select
									name="tags"
									searchable
									multiple
									listAutoWidth={true}
									on:input={handleTagsInput}
									on:filter={handleTagsFilter}
									on:change={handleTagsChange}
									bind:filterText={tagsInputFilterText}
									bind:value={$bookmarkTagsInput}
									bind:loading={$loadingTags}
									items={$bookmarkTags}
									class="this-select input input-bordered min-w-full flex-1"
								>
									<div slot="item" let:item>
										{item.created ? 'Create tag: ' : ''}
										{item.label}
									</div>
								</Select>
							</div>
						</div>
						<div class="ml-4 flex w-full gap-4 md:w-4/12">
							<div class="flex w-full flex-col">
								<label for="importance" class="label">Importance</label>
								<div class="rating rating-md">
									<input type="radio" name="importance" class="rating-hidden" value="" checked />
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="1"
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="2"
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="3"
									/>
								</div>
							</div>
							<div class="flex w-full flex-col">
								<label for="flag" class="label whitespace-nowrap">Flag it?</label>
								<label class="label max-w-fit cursor-pointer gap-2">
									<!-- <span class="label-text">Flag</span> -->
									<input type="checkbox" name="flagged" class="checkbox-error checkbox" />
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
							value={metadata.title}
							required
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.title = event.target.value;
							}}
						/>
					</div>
					<div class="flex w-full flex-col">
						<label for="icon" class="label">Icon</label>
						<div class="flex gap-2">
							<input
								type="text"
								class="input input-bordered w-9/12"
								name="icon_url"
								value={metadata.iconUrl}
								on:input={(event) => {
									// @ts-ignore-next-line
									metadata.icon_url = event.target.value;
								}}
							/>
							{#if metadata.iconUrl}
								<img class="m-auto h-8 w-8 md:ml-8" src={metadata.iconUrl} alt={metadata.title} />
							{/if}
						</div>
					</div>
					<div class="flex w-auto flex-col">
						<label for="description" class="label">Description</label>
						<textarea
							class="textarea textarea-bordered"
							name="description"
							value={metadata.description}
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.description = event.target.value;
							}}
						/>
					</div>
					<div class="flex flex-col gap-2">
						<label for="main image" class="label">Main image</label>
						{#if metadata.mainImageUrl}
							<img
								class="m-auto max-h-64 rounded-md"
								src={metadata.mainImageUrl}
								alt={metadata.title}
							/>
						{/if}
						<input
							type="text"
							class="input input-bordered w-full"
							name="main_image_url"
							value={metadata.mainImageUrl}
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.main_image_url = event.target.value;
							}}
						/>
					</div>
					<div class="flex w-auto flex-col">
						<label for="content_text" class="label">Content (text)</label>
						<textarea
							class="textarea textarea-bordered"
							name="content_text"
							value={metadata.contentText}
							placeholder="Extracted if possible..."
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.content_text = event.target.value;
							}}
						/>
					</div>
					<div class="flex w-full flex-col">
						<label for="author" class="label">Author</label>
						<input
							type="text"
							class="input input-bordered"
							name="author"
							value={metadata.author}
							placeholder="Extracted if possible..."
						/>
					</div>
					<div class="flex w-auto flex-col">
						<label for="note" class="label">Your note</label>
						<textarea
							class="textarea textarea-bordered"
							name="note"
							value={note}
							placeholder="Add your note here..."
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.note = event.target.value;
							}}
						/>
					</div>
				</div>
			{/if}

			<button
				class="btn btn-primary mx-auto my-6 w-full max-w-xs"
				disabled={$loading || !metadata.url || !metadata.title}>Add</button
			>
		</div>
	</div>
</form>
