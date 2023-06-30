<script lang="ts">
	import Select from 'svelte-select';
	import { debounce } from 'lodash';
	import { enhance } from '$app/forms';
	import { writable, type Writable } from 'svelte/store';
	import { page } from '$app/stores';

	import { editBookmarkStore } from '$lib/stores/edit-bookmark.store';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';

	let form: HTMLFormElement;
	export let closeModal: () => void;

	let error = '';
	const loading = writable(false);
	const bookmark = writable<Partial<Bookmark>>({});

	$: $bookmark = { ...$editBookmarkStore };

	const bookmarkTagsInput: Writable<
		| {
				value: string;
				label: string;
				created?: boolean;
		  }[]
		| null
	> = writable(null);

	$: $bookmarkTagsInput = $bookmark.tags?.map((t) => ({ value: t.id, label: t.name })) || null;

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
			...$bookmarkTags.map((i) => {
				if (i.created) {
					delete i.created;
				}
				return i;
			})
		];
	}

	const onGetMetadata = debounce(
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
			({ update }) => {
				closeModal();
				update();
			}}
	>
		<input type="text" class="hidden" name="id" value={$bookmark.id} />

		<div class="w-full">
			<div class="form-control flex w-full gap-4">
				<input type="text" class="hidden" name="domain" value={$bookmark.domain} />
				<input type="text" class="hidden" name="content_html" value={$bookmark.content_html} />
				<input
					type="text"
					class="hidden"
					name="content_published_date"
					value={$bookmark.content_published_date}
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
						value={$bookmark.url}
						on:input={onGetMetadata}
						disabled={$loading}
					/>
				</div>

				{#if $loading}
					<div class="loading loading-lg m-auto my-10" />
				{/if}
				<div class="flex flex-col w-full">
					<div class="flex flex-col md:flex-row items-start justify-between w-full gap-2">
						<div class="flex flex-col w-full">
							<!-- <label for="category" class="label">Category</label>
							<select
								class="select select-bordered w-full"
								name="category"
								value={$bookmark.category?.id}
							>
								{#each $page.data.categories as category}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select> -->
							{#if $bookmark.category?.id}
								<label for="tags" class="label">Category</label>
								<Select
									name="category"
									searchable
									items={$page.data.categories.map((c) => ({
										value: c.id,
										label: c.name
									}))}
									value={$bookmark.category?.id}
								/>
							{/if}
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
						<div class="flex flex-col w-full md:w-4/12 gap-4 ml-4">
							<div class="flex flex-col w-full">
								<label for="importance" class="label">Importance</label>
								<div class="rating rating-md">
									<input
										type="radio"
										name="importance"
										class="rating-hidden"
										value=""
										checked={!$bookmark.importance}
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="1"
										checked={$bookmark.importance === 1}
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="2"
										checked={$bookmark.importance === 2}
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400"
										value="3"
										checked={$bookmark.importance === 3}
									/>
								</div>
							</div>
							<div class="flex flex-col w-full">
								<label for="flag" class="label">Flag it?</label>
								<label class="cursor-pointer label max-w-fit gap-2">
									<!-- <span class="label-text">Flag</span> -->
									<input
										type="checkbox"
										name="flagged"
										class="checkbox checkbox-error"
										checked={!!$bookmark.flagged}
									/>
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
							value={$bookmark.title}
							required
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.title = event.target.value;
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
								value={$bookmark.icon_url}
								on:input={(event) => {
									// @ts-ignore-next-line
									$bookmark.icon_url = event.target.value;
								}}
							/>
							{#if $bookmark.icon_url}
								<img
									class="w-8 h-8 m-auto md:ml-8"
									src={$bookmark.icon_url}
									alt={$bookmark.title}
								/>
							{/if}
						</div>
					</div>
					<div class="flex flex-col w-auto">
						<label for="description" class="label">Description</label>
						<textarea
							class="textarea textarea-bordered"
							name="description"
							value={$bookmark.description}
							on:change={(event) => {
								// @ts-ignore-next-line
								$bookmark.description = event.target.value;
							}}
						/>
					</div>
					<div class="flex flex-col gap-2">
						<label for="main image" class="label">Main image</label>
						{#if $bookmark.main_image_url}
							<img
								class="rounded-md m-auto max-h-64"
								src={$bookmark.main_image_url}
								alt={$bookmark.title}
							/>
						{/if}
						<input
							type="text"
							class="input input-bordered w-full"
							name="main_image_url"
							value={$bookmark.main_image_url}
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.main_image_url = event.target.value;
							}}
						/>
					</div>
					<div class="flex flex-col w-auto">
						<label for="content_text" class="label">Content (text)</label>
						<textarea
							class="textarea textarea-bordered"
							name="content_text"
							value={$bookmark.content_text}
							placeholder="Extracted if possible..."
							on:input={(event) => {
								// @ts-ignore-next-line
								bookmark.content_text = event.target.value;
							}}
						/>
					</div>
					<div class="flex flex-col w-full">
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
							}}
						/>
					</div>
					<div class="flex flex-col w-auto">
						<label for="note" class="label">Your note</label>
						<textarea
							class="textarea textarea-bordered"
							name="note"
							value={$bookmark.note}
							placeholder="Add your note here..."
							on:input={(event) => {
								// @ts-ignore-next-line
								$bookmark.note = event.target.value;
							}}
						/>
					</div>
				</div>

				<button
					class="btn btn-primary my-6 mx-auto w-full max-w-xs"
					disabled={$loading || !$bookmark.url || !$bookmark.title}>Save</button
				>
			</div>
		</div>
	</form>
{/if}
