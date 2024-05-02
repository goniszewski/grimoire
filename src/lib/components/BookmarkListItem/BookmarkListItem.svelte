<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { bookmarksStore } from '$lib/stores/bookmarks.store';
	import { editBookmarkStore } from '$lib/stores/edit-bookmark.store';
	import { searchEngine } from '$lib/stores/search.store';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import type { Bookmark } from '$lib/types/Bookmark.type';
	import { checkIfImageURL } from '$lib/utils/check-if-image-url';
	import { removeBookmarkFromSearchIndex } from '$lib/utils/search';
	import { showToast } from '$lib/utils/show-toast';
	import {
		IconBackspace,
		IconBookmark,
		IconBookmarkFilled,
		IconClipboardText,
		IconExternalLink,
		IconEyeCheck,
		IconEyeClosed,
		IconMenu,
		IconPencil
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
	class={`flex min-h-[6rem] flex-col justify-between gap-1 rounded-md border border-base-content border-opacity-20 p-2 hover:border-secondary  ${
		$userSettingsStore.uiAnimations
			? 'transition duration-300 ease-in-out hover:-translate-x-1'
			: ''
	}`}
>
	<div class="flex">
		<div class="flex items-center justify-between gap-1">
			<div class="flex items-center gap-1">
				{#if bookmark.icon || (bookmark.icon_url && checkIfImageURL(bookmark.icon_url))}
					<img
						src={bookmark.icon || bookmark.icon_url}
						alt={`${bookmark.domain}'s favicon`}
						class="avatar h-4 w-4 rounded-sm"
					/>
				{/if}
				<div class="tooltip text-left" data-tip="open in current tab">
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
						class="link-hover link line-clamp-1 text-sm"
						on:click={(el) => {
							el.preventDefault();
							increaseOpenedTimesForm.requestSubmit();

							window.open(bookmark.url, '_self');
						}}>{bookmark.title}</a
					>
				</div>
				<div class="flex">
					<div class="tooltip text-left" data-tip="open in new tab">
						<a
							href={bookmark.url}
							title="open in a new tab"
							target="_blank"
							class=" btn btn-circle btn-ghost btn-xs"
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
		</div>
		<div class="badge badge-ghost ml-auto line-clamp-1 h-6 max-w-[8rem] bg-opacity-75 md:max-w-fit">
			{bookmark.domain.split('.').slice(-2).join('.')}
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
				<p class="line-clamp-2 w-full text-sm font-light opacity-90 md:w-10/12">
					{bookmark.description}
				</p>
			{:else}
				<p class="text-sm font-light italic opacity-80">No description...</p>
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
					class="w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-opacity-90"
					style={`_color: ${bookmark.category.color};`}>{bookmark.category.name}</span
				>
			</a>
			<div class="flex w-full gap-1">
				<span class="font-sans text-xs font-semibold">#</span>
				{#if bookmark.tags}
					{#each bookmark.tags as tag (tag.id)}
						<a
							href={`/tags/${tag.slug}`}
							class="link w-full max-w-[8rem] whitespace-nowrap font-sans text-xs hover:text-secondary"
							>{tag.name}</a
						>
					{/each}
				{/if}
				<button title="Add new tag" class="link-hover link font-sans text-xs text-gray-400"
					>+</button
				>
			</div>
		</div>
		<div class="flex items-center gap-1">
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
				<div class="badge rating rating-sm opacity-90">
					<input type="hidden" name="id" value={bookmark.id} />
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
			<div class="dropdown dropdown-left">
				<button tabindex="0" class="btn btn-xs">
					<IconMenu size={14} />
				</button>
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<ul tabindex="0" class="menu dropdown-content z-[1] rounded-box bg-base-100 shadow">
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
								<label class="btn btn-circle swap">
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
								<label class="btn btn-circle swap">
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

											removeBookmarkFromSearchIndex($searchEngine, bookmark.id);
											bookmarksStore.remove(bookmark.id);
										}
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
