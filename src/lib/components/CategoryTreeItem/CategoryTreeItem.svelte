<script lang="ts">
	import type { Category } from '$lib/types/Category.type';
	import Icon from '../Icon/Icon.svelte';

	export let nestedTimes = 0;
	export let children = [] as Category[];
	export let name = '';
	export let icon = null as string | null;
	export let slug = '';
	export let color = '';
</script>

<div class="flex items-center" style={`margin-left: ${nestedTimes + 1}rem;`}>
	{#if !icon}
		<div class="my-auto h-4 w-4 rounded-full" style={`background-color: ${color || '#a0a0a0'};`} />
	{:else}
		<Icon name={icon} size={16} {color} />
	{/if}
	<a href={`/categories/${slug}`} class="link m-1 hover:text-primary">{name}</a>
</div>

{#each children as child}
	<svelte:self nestedTimes={nestedTimes + 1} {...child} />
{/each}
