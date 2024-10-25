<script lang="ts">
import { writable } from 'svelte/store';
import BulkListItem from '../BulkListItem/BulkListItem.svelte';

export let itemList = writable<BulkListItem[]>([]);

const isAnyItemSelected = writable(false);

$: $isAnyItemSelected = $itemList && $itemList.some((bookmark) => bookmark.selected);

const toggleItemSelection = (id: number) => {
	$itemList = $itemList.map((item) => {
		if (item.id === id) {
			item.selected = !item.selected;
		}
		return item;
	});
};
const selectAllItems = ({ target }: Event) => {
	if (target instanceof HTMLInputElement) {
		$itemList = $itemList.map((item) => {
			item.selected = target.checked;
			return item;
		});
	}
};

const removeSelectedItems = () => {
	$itemList = $itemList.filter((item) => !item.selected);
};
</script>

<div class="flex max-w-4xl flex-col gap-2">
	<div class="mb-2 flex w-full items-end justify-end">
		<button class="btn btn-primary" disabled={!$isAnyItemSelected} on:click={removeSelectedItems}
			>DELETE</button>
	</div>
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
				{#each $itemList as { id, icon, url, title, category, selected } (id)}
					<BulkListItem
						id={id}
						icon={icon}
						url={url}
						title={title}
						category={category}
						selected={selected}
						toggleItemSelection={toggleItemSelection} />
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
