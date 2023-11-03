<script lang="ts">
	import { icons } from '$lib/enums/icons';

	export let name: string;
	export let color: string = '#a0a0a0';
	export let size: number = 18;
</script>

<svelte:component this={icons.find((i) => i.id === name)?.icon} {size} {color} />
