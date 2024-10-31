<script lang="ts">
import type { Readable } from 'svelte/store';

export let page: number = 1;
export let limit: number = 20;
export let items: number | Readable<number> = 0;
export let position: 'left' | 'center' | 'right' = 'center';

let itemsCount: number;

$: {
	// NOTE: We need to subscribe to the changes so it stays reactive
	if (typeof items === 'object' && 'subscribe' in items) {
		items.subscribe((value) => {
			itemsCount = value;
		});
	} else {
		itemsCount = items;
	}
}

$: pagesCount = Math.ceil(itemsCount / limit);

function handlePageChange() {
	window.location.search = `?page=${page}&limit=${limit}`;
}

function getMarginPosition() {
	switch (position) {
		case 'left':
			return 'mr-auto';
		case 'center':
			return 'mx-auto';
		case 'right':
			return 'ml-auto';
		default:
			return 'mx-auto';
	}
}

const limitOptions = [10, 20, 50, 100];
</script>

<div class={`mt-8 flex gap-2 ${getMarginPosition()}`}>
	<div class="tooltip" data-tip="Select page">
		<div class="join">
			{#if pagesCount > 0}
				{#each Array(pagesCount) as _, i}
					<button
						title={`Go to page ${i + 1}`}
						class={`btn join-item btn-md ${page === i + 1 ? 'btn-active' : ''}`}
						on:click={() => {
							page = i + 1;
							handlePageChange();
						}}>{i + 1}</button>
				{/each}
			{/if}
		</div>
	</div>
	<div class="tooltip" data-tip="Items per page">
		<select
			class="select select-bordered w-full max-w-xs"
			on:change={(event) => {
				if (event.target instanceof HTMLSelectElement) {
					limit = parseInt(event.target?.value);
					handlePageChange();
				}
			}}>
			{#each limitOptions as option}
				<option value={option} selected={option === limit}>{option}</option>
			{/each}
		</select>
	</div>
</div>
