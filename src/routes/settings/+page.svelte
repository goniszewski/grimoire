<script lang="ts">
	import { user } from '$lib/pb';
</script>

<div class="w-full">
	{#if !$user || !$user.isValid}
		<p>Not logged in</p>
	{:else}
		<h1 class="text-2xl font-bold">Settings</h1>
		<div class="flex flex-col border rounded-sm">
			LLM enabled: <span class="font-bold">{JSON.stringify($user.model.settings?.llm.enabled)}</span
			>
			LLM provider:
			<span class="font-bold">{JSON.stringify($user.model.settings?.llm.provider)}</span>
		</div>
	{/if}
</div>
