<script lang="ts">
	import { page } from '$app/stores';
</script>

{#if $page.error}
	<div class="h-full w-full flex flex-col align-top items-center gap-20">
		<h1 class="text-4xl font-bold text-center">Incantation failed :(</h1>
		<div class="flex items-center w-max">
			<div class="text-6xl md:mr-6">🧙 🪄</div>
			<div class="mockup-browser border border-base-300 max-w-[12rem] sm:max-w-xs md:max-w-sm">
				<div class="mockup-browser-toolbar">
					<div class="input border border-base-300">grimoire error</div>
				</div>
				<div class="flex justify-center px-4 py-16 border-t border-base-300">
					<span class="text-6xl font-bold text-center text-base-300">💥</span>
				</div>
			</div>
		</div>
		<div class="w-fit mx-auto p-4">
			<h2 class="text-2xl">Error message:</h2>
			<code class="text-xl">
				{$page.error.message}
			</code>
		</div>
	</div>
{/if}
