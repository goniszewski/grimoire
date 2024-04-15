<script lang="ts">
	import type { Bookmark } from '$lib/types/Bookmark.type';

	import { applyAction, enhance } from '$app/forms';
	import { bookmarksStore } from '$lib/stores/bookmarks.store';
	import { editBookmarkStore } from '$lib/stores/edit-bookmark.store';
	import { searchEngine } from '$lib/stores/search.store';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import { removeBookmarkFromSearchIndex } from '$lib/utils/search';
	import { showToast } from '$lib/utils/show-toast';
	import {
		IconBookmark,
		IconBookmarkFilled,
		IconClipboardText,
		IconDots,
		IconExternalLink,
		IconEyeCheck,
		IconEyeClosed,
		IconPhotoX
	} from '@tabler/icons-svelte';

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
	class={`card relative mb-4 flex h-64 w-full min-w-[20rem] break-inside-avoid flex-col justify-between border border-base-100 bg-base-100 shadow-xl hover:border-secondary ${
		$userSettingsStore.uiAnimations
			? 'transition duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl'
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
			<div class="bg-base flex h-36 w-full items-center justify-center hover:bg-base-100">
				{#if ((!bookmark.main_image.endsWith('/') && bookmark.main_image) || bookmark.main_image_url) && !bookmark.screenshot.endsWith('/') && bookmark.screenshot}
					<img
						src={bookmark.main_image || bookmark.main_image_url}
						on:mouseover={(e) => (e.target.src = bookmark.screenshot)}
						on:mouseleave={(e) => (e.target.src = bookmark.main_image || bookmark.main_image_url)}
						on:focus={(e) => (e.target.src = bookmark.screenshot)}
						class="h-full w-full object-cover transition duration-300 ease-in-out"
						alt="Main"
					/>
				{:else if (bookmark.main_image && !bookmark.main_image.endsWith('/')) || bookmark.main_image_url}
					<img src={bookmark.main_image || bookmark.main_image_url} alt="Main" />
				{:else if bookmark.screenshot && !bookmark.screenshot.endsWith('/')}
					<img src={bookmark.screenshot} alt="Screenshot" />
				{:else}
					<IconPhotoX class="m-auto my-16" />
				{/if}
			</div>
		</div>
		<div
			class="badge-xl badge absolute left-1 top-1"
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
			<div class="badge rating rating-sm absolute bottom-1 left-1 opacity-90">
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
					checked={false}
					value="0"
					on:change={() => importanceForm.requestSubmit()}
				/>
			</div>
		</form>

		<div class="absolute bottom-1 right-1 flex scale-90 gap-1">
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
				<label class="btn btn-circle swap btn-xs p-4">
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
				<label class="btn btn-circle swap btn-xs p-4">
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
					<div class="flex w-full items-baseline gap-2">
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
							class="link-hover link card-title line-clamp-1 text-lg"
							on:click={(el) => {
								el.preventDefault();
								increaseOpenedTimesForm.requestSubmit();

								window.open(bookmark.url, '_self');
							}}>{bookmark.title}</a
						>
						<div class="ml-auto flex">
							<a
								href={bookmark.url}
								title="open in a new tab"
								target="_blank"
								class="btn btn-circle btn-ghost btn-xs"
								on:click={() => {
									increaseOpenedTimesForm.requestSubmit();
								}}
							>
								<IconExternalLink size={14} />
							</a>
							<button
								title="copy URL to clipboard"
								class="btn btn-circle btn-ghost btn-xs"
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
						<p class="line-clamp-2 text-sm font-light opacity-90">
							{bookmark.description}
						</p>
					{:else}
						<p class="text-sm font-light italic opacity-80">No description...</p>
					{/if}
				</div>
			</div>
			<div class="card-actions justify-end gap-1 px-2 font-medium tracking-tight">
				<span class="font-sans text-xs font-semibold">#</span>
				{#if bookmark.tags}
					{#each bookmark.tags as tag (tag.id)}
						<a href={`/tags/${tag.name}`} class="link font-sans text-xs">{tag.name}</a>
					{/each}
				{/if}
				<button title="Add new tag" class="link-hover link font-sans text-xs text-gray-400"
					>+</button
				>
			</div>
		</div>
		<div class="absolute right-1 top-1 flex items-center gap-1">
			<div class="tooltip tooltip-top" data-tip={bookmark.domain}>
				<div class="badge badge-ghost h-6 max-w-[8rem] justify-start truncate bg-opacity-75">
					{bookmark.domain}
				</div>
			</div>

			<div class="dropdown dropdown-end">
				<label for="options">
					<button tabindex="0" class="btn btn-circle btn-xs">
						<IconDots size={16} stroke={1.5} class="" />
					</button>
				</label>
				<ul class="menu dropdown-content z-[1] w-28 rounded-box bg-base-100 p-2 shadow">
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

										removeBookmarkFromSearchIndex($searchEngine, bookmark.id);
										bookmarksStore.remove(bookmark.id);
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
	</div>
</div>
