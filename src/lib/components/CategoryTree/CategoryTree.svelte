<script lang="ts">
	import Icon from '$lib/components/Icon/Icon.svelte';
	import type { Category } from '$lib/types/Category.type';
	import CategoryTreeItem from '../CategoryTreeItem/CategoryTreeItem.svelte';

	// CategoryWithChildren type is a recursive type that includes the children property
	type CategoryWithChildren = Category & { children?: CategoryWithChildren[] };

	export let categories: CategoryWithChildren[] | [] = [];
</script>

{#each categories as category (category.id)}
	<div class="flex flex-col">
		<div class="flex items-center">
			{#if !category.icon}
				<div
					class="my-auto h-4 w-4 rounded-full"
					style={`background-color: ${category?.color || '#a0a0a0'};`}
				/>
			{:else}
				<Icon name={category.icon} size={16} color={category?.color} />
			{/if}
			<a href={`/categories/${category.slug}`} class="link m-1 hover:text-primary"
				>{category.name}</a
			>
		</div>

		{#if category.children}
			{#each category.children as child (child.id)}
				<CategoryTreeItem children={category.children} {...child} />
			{/each}
		{/if}
	</div>
{/each}
