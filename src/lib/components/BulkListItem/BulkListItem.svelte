<script lang="ts">
import { IconPhotoX } from '@tabler/icons-svelte';

export let id: number;
export let selected = false;
export let icon: string;
export let url: string;
export let title: string;
export let category: string;
export let toggleItemSelection: (id: number) => void;

let urlObj = new URL(url);
</script>

<tr>
	<th>
		<label>
			<input
				type="checkbox"
				class="checkbox"
				bind:checked={selected}
				on:change={() => toggleItemSelection(id)} />
		</label>
	</th>
	<td>
		<div class="flex items-center gap-3">
			<div class="avatar">
				<div class="mask mask-squircle h-12 w-12">
					{#if icon}
						<img src={icon} alt="Avatar Tailwind CSS Component" />
					{:else}
						<IconPhotoX class="m-2 h-8 w-8 opacity-80" />
					{/if}
				</div>
			</div>
			<div class="max-w-lg">
				<div class="tooltip" data-tip={url}>
					<a href={url} target="_blank" class="font-bold">
						{urlObj.pathname !== '/'
							? `${urlObj.hostname}/.../${urlObj.pathname.slice(-5)}`
							: urlObj.hostname}
					</a>
				</div>
				<div class="text-sm tracking-tight opacity-50">
					{new URL(url).hostname}
				</div>
			</div>
		</div>
	</td>
	<td class="max-w-xs">
		<div class="tooltip" data-tip={title}>
			<span title={title} class="line-clamp-2">{title}</span>
		</div>
	</td>
	<td><span class="link hover:link-secondary">{category}</span></td>
	<th>
		<button class="btn btn-ghost btn-xs text-secondary">edit</button>
		<button class="btn btn-ghost btn-xs text-error">remove</button>
	</th>
</tr>
