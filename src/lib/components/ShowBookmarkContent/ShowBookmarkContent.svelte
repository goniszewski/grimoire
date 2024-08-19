<script lang="ts">
	import { writable, type Writable } from 'svelte/store';

	import { editBookmarkStore } from '$lib/stores/edit-bookmark.store';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';
	import type { Bookmark } from '$lib/types/Bookmark.type';

	export let closeModal: () => void;
	let contentTab = writable<'text' | 'html'>('html');

	function onEditBookmark() {
		closeModal();
		editBookmarkStore.set($bookmark);
	}
	const bookmark = writable<Bookmark>();

	const bookmarkTagsInput: Writable<
		| {
				value: number;
				label: string;
				created?: boolean;
		  }[]
		| null
	> = writable(null);

	let mainImage: string;
	let screenshot: string;

	$: {
		if ($bookmark.mainImage) {
			mainImage = $bookmark.mainImage;
		} else if ($bookmark.mainImageUrl) {
			mainImage = $bookmark.mainImageUrl;
		}

		if ($bookmark.screenshot) {
			screenshot = $bookmark.screenshot;
		}
	}

	$: $bookmark = { ...$showBookmarkStore };
	$: $bookmarkTagsInput = $bookmark.tags?.map((t) => ({ value: t.id, label: t.name })) || null;
</script>

<div class="flex max-w-5xl flex-col gap-8">
	<button class="btn btn-link btn-sm absolute right-8 top-8" on:click={onEditBookmark} tabindex="0"
		>Edit</button
	>
	<div class="flex justify-between gap-2">
		<h1 class="text-2xl">
			{$bookmark.title}
		</h1>
	</div>
	<div class="flex flex-col gap-4 lg:flex-row">
		{#if $bookmark?.id}
			<div class="flex flex-col gap-2">
				<div class="flex flex-col gap-2 md:flex-row">
					<div class="flex min-w-fit flex-1 flex-col gap-2">
						<div class="flex items-center gap-2">
							{#if $bookmark.icon || $bookmark.iconUrl}
								<img src={$bookmark.icon || $bookmark.iconUrl} alt="Icon" class="h-8 w-8" />
							{/if}
							<p class="badge badge-ghost">{$bookmark.domain}</p>
						</div>
						{#if mainImage || screenshot}
							<div
								class="carousel carousel-center mx-auto h-72 max-w-md space-x-4 rounded-box bg-neutral p-1"
							>
								{#if mainImage}
									<div id="main-image" class="carousel-item w-full">
										<a
											href={$bookmark.mainImage || $bookmark.mainImageUrl}
											target="_blank"
											class="flex w-full"
										>
											<img
												src={$bookmark.mainImage || $bookmark.mainImageUrl}
												class="w-full justify-self-center object-scale-down"
												alt="Main"
											/>
										</a>
									</div>
								{/if}
								{#if screenshot}
									<div id="screenshot" class="carousel-item w-full">
										<a href={$bookmark.screenshot} target="_blank" class="flex w-full">
											<img
												src={$bookmark.screenshot}
												class="w-full justify-self-center object-scale-down"
												alt="Screenshot"
											/>
										</a>
									</div>
								{/if}
							</div>
						{/if}
						{#if ($bookmark.mainImage || $bookmark.mainImage) && $bookmark.screenshot}
							<div class="flex w-full justify-center gap-2 py-2">
								<a href="#main-image" class="btn btn-xs">Main image</a>
								<a href="#screenshot" class="btn btn-xs">Screenshot</a>
							</div>
						{/if}
						<div>
							<h3 class="text-xl">Tags</h3>
							<div class="m-1 flex flex-wrap gap-2">
								{#if $bookmark.tags?.length}
									{#each $bookmark.tags as tag (tag.id)}
										<span class="badge badge-outline badge-sm whitespace-nowrap">{tag.name}</span>
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
										class="rating-hidden rating-sm"
										checked={!$bookmark.importance}
										value="0"
										disabled
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 cursor-default bg-orange-400"
										checked={$bookmark.importance === 1}
										value="1"
										disabled
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 cursor-default bg-orange-400"
										checked={$bookmark.importance === 2}
										value="2"
										disabled
									/>
									<input
										type="radio"
										name="importance"
										class="mask mask-star-2 cursor-default bg-orange-400"
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
									$bookmark.openedLast ? new Date($bookmark.openedLast).toLocaleString() : ''
								}`}
							>
								<b> Opened: </b>
								{$bookmark.openedTimes || 0} times
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
				</div>

				<div>
					<h3 class="text-xl">Description</h3>
					<p class="max-w-xs break-words lg:max-w-xl">
						{$bookmark.description}
					</p>
				</div>
				<div>
					{#if $bookmark.author}
						<span>
							<b> By: </b>
							{$bookmark.author || 'Unknown'}
						</span>
					{/if}
					{#if $bookmark.contentPublishedDate}
						<span>
							<b> Published on: </b>
							{$bookmark.contentPublishedDate
								? new Date($bookmark.contentPublishedDate).toLocaleString()
								: ''}
						</span>
					{/if}
				</div>
			</div>
			<div class="flex w-full min-w-[20rem] flex-col gap-4">
				<h3 class="text-xl">Content</h3>
				<div class="flex flex-col">
					<div class="tabs tabs-bordered min-w-full">
						<div
							class={`tab ${$contentTab === 'html' ? 'tab-active' : 'text-gray-500'}`}
							on:click={() => ($contentTab = 'html')}
							on:keydown={() => ($contentTab = 'html')}
							role="tab"
							tabindex="0"
						>
							HTML
						</div>
						<div
							class={`tab ${$contentTab === 'text' ? 'tab-active' : 'text-gray-500'}`}
							on:click={() => ($contentTab = 'text')}
							on:keydown={() => ($contentTab = 'text')}
							role="tab"
							tabindex="0"
						>
							Text
						</div>
					</div>
					<div
						class={`flex w-full flex-col overflow-y-scroll rounded-b-sm border border-t-0 border-gray-500 pl-1 pt-1 ${
							$bookmark.contentHtml || $bookmark.contentText ? 'h-60 ' : 'justify-items-center   '
						}`}
					>
						{#if $contentTab === 'html' && $bookmark.contentHtml}
							{@html $bookmark.contentHtml}
						{:else if $contentTab === 'text' && $bookmark.contentText}
							{$bookmark.contentText}
						{:else}
							<div class="w-fit px-4 py-2 text-gray-500">No content</div>
						{/if}
					</div>
				</div>

				<div>
					<h3 class="text-xl">Note</h3>
					<p class={`overflow-y-scroll ${$bookmark.note ? 'h-14' : 'm-2 text-gray-500 '}`}>
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
