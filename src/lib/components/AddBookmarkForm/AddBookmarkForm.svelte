<script lang="ts">
	import type { Metadata } from '$lib/interfaces/Metadata.interface';
	import { debounce } from 'lodash';
	import Select from 'svelte-select';
	import { writable, type Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	const defaultFormValues: Metadata = {
		url: '',
		domain: '',
		title: '',
		description: '',
		author: '',
		content_text: '',
		content_html: '',
		content_type: '',
		main_image_url: '',
		icon_url: '',
		content_published_date: null
	};

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
	>([...$page.data.tags.map((t) => ({ value: t.id, label: t.name }))]);

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

	function handleTagsChange() {
		$bookmarkTags = [
			...$bookmarkTags?.map((i) => {
				if (i.created) {
					delete i.created;
				}
				return i;
			})
		];
	}

	let note = '';
	let error = '';
	const loading = writable(false);

	const onGetMetadata = debounce(
		async (event: Event) => {
			const validateUrlRegex =
				/^(?:(?:https?|ftp):\/\/|www\.|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/;
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

<form
	method="POST"
	action="?/addNewBookmark"
	use:enhance={() =>
		({ update, formData }) => {
			const defaultCategory = $page.data.categories.find((c) => c.name === 'Uncategorized');
			console.log("formData.get('category')", formData.get('category'));
			if (!formData.get('category') && defaultCategory) {
				formData.set('category', defaultCategory?.id);
			}
			closeModal();
			update();
		}}
>
	<div class="w-full">
		<div class="form-control flex w-full gap-4">
			<input type="text" class="hidden" name="domain" value={metadata.domain} />
			<input type="text" class="hidden" name="content_html" value={metadata.content_html} />
			<input
				type="text"
				class="hidden"
				name="content_published_date"
				value={metadata.content_published_date}
			/>

			{#if error}
				<div class="alert alert-error">{error}</div>
			{/if}
			<div class="join">
				<input
					type="text"
					placeholder="Paste link here..."
					class="join-item input input-secondary input-bordered w-full"
					name="url"
					value={metadata.url}
					on:input={onGetMetadata}
					disabled={$loading}
				/>
				{#if metadata.url}
					<button
						class="join-item btn btn-primary"
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
				<div class="flex flex-col w-full">
					<div class="flex flex-col md:flex-row items-center justify-between w-full gap-2">
						<div class="flex flex-col md:flex-row items-center justify-between w-full gap-2">
							<div class="flex flex-col w-full">
								<label for="tags" class="label">Category</label>
								<Select
									name="category"
									searchable
									placeholder="Select category..."
									value={$page.data.categories[0].id}
									items={$page.data.categories.map((c) => ({
										value: c.id,
										label: c.name
									}))}
								/>
							</div>
							<div class="flex flex-col w-full">
								<label for="tags" class="label">Tags</label>
								<Select
									name="tags"
									searchable
									multiple
									on:filter={handleTagsFilter}
									on:change={handleTagsChange}
									bind:filterText={tagsInputFilterText}
									bind:value={$bookmarkTagsInput}
									items={$bookmarkTags}
								>
									<div slot="item" let:item>
										{item.created ? 'Create tag: ' : ''}
										{item.label}
									</div>
								</Select>
							</div>
						</div>
						<div class="flex w-full md:w-4/12 gap-4 ml-4">
							<div class="flex flex-col w-full">
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
							<div class="flex flex-col w-full">
								<label for="flag" class="label">Flag it?</label>
								<label class="cursor-pointer label max-w-fit gap-2">
									<!-- <span class="label-text">Flag</span> -->
									<input type="checkbox" name="flagged" class="checkbox checkbox-error" />
								</label>
							</div>
						</div>
					</div>
					<div class="flex flex-col w-full">
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
					<div class="flex flex-col w-full">
						<label for="icon" class="label">Icon</label>
						<div class="flex gap-2">
							<input
								type="text"
								class="input input-bordered w-9/12"
								name="icon_url"
								value={metadata.icon_url}
								on:input={(event) => {
									// @ts-ignore-next-line
									metadata.icon_url = event.target.value;
								}}
							/>
							{#if metadata.icon_url}
								<img class="w-8 h-8 m-auto md:ml-8" src={metadata.icon_url} alt={metadata.title} />
							{/if}
						</div>
					</div>
					<div class="flex flex-col w-auto">
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
						{#if metadata.main_image_url}
							<img
								class="rounded-md m-auto max-h-64"
								src={metadata.main_image_url}
								alt={metadata.title}
							/>
						{/if}
						<input
							type="text"
							class="input input-bordered w-full"
							name="main_image_url"
							value={metadata.main_image_url}
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.main_image_url = event.target.value;
							}}
						/>
					</div>
					<div class="flex flex-col w-auto">
						<label for="content_text" class="label">Content (text)</label>
						<textarea
							class="textarea textarea-bordered"
							name="content_text"
							value={metadata.content_text}
							placeholder="Extracted if possible..."
							on:input={(event) => {
								// @ts-ignore-next-line
								metadata.content_text = event.target.value;
							}}
						/>
					</div>
					<div class="flex flex-col w-full">
						<label for="author" class="label">Author</label>
						<input
							type="text"
							class="input input-bordered"
							name="author"
							value={metadata.author}
							placeholder="Extracted if possible..."
						/>
					</div>
					<div class="flex flex-col w-auto">
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
				class="btn btn-primary my-6 mx-auto w-full max-w-xs"
				disabled={$loading || !metadata.url || !metadata.title}>Add</button
			>
		</div>
	</div>
</form>
