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
	import toast, { Toaster } from 'svelte-french-toast';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';

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

<div class="relative card w-full sm:w-96 bg-base-100 shadow-xl mb-4 break-inside-avoid">
	<figure class="relative max-h-36">
		<div on:click={onShowBookmark} class="w-full hover:brightness-90">
			{#if (!bookmark.main_image.endsWith('/') && bookmark.main_image) || bookmark.main_image_url}
				<img src={bookmark.main_image || bookmark.main_image_url} alt="Main" />
			{:else}
				<IconPhotoX class="mx-auto my-16" />
			{/if}
		</div>
		<div
			class="badge badge-xl absolute top-1 left-1"
			style={`border-color: ${bookmark.category.color};`}
		>
			<span class="brightness-75" style={`color: ${bookmark.category.color};`}
				>{bookmark.category.name}</span
			>
		</div>

		<form
			bind:this={importanceForm}
			method="POST"
			action="/?/updateImportance"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						await applyAction(result);
					}
					if (result.type === 'error') {
						toast.error(`Error: ${JSON.stringify(result?.error)}`, {
							position: 'bottom-center'
						});
					}
				};
			}}
		>
			<input type="hidden" name="id" value={bookmark.id} />
			<div class="badge rating rating-sm opacity-90 absolute bottom-1 left-1">
				<input
					type="radio"
					name="importance"
					class="rating-hidden rating-sm"
					checked={!bookmark.importance}
					value="0"
					on:change={() => importanceForm.requestSubmit()}
				/>
				<input
					type="radio"
					name="importance"
					class="mask mask-star-2 bg-orange-400"
					checked={bookmark.importance === 1}
					value="1"
					on:change={() => importanceForm.requestSubmit()}
				/>
				<input
					type="radio"
					name="importance"
					class="mask mask-star-2 bg-orange-400"
					checked={bookmark.importance === 2}
					value="2"
					on:change={() => importanceForm.requestSubmit()}
				/>
				<input
					type="radio"
					name="importance"
					class="mask mask-star-2 bg-orange-400"
					checked={bookmark.importance === 3}
					value="3"
					on:change={() => {
						importanceForm.requestSubmit();
					}}
				/>
				<input
					type="radio"
					name="importance"
					class="rating-hidden rating-sm"
					checked={!bookmark.importance}
					value="0"
					on:change={() => importanceForm.requestSubmit()}
				/>
			</div>
		</form>

		<div class="absolute flex bottom-1 right-1 scale-90 gap-1">
			<form
				bind:this={readForm}
				method="POST"
				action="/?/updateRead"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							await applyAction(result);
						}
						if (result.type === 'error') {
							toast.error(`Error: ${JSON.stringify(result?.error)}`, {
								position: 'bottom-center'
							});
						}
					};
				}}
			>
				<input type="hidden" name="id" value={bookmark.id} />
				<label class="swap btn btn-circle btn-xs p-4">
					<input
						type="checkbox"
						name="read"
						checked={!!bookmark.read}
						on:change={() => {
							readForm.requestSubmit();
						}}
					/>
					<IconEyeCheck class="swap-on text-blue-500" />
					<IconEyeClosed class="swap-off text-gray-400" />
				</label>
			</form>
			<form
				bind:this={flaggedForm}
				method="POST"
				action="/?/updateFlagged"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							await applyAction(result);
						}
						if (result.type === 'error') {
							toast.error(`Error: ${JSON.stringify(result?.error)}`, {
								position: 'bottom-center'
							});
						}
					};
				}}
			>
				<input type="hidden" name="id" value={bookmark.id} />
				<label class="swap btn btn-circle btn-xs p-4">
					<input
						type="checkbox"
						name="flagged"
						checked={!!bookmark.flagged}
						on:change={() => {
							flaggedForm.requestSubmit();
						}}
					/>
					<IconBookmarkFilled class="swap-on text-green-600" />
					<IconBookmark class="swap-off text-gray-400" />
				</label>
			</form>
		</div>
	</figure>
	<div class="card-body p-2">
		<div class="flex flex-wrap items-baseline">
			<div class="flex items-baseline gap-2">
				<img
					src={bookmark.icon || bookmark.icon_url}
					alt={`${bookmark.domain}'s favicon`}
					class="avatar w-4"
				/>
				<form
					bind:this={increaseOpenedTimesForm}
					method="POST"
					action="/?/updateIncreasedOpenedCount"
					use:enhance
				>
					<input type="hidden" name="id" value={bookmark.id} />
				</form>
				<a
					href={bookmark.url}
					title={bookmark.title}
					target="_self"
					class="link link-hover card-title text-lg line-clamp-1"
					on:click={() => {
						increaseOpenedTimesForm.requestSubmit();
					}}>{bookmark.title}</a
				>
				<div class="flex">
					<a
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
						title="open in a new tab"
						class="btn btn-xs btn-circle btn-ghost"
						on:click={() => {
							navigator.clipboard.writeText(bookmark.url);
							toast.success('URL copied to clipboard', {
								position: 'bottom-center'
							});
						}}
					>
						<IconClipboardText size={14} />
					</button>
				</div>
			</div>
			<div class="badge ml-auto badge-ghost">{bookmark.domain}</div>
		</div>
		<div class="tooltip text-left" data-tip={bookmark.description}>
			<p class="font-light text-sm text-gray-700 line-clamp-2">
				{bookmark.description}
			</p>
		</div>
		<div class="card-actions justify-end px-2 font-medium tracking-tight gap-1">
			<span class="font-sans font-semibold text-xs">#</span>
			{#if bookmark.tags}
				{#each bookmark.tags as tag}
					<a href={`/tags/${tag.name}`} class="link font-sans text-xs">{tag.name}</a>
				{/each}
			{/if}
			<button title="Add new tag" class="link link-hover font-sans text-xs text-gray-400">+</button>
		</div>
	</div>
	<div class="dropdown dropdown-end absolute top-1 right-1">
		<label for="options">
			<button tabindex="0" class="btn btn-circle btn-ghost btn-xs">
				<IconDots stroke={1.5} />
			</button>
		</label>
		<ul class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-28">
			<!-- <li> -->
			<!-- <button type="button" class="btn btn-xs btn-ghost" on:click={onEditBookmark} tabindex="0"
				>Edit</button> -->
			<!-- </li> -->
			<li>
				<a on:click={onEditBookmark} tabindex="0">Edit</a>
			</li>
			<li>
				<form
					method="POST"
					action="/?/deleteBookmark"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								toast.success('Bookmark deleted', {
									position: 'bottom-center'
								});
								await applyAction(result);
							}
						};
					}}
				>
					<input type="hidden" name="id" value={bookmark.id} />
					<button tabindex="0" class="text"> Remove </button>
				</form>
			</li>
		</ul>
	</div>
</div>
<Toaster />
