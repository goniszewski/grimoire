<script lang="ts">
import { importBookmarkStore } from '$lib/stores/import-bookmarks.store';
import { type Readable } from 'svelte/store';
import BulkListItem from '../BulkListItem/BulkListItem.svelte';

export let itemList: Readable<BulkListItem[]>;
export let isLoading = false;

const selectAllItems = ({ target }: Event) => {
	if (target instanceof HTMLInputElement) {
		importBookmarkStore.setSelectStatusForAll(target.checked);
	}
};
</script>

<div class="flex flex-col gap-2">
	<div class="max-h-[calc(100vh-16rem)] overflow-x-auto">
		<table class="table table-pin-rows table-pin-cols table-xs">
			<!-- head -->
			<thead>
				<tr>
					<th>
						<label>
							<input type="checkbox" class="checkbox" on:change={selectAllItems} />
						</label>
					</th>
					<th>URL</th>
					<th>Title</th>
					<th>Category</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each $itemList as item (item.id)}
					<BulkListItem
						id={item.id}
						icon={item.icon}
						url={item.url}
						title={item.title}
						category={item.category}
						selected={item.selected}
						isLoading={item.isLoading}
						metadataFetched={!!item.contentHtml}
						metadata={item} />
				{/each}
			</tbody>
			<!-- foot -->
			<tfoot>
				<tr>
					<th></th>
					<th>Name</th>
					<th>Job</th>
					<th>Favorite Color</th>
					<th></th>
				</tr>
			</tfoot>
		</table>
	</div>
</div>
