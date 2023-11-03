<script lang="ts">
	import Select from 'svelte-select';
	import { debounce, endsWith } from 'lodash';
	import { enhance } from '$app/forms';
	import { writable, type Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import toast, { Toaster } from 'svelte-french-toast';

	import { editBookmarkStore } from '$lib/stores/edit-bookmark.store';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';

	export let closeModal: () => void;
	let contentTab = writable<'text' | 'html'>('html');

	function onEditBookmark() {
		closeModal();
		editBookmarkStore.set($bookmark);
	}
	const bookmark = writable<Partial<Bookmark>>({});

	$: $bookmark = { ...$showBookmarkStore };

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
</script>

<div class="flex flex-col gap-8 max-w-5xl">
	<button class="btn btn-sm btn-link absolute right-8 top-8" on:click={onEditBookmark} tabindex="0"
		>Edit</button
	>
	<div class="flex justify-between gap-2">
		<h1 class="text-2xl">
			{$bookmark.title}
		</h1>
	</div>
	<div class="flex flex-col lg:flex-row gap-4">
		{#if $bookmark?.id}
			<div class="flex flex-col gap-2 min-w-[24rem]">
				<div class="flex flex-col md:flex-row gap-2">
					<div class="flex flex-col flex-1 gap-2 min-w-fit">
						<div class="flex gap-2 items-center">
							{#if $bookmark.icon || $bookmark.icon_url}
								<img src={$bookmark.icon || $bookmark.icon_url} alt="Icon" class="w-8 h-8" />
							{/if}
							<p class="badge badge-ghost">{$bookmark.domain}</p>
						</div>
						<div>
							<h3 class="text-xl">Tags</h3>
							<div class="flex gap-1 m-1">
								{#if $bookmark.tags?.length}
									{#each $bookmark.tags as tag}
										<span class="badge badge-outline badge-sm">{tag.name}</span>
									{/each}
								{:else}
									<p class=" text-gray-600">No tags</p>
								{/if}
							</div>
						</div>
						<div class="flex flex-col text-sm">
							<span class="flex items-center gap-2">
								<b> Importance: </b>
								<div class="rating rating-sm">
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400 cursor-default"
										checked={$bookmark.importance === 1}
										value="1"
										disabled
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400 cursor-default"
										checked={$bookmark.importance === 2}
										value="2"
										disabled
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 bg-orange-400 cursor-default"
										checked={$bookmark.importance === 3}
										value="3"
										disabled
									/>
								</div>
							</span>
							<span class="flex items-center gap-2">
								<b> Read: </b>
								{$bookmark.read ? 'Yes' : 'No'}
							</span>
							<span class="flex items-center gap-2">
								<b> Flagged: </b>
								{$bookmark.flagged ? 'Yes' : 'No'}
							</span>
							<span class="flex items-center gap-2">
								<b> Archived: </b>
								{$bookmark.archived ? 'Yes' : 'No'}
							</span>
							<span
								class="flex items-center gap-2"
								title={`Last on: ${
									$bookmark.opened_last ? new Date($bookmark.opened_last).toLocaleString() : ''
								}`}
							>
								<b> Opened: </b>
								{$bookmark.opened_times || 0} times
							</span>

							<span
								class="flex items-center gap-2"
								title={`Added on: ${
									$bookmark.created ? new Date($bookmark.created).toLocaleString() : ''
								}`}
							>
								<b> Added: </b>
								{$bookmark.created
									? `${Math.floor(
											(Date.now() - new Date($bookmark.created).getTime()) / 86400000
									  )} days ago`
									: ''}
							</span>
							<span
								class="flex items-center gap-2"
								title={`Updated on: ${
									$bookmark.updated ? new Date($bookmark.updated).toLocaleString() : ''
								}`}
							>
								<b> Updated: </b>
								{$bookmark.updated
									? `${Math.floor(
											(Date.now() - new Date($bookmark.updated).getTime()) / 86400000
									  )} days ago`
									: ''}
							</span>
						</div>
					</div>

					<div class="max-w-md">
						{#if ($bookmark.main_image && !$bookmark.main_image.endsWith('/')) || $bookmark.main_image_url}
							<img
								src={$bookmark.main_image || $bookmark.main_image_url}
								alt="Main"
								class="w-full rounded-md relative hover:scale-[2] transition-all duration-300 z-10 overflow-visible"
							/>
						{/if}
					</div>
				</div>

				<div>
					<h3 class="text-xl">Description</h3>
					<p>{$bookmark.description}</p>
				</div>
				<div>
					{#if $bookmark.author}
						<span>
							<b> By: </b>
							{$bookmark.author || 'Unknown'}
						</span>
					{/if}
					{#if $bookmark.content_published_date}
						<span>
							<b> Published on: </b>
							{$bookmark.content_published_date
								? new Date($bookmark.content_published_date).toLocaleString()
								: ''}
						</span>
					{/if}
				</div>
			</div>
			<div class="flex flex-col gap-4 min-w-[20rem]">
				<div>
					<h3 class="text-xl">Content</h3>
					<div class="tabs">
						<div
							class={`tab tab-lifted ${$contentTab === 'html' ? 'tab-active' : ''}`}
							on:click={() => ($contentTab = 'html')}
							on:keydown={() => ($contentTab = 'html')}
							role="tab"
							tabindex="0"
						>
							HTML
						</div>
						<div
							class={`tab tab-lifted ${$contentTab === 'text' ? 'tab-active' : ''}`}
							on:click={() => ($contentTab = 'text')}
							on:keydown={() => ($contentTab = 'text')}
							role="tab"
							tabindex="0"
						>
							Text
						</div>
					</div>
					<p
						class={`overflow-y-scroll ${
							$bookmark.content_html || $bookmark.content_text ? 'h-60' : 'text-gray-500 m-2 '
						}`}
					>
						{#if $contentTab === 'html' && $bookmark.content_html}
							{@html $bookmark.content_html}
						{:else if $contentTab === 'html'}
							<p>No content</p>
						{/if}
						{#if $contentTab === 'text' && $bookmark.content_text}
							{$bookmark.content_text}
						{:else if $contentTab === 'text'}
							<p>No content</p>
						{/if}
					</p>
				</div>

				<div>
					<h3 class="text-xl">Note</h3>
					<p class={`overflow-y-scroll ${$bookmark.note ? 'h-14' : 'text-gray-500 m-2 '}`}>
						{#if $bookmark.note}
							{$bookmark.note}
						{:else}
							No content
						{/if}
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
<Toaster />