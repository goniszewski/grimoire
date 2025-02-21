<script lang="ts">
import { page } from '$app/stores';
const user = $page.data.user;
</script>

{#if !user}
	<p>Not logged in.</p>
{:else}
	<div class="container mx-auto p-4">
		<div class="flex flex-col gap-4">
			<h1 class="text-2xl font-bold">Import Bookmarks</h1>
			<div role="alert" class="alert alert-warning">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<span
					><strong>Be aware:</strong> this feature is in early development and may
					<strong>break</strong> things.</span>
			</div>
			<p>Choose a method to import your bookmarks:</p>
		</div>
		<div class="rounded-smp-4 mx-auto mt-8 flex max-w-lg flex-wrap justify-center gap-4">
			<a href="/import/html" class="btn btn-primary w-[calc(50%-0.5rem)]"> HTML bookmark file</a>
		</div>
	</div>
{/if}
