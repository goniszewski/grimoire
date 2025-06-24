<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	let mounted = false;

	onMount(() => {
		mounted = true;
		// Auto-submit the form when the page loads
		const form = document.getElementById('logout-form') as HTMLFormElement;
		if (form) {
			form.requestSubmit();
		}
	});
</script>

<div class="mt-24 w-full">
	{#if mounted}
		<form id="logout-form" method="POST" use:enhance>
			<p>Logging out...</p>
		</form>
	{:else}
		<p>Loading...</p>
	{/if}
</div>
