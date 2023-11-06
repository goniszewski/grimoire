<script lang="ts">
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';

	import { enhance, applyAction } from '$app/forms';
	import { editBookmarkStore } from '$lib/stores/edit-bookmark.store';
	import {
		IconEyeCheck,
		IconEyeClosed,
		IconBookmarkFilled,
		IconBookmark,
		IconDots,
		IconPhotoX,
		IconExternalLink,
		IconClipboardText
	} from '@tabler/icons-svelte';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';
	import { invalidate } from '$app/navigation';
	import { showToast } from '$lib/utils/show-toast';

	export let bookmark: Bookmark = {} as Bookmark;
	let importanceForm: HTMLFormElement;
	let readForm: HTMLFormElement;
	let flaggedForm: HTMLFormElement;
	let increaseOpenedTimesForm: HTMLFormElement;

	function onEditBookmark() {
		editBookmarkStore.set(bookmark);
	}

	function onShowBookmark() {
		showBookmarkStore.set(bookmark);
	}
</script>

<div
	class="relative flex w-full bg-base-100 border shadow-sm rounded-lg h-16 p-2 gap-10"
	on:click={onShowBookmark}
	on:keydown={onShowBookmark}
	role="button"
	tabindex="0"
>
	<div class="flex flex-col gap-1 w-96">
		<div class="flex items-center gap-1">
			<img
				src={bookmark.icon || bookmark.icon_url}
				alt={`${bookmark.domain}'s favicon`}
				class="avatar w-4 h-4 rounded-sm"
			/>
			<div class="flex">
				<a
					href={bookmark.url}
					title={bookmark.title}
					target="_self"
					class="link link-hover text-sm line-clamp-1"
					on:click={() => {
						increaseOpenedTimesForm.requestSubmit();
					}}>{bookmark.title}</a
				><a
					href={bookmark.url}
					title="open in a new tab"
					target="_blank"
					class=" btn btn-xs btn-circle btn-ghost"
					on:click={() => {
						increaseOpenedTimesForm.requestSubmit();
					}}
				>
					<IconExternalLink size={14} />
				</a>
				<button
					title="copy URL to clipboard"
					class="btn btn-xs btn-circle btn-ghost"
					on:click={() => {
						navigator.clipboard.writeText(bookmark.url);
						showToast.success('URL copied to clipboard', {
							position: 'bottom-center'
						});
					}}
				>
					<IconClipboardText size={14} />
				</button>
			</div>
		</div>
	</div>
	<div class="flex flex-col justify-center">
		<div class="tooltip text-left" data-tip={bookmark.description}>
			<p class="font-light text-sm text-gray-700 line-clamp-2">
				{bookmark.description}
			</p>
		</div>
	</div>
	<div class="flex flex-col ml-auto min-w-max gap-2">
		<div class="badge badge-ghost bg-gray-100 bg-opacity-75 ml-auto">{bookmark.domain}</div>
		<div class="flex px-2 font-medium tracking-tight ml-auto gap-1">
			<span class="font-sans font-semibold text-xs">#</span>
			{#if bookmark.tags}
				{#each bookmark.tags as tag}
					<a href={`/tags/${tag.name}`} class="link font-sans text-xs">{tag.name}</a>
				{/each}
			{/if}
			<button title="Add new tag" class="link link-hover font-sans text-xs text-gray-400">+</button>
		</div>
	</div>
</div>
