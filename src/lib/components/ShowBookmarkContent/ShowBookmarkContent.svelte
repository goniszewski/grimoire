<script lang="ts">
	import Select from 'svelte-select';
	import { debounce, endsWith } from 'lodash';
	import { enhance } from '$app/forms';
	import { writable, type Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import toast, { Toaster } from 'svelte-french-toast';

	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';

	export let closeModal: () => void;
	let contentTab = writable<'text' | 'html'>('html');

	let error = '';
	const loading = writable(false);
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

<div class="flex flex-col gap-4">
	{#if $bookmark?.id}
		<h1 class="text-2xl">
			{$bookmark.title}
		</h1>
		<div class="flex flex-col md:flex-row">
			<div class="flex flex-col flex-1">
				<div class="flex gap-2">
					{#if $bookmark.icon || $bookmark.icon_url}
						<img src={$bookmark.icon || $bookmark.icon_url} alt="Icon" class="w-8 h-8" />
					{/if}
					<p class="">{$bookmark.domain}</p>
				</div>
				<div>
					<h3 class="text-xl">Tags</h3>
					<div class="flex gap-1 m-1">
						{#if $bookmark.tags?.length}
							{#each $bookmark.tags as tag}
								<span class="badge badge-outline badge-sm">{tag.name}</span>
							{/each}
						{:else}
							<p>No tags</p>
						{/if}
					</div>
				</div>
				<div class="flex flex-col text-sm">
					<span>
						<b> Importance: </b>
						{$bookmark.importance}
					</span>
					<span>
						<b> Read: </b>
						{$bookmark.read ? 'Yes' : 'No'}
					</span>
					<span>
						<b> Flagged: </b>
						{$bookmark.flagged ? 'Yes' : 'No'}
					</span>
					<span>
						<b> Opened: </b>
						{$bookmark.opened_count || 0} times
					</span>
					<span>
						<b> last on: </b>
						{$bookmark.opened_last ? new Date($bookmark.opened_last).toLocaleString() : ''}
					</span>
					<span>
						<b> Added: </b>
						{$bookmark.created ? new Date($bookmark.created).toLocaleString() : ''}
					</span>
					<span>
						<b> Updated: </b>
						{$bookmark.updated ? new Date($bookmark.updated).toLocaleString() : ''}
					</span>
					<span>
						<b> Archived: </b>
						{$bookmark.archived ? 'Yes' : 'No'}
					</span>
				</div>
			</div>

			<div class=" max-w-md">
				{#if ($bookmark.main_image && !$bookmark.main_image.endsWith('/')) || $bookmark.main_image_url}
					<img src={$bookmark.main_image || $bookmark.main_image_url} alt="Main" class="w-full" />
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
		<div>
			<h3 class="text-xl">Content</h3>
			<div class="tabs">
				<div
					class={`tab tab-bordered ${$contentTab === 'html' ? 'tab-active' : ''}`}
					on:click={() => ($contentTab = 'html')}
				>
					HTML
				</div>
				<div
					class={`tab tab-bordered ${$contentTab === 'text' ? 'tab-active' : ''}`}
					on:click={() => ($contentTab = 'text')}
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
	{/if}
</div>
<Toaster />
