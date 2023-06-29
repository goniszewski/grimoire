<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import BookmarkCard from '$lib/components/BookmarkCard/BookmarkCard.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
	import type { Category } from '$lib/interfaces/Category.interface';
	import type { PageData } from './$types';
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let pageData: PageData;
</script>

<div class="m-8">
	<div class="ml-auto w-fit">
		<AddBookmarkButton />
	</div>
	<AddBookmarkModal />
	<EditBookmarkModal />
	<BookmarkList />
	<!-- <BookmarkCard /> -->
</div>
