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
		IconClipboardText,
		IconMenu,
		IconBackspace,
		IconPencil
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

<div class="flex flex-col justify-between border p-2 rounded-md min-h-[6rem] gap-1">
	<div class="flex">
		<div class="flex items-center justify-between gap-1">
			<div class="flex items-center gap-1">
				<img
					src={bookmark.icon || bookmark.icon_url}
					alt={`${bookmark.domain}'s favicon`}
					class="avatar w-4 h-4 rounded-sm"
				/>
				<div class="tooltip text-left" data-tip="open in current tab">
					<a
						href={bookmark.url}
						title={bookmark.title}
						target="_self"
						class="link link-hover text-sm line-clamp-1"
						on:click={() => {
							increaseOpenedTimesForm.requestSubmit();
						}}>{bookmark.title}</a
					>
				</div>
				<div class="flex">
					<div class="tooltip text-left" data-tip="open in new tab">
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
					</div>
					<div class="tooltip text-left" data-tip="copy URL to clipboard">
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
		</div>
		<div
			class="badge badge-ghost bg-gray-100 bg-opacity-75 h-6 ml-auto line-clamp-1 max-w-[8rem] md:max-w-fit"
		>
			{bookmark.domain}
		</div>
	</div>
	<div
		class="flex"
		on:click={onShowBookmark}
		on:keydown={onShowBookmark}
		role="button"
		tabindex="0"
	>
		<div class="tooltip text-left" data-tip={bookmark.description}>
			{#if bookmark.description}
				<p class="font-light text-sm text-gray-700 line-clamp-2 w-full md:w-10/12">
					{bookmark.description}
				</p>
			{:else}
				<p class="font-light text-sm text-gray-500 italic">No description...</p>
			{/if}
		</div>
	</div>
	<div class="flex justify-between">
		<div class="flex items-center gap-1">
			<a
				href={`/categories/${bookmark.category.slug}`}
				class="badge badge-sm w-full max-w-[8rem]"
				style={`border-color: ${bookmark.category.color};`}
			>
				<span
					class="brightness-75 w-full whitespace-nowrap overflow-hidden overflow-ellipsis"
					style={`color: ${bookmark.category.color};`}>{bookmark.category.name}</span
				>
			</a>
			<span class="font-sans font-semibold text-xs">#</span>
			{#if bookmark.tags}
				{#each bookmark.tags as tag}
					<a
						href={`/tags/${tag.name}`}
						class="link font-sans text-xs w-full whitespace-nowrap max-w-[8rem]">{tag.name}</a
					>
				{/each}
			{/if}
			<button title="Add new tag" class="link link-hover font-sans text-xs text-gray-400">+</button>
		</div>
		<div class="flex items-center gap-1">
			<div class="badge rating rating-sm opacity-90">
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
			<div class="dropdown dropdown-left">
				<button tabindex="0" class="btn btn-xs">
					<IconMenu size={14} />
				</button>
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<ul tabindex="0" class="shadow menu dropdown-content z-[1] bg-base-100 rounded-box">
					<li>
						<div class="tooltip text-left" data-tip="Mark bookmark as read">
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
											showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
												position: 'bottom-center'
											});
										}
									};
								}}
							>
								<input type="hidden" name="id" value={bookmark.id} />
								<label class="swap btn btn-circle">
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
						</div>
					</li>
					<li>
						<div class="tooltip text-left" data-tip="Flag bookmark">
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
											showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
												position: 'bottom-center'
											});
										}
									};
								}}
							>
								<input type="hidden" name="id" value={bookmark.id} />
								<label class="swap btn btn-circle">
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
					</li>
					<li>
						<div class="tooltip text-left" data-tip="Edit bookmark">
							<button on:click={onEditBookmark} tabindex="0" class="btn btn-circle">
								<IconPencil class="text-blue-700" />
							</button>
						</div>
					</li>
					<li>
						<div class="tooltip text-left" data-tip="Remove bookmark">
							<form
								method="POST"
								action="/?/deleteBookmark"
								use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') {
											showToast.success('Bookmark deleted', {
												position: 'bottom-center'
											});
											await applyAction(result);
										}

										invalidate('/');
									};
								}}
							>
								<input type="hidden" name="id" value={bookmark.id} />
								<button tabindex="0" class="btn btn-circle">
									<IconBackspace class="text-red-700" />
								</button>
							</form>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>
