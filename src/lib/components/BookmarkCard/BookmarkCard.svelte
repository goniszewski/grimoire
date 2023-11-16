<script lang="ts">
	import type { Bookmark } from '$lib/types/Bookmark.type';

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
	import { user } from '$lib/pb';

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
	class={`relative flex flex-col justify-between card w-full bg-base-100 shadow-xl mb-4 break-inside-avoid h-64 min-w-[20rem] border border-base-100 hover:border-secondary ${
		$user?.model?.settings?.uiAnimations
			? 'transition hover:-translate-y-1 duration-300 ease-in-out hover:shadow-2xl'
			: ''
	}`}
>
	<figure class="relative h-36">
		<div
			on:click={onShowBookmark}
			class="w-full hover:brightness-90"
			role="button"
			tabindex="0"
			on:keydown={onShowBookmark}
		>
			<div class="w-full h-36 flex items-center justify-center bg-base hover:bg-base-100">
				{#if (!bookmark.main_image.endsWith('/') && bookmark.main_image) || bookmark.main_image_url}
					<img src={bookmark.main_image || bookmark.main_image_url} alt="Main" />
				{:else}
					<IconPhotoX class="m-auto my-16" />
				{/if}
			</div>
		</div>
		<div
			class="badge badge-xl absolute top-1 left-1"
			style={`border-color: ${bookmark.category.color};`}
		>
			<span class="text-opacity-90" style={`_color: ${bookmark.category.color};`}
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
						showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
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
							showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
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
							showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
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
	<div>
		<div class="card-body p-2">
			<div class="h-20">
				<div class="flex flex-wrap items-baseline">
					<div class="flex items-baseline gap-2 w-full">
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
						<div class="flex ml-auto">
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
				<div class="tooltip text-left" data-tip={bookmark.description}>
					{#if bookmark.description}
						<p class="font-light text-sm opacity-90 line-clamp-2">
							{bookmark.description}
						</p>
					{:else}
						<p class="font-light text-sm opacity-80 italic">No description...</p>
					{/if}
				</div>
			</div>
			<div class="card-actions justify-end px-2 font-medium tracking-tight gap-1">
				<span class="font-sans font-semibold text-xs">#</span>
				{#if bookmark.tags}
					{#each bookmark.tags as tag}
						<a href={`/tags/${tag.name}`} class="link font-sans text-xs">{tag.name}</a>
					{/each}
				{/if}
				<button title="Add new tag" class="link link-hover font-sans text-xs text-gray-400"
					>+</button
				>
			</div>
		</div>
		<div class="absolute top-1 right-1 flex items-center gap-1">
			<div class="tooltip tooltip-top" data-tip={bookmark.domain}>
				<div class="badge badge-ghost bg-opacity-75 h-6 justify-start max-w-[8rem] truncate">
					{bookmark.domain}
				</div>
			</div>

			<div class="dropdown dropdown-end">
				<label for="options">
					<button tabindex="0" class="btn btn-circle btn-xs">
						<IconDots size={16} stroke={1.5} class="" />
					</button>
				</label>
				<ul class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-28">
					<!-- <li> -->
					<!-- <button type="button" class="btn btn-xs btn-ghost" on:click={onEditBookmark} tabindex="0"
					>Edit</button> -->
					<!-- </li> -->
					<li>
						<button on:click={onEditBookmark} tabindex="0">Edit</button>
					</li>
					<li>
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
							<button tabindex="0" class="text"> Remove </button>
						</form>
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>
