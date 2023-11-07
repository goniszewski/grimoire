<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { page } from '$app/stores';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import CategoryTree from '$lib/components/CategoryTree/CategoryTree.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
	import EditCategoryModal from '$lib/components/EditCategoryModal/EditCategoryModal.svelte';
	import ShowBookmarkModal from '$lib/components/ShowBookmarkModal/ShowBookmarkModal.svelte';
	import type { Category } from '$lib/interfaces/Category.interface';
	import { user } from '$lib/pb';
	import { searchedValue } from '$lib/stores/search.store';
	import { IconMenu, IconX } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import '../app.css';
	import AddCategoryModal from '$lib/components/AddCategoryModal/AddCategoryModal.svelte';
	import { ToastNode } from '$lib/utils/show-toast';

	onMount(async () => {
		user.loadFromCookie(document.cookie);
	});

	const categoriesTree = writable<(Category & { children?: Category[] })[] | []>([]);

	$: {
		const categories = $page.data.categories;
		const categoriesTreeData = categories
			.filter((c) => !c.parent)
			.map((c) => ({
				...c,
				children: categories
					.filter((c2) => c2.parent?.id === c.id)
					.map((c2) => ({
						...c2
					}))
			}));
		categoriesTree.set(categoriesTreeData);
	}
</script>

<div class="flex flex-col min-h-screen">
	<head>
		<title>Grimoire</title>
	</head>
	<div class="flex flex-col min-w-screen flex-1">
		<div class="navbar bg-base-100 z-1">
			<div class="flex">
				<a href="/" class="btn btn-ghost normal-case text-xl">grimoire</a>
			</div>
			<div class="navbar-center flex-1">
				<div class="form-control flex mx-auto w-10/12 join join-horizontal">
					<input
						type="text"
						placeholder="Search"
						bind:value={$searchedValue}
						class={`input input-bordered w-full ${$searchedValue ? 'rounded-r-none' : ''}`}
					/>
					{#if $searchedValue}
						<button class="btn join-item" on:click={() => ($searchedValue = '')}>
							<IconX />
						</button>
					{/if}
				</div>
			</div>
			<div class="flex-none mr-6">
				{#if !user}
					<ul class="menu menu-horizontal px-1">
						<li><a href="/signup">Sign up</a></li>
						<li><a href="/login">Login</a></li>
					</ul>
				{:else if user.isValid && user.isAdmin}
					<form
						method="POST"
						action="/logout"
						use:enhance={() => {
							return async ({ result }) => {
								user.clear();
								await applyAction(result);
							};
						}}
					>
						<button class="btn btn-sm btn-outline btn-error w-28">Log out admin</button>
					</form>
				{:else}
					<div class="dropdown dropdown-end z-10">
						<label for="avatar" tabindex="-1" class="btn btn-ghost btn-circle avatar placeholder">
							<div class="bg-neutral-focus text-neutral-content rounded-full w-10">
								<span> {user.model?.name[0]} </span>
							</div>
						</label>
						<ul
							tabindex="-1"
							class="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-auto gap-2"
						>
							<li>
								<a href="/profile" class="justify-between">
									Profile
									<!-- <span class="badge">New</span> -->
								</a>
							</li>
							<li><a>Settings</a></li>
							<form
								method="POST"
								action="/logout"
								use:enhance={() => {
									return async ({ result }) => {
										user.clear();
										await applyAction(result);
									};
								}}
							>
								<button class="btn btn-sm btn-outline btn-error w-24">Log out</button>
							</form>
						</ul>
					</div>
				{/if}
			</div>
		</div>
		<div class="flex flex-1 min-w-full z-2 mb-20 sm:mb-0">
			{#if user && !user.isAdmin}
				<div class="drawer lg:drawer-open">
					<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
					<div class="drawer-content flex flex-1 flex-col items-center justify-top m-2 sm:m-8">
						<slot />
						<label
							for="my-drawer-2"
							class="btn btn-primary drawer-button lg:hidden fixed bottom-4 right-4"
							><IconMenu /></label
						>
					</div>
					<div class="drawer-side min-w-screen min-h-full">
						<!-- allign items in center vertically and horizontally -->
						<div class="flex flex-col items-end justify-center h-14">
							{#if $page.url.pathname !== '/'}
								<a href="/" class="link">{'< Back to Home'}</a>
							{/if}
						</div>
						<label for="my-drawer-2" class="drawer-overlay" />
						<ul class="menu p-4 w-64 h-auto bg-slate-100 text-base-content rounded-r-xl gap-4">
							<!-- Sidebar content here -->
							<!-- <li><a>Sidebar Item 1</a></li>
					<li><a>Sidebar Item 2</a></li> -->
							<div>
								<div class="flex">
									<h3 class="text-xl">Categories</h3>
									<!-- @ts-ignore -->
									<button
										class="link link-hover opacity-50 hover:opacity-90 ml-auto"
										onclick="addCategoryModal.showModal()">➕</button
									>
								</div>
								<div class="flex flex-col p-2">
									<CategoryTree categories={$categoriesTree} />
								</div>
							</div>
							<div>
								<h3 class="text-xl">Tags</h3>
								<div class="flex flex-wrap p-2">
									{#each $page.data.tags as tag}
										{#if tag.bookmarks.length > 0}
											<a href={`/tags/${tag.slug}`} class="link m-1">#{tag.name}</a>
										{/if}
									{/each}
								</div>
							</div>
							<div>
								<h3 class="text-xl">Flows</h3>
								<div class="flex flex-wrap p-2">To be added.</div>
							</div>
						</ul>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 flex-col items-center justify-top m-2 sm:m-8">
					<slot />
				</div>
			{/if}
		</div>
	</div>
</div>
<!-- Modals -->
<AddBookmarkModal />
<EditBookmarkModal />
<ShowBookmarkModal />
<EditCategoryModal />
<AddCategoryModal />

<ToastNode />
