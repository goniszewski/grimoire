<script lang="ts">
	import { editCategoryStore } from '$lib/stores/edit-category.store';
	import Icon from '$lib/components/Icon/Icon.svelte';
	import type { Category } from '$lib/interfaces/Category.interface';

	export let categories: (Category & { children?: Category[] })[] | [] = [];
</script>

{#each categories as category}
	<div class="flex flex-col">
		<div class="flex items-center">
			{#if !category.icon}
				<div
					class="w-4 h-4 my-auto rounded-full"
					style={`background-color: ${category?.color || '#a0a0a0'};`}
				/>
			{:else}
				<Icon name={category.icon} size={16} color={category?.color} />
			{/if}
			<a href={`/categories/${category.slug}`} class="link m-1">{category.name}</a>
		</div>

		{#if category.children}
			{#each category.children as categoryChild}
				<div class="flex items-center ml-4">
					{#if !categoryChild.icon}
						<div
							class="w-4 h-4 my-auto rounded-full"
							style={`background-color: ${categoryChild?.color || '#a0a0a0'};`}
						/>
					{:else}
						<Icon name={categoryChild.icon} size={16} color={categoryChild?.color} />
					{/if}
					<a href={`/categories/${categoryChild.slug}`} class="link m-1">{categoryChild.name}</a>
				</div>
			{/each}
		{/if}
	</div>
{/each}
