<script lang="ts">
import { importBookmarkStore } from '$lib/stores/import-bookmarks.store';
import { type Readable } from 'svelte/store';
import BulkListItem from '../BulkListItem/BulkListItem.svelte';
import type { BookmarkEdit } from '$lib/types/Bookmark.type';

export let itemList: Readable<BookmarkEdit[]>;
export let isLoading: boolean;

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
						isLoading={isLoading}
						metadataFetched={!!item.domain}
						metadata={item} />
				{/each}
			</tbody>
			<!-- foot -->
			<tfoot>
				<tr>
					<th></th>
					<th>URL</th>
					<th>Title</th>
					<th>Category</th>
					<th></th>
				</tr>
			</tfoot>
		</table>
	</div>
</div>
