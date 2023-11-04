<script lang="ts">
	import { page } from '$app/stores';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import Icon from '$lib/components/Icon/Icon.svelte';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import type { Category } from '$lib/interfaces/Category.interface';
	import { editCategoryStore } from '$lib/stores/edit-category.store';

	let slug: string;
	let category: Category | undefined;
	let bookmarks: Bookmark[] = [];

	$: {
		slug = $page.params.slug;
		category = $page.data.categories.find((c) => c.slug === slug);
		bookmarks = $page.data.bookmarks.filter((b) => b.category.id === category?.id);
	}
</script>

{#if !category}
	<p>Category not found.</p>
{:else}
	<div class="flex flex-col gap-8 w-full">
		<div class="flex items-center gap-2">
			<h1 class="text-2xl">Category: {category?.name}</h1>
			{#if !category.icon}
				<div
					class="w-4 h-4 my-auto rounded-full"
					style={`background-color: ${category?.color || '#a0a0a0'};`}
				/>
			{:else}
				<Icon name={category.icon} size={16} color={category?.color} />
			{/if}
			<button
				class="link link-hover opacity-80 hover:opacity-10s px-2"
				on:click={() => {
					// @ts-ignore
					editCategoryStore.set(category);
				}}>Edit</button
			>
		</div>
		<div class="flex flex-col">
			<div class="flex gap-1">
				<strong>Parent:</strong>
				{#if category?.parent}
					<a href={`/categories/${category.parent.slug}`} class="link">{category.parent.name}</a>
				{:else}
					<em class="text-sm">No parent.</em>
				{/if}
			</div>
			<div class="flex gap-1">
				<strong>Public:</strong>
				{#if category?.public}
					<em class="text-sm">Yes</em>
				{:else}
					<em class="text-sm">No</em>
				{/if}
			</div>
			<div class="flex flex-col gap-1">
				<strong>Description</strong>
				<em class="text-sm">{category?.description}</em>
			</div>
		</div>

		{#if bookmarks.length > 0}
			<div class="flex flex-wrap gap-4">
				<BookmarkList {bookmarks} />
			</div>
		{:else}
			<p>No bookmarks yet.</p>
		{/if}
	</div>
{/if}
