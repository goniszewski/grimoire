<script lang="ts">
	import Select from 'svelte-select';
	import { debounce } from 'lodash';
	import { enhance } from '$app/forms';
	import { writable, type Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import toast, { Toaster } from 'svelte-french-toast';

	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import { showBookmarkStore } from '$lib/stores/show-bookmark.store';

	export let closeModal: () => void;

	let error = '';
	const loading = writable(false);
	const bookmark = writable<Partial<Bookmark>>({});

	$: $bookmark = { ...$showBookmarkStore };

	const bookmarkTagsInput: Writable<
		| {
				value: string;
				label: string;
				created?: boolean;
		  }[]
		| null
	> = writable(null);

	$: $bookmarkTagsInput = $bookmark.tags?.map((t) => ({ value: t.id, label: t.name })) || null;

	const bookmarkTags = writable<
		{
			value: string;
			label: string;
			created?: boolean;
		}[]
	>([...$page.data.tags.map((t) => ({ value: t.id, label: t.name }))]);
</script>

{#if $bookmark?.id}
	<h2>
		{$bookmark.title}
	</h2>
	<Toaster />
{/if}
