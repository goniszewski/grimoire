<style>
/* SvelteSelect styling fix */
:global(.this-select) {
	border: 0 !important;
	border-color: rgba(209, 213, 219, 0.5) !important;
	max-width: 10rem;
	background: oklch(var(--b1) / var(--tw-bg-opacity, 1)) !important;
}
:global(.svelte-select-list) {
	background-color: oklch(var(--b1) / var(--tw-bg-opacity, 1)) !important;
	box-shadow: 0 0 0 1px rgba(209, 213, 219, 0.5) !important;
}
:global(.svelte-select-list .list-item .item.hover) {
	background-color: oklch(var(--s) / var(--tw-bg-opacity, 1)) !important;
}
:global(.svelte-select .value-container .multi-item) {
	background-color: oklch(var(--nc)) !important;
}
:global(.svelte-select .value-container .multi-item .multi-item-clear svg) {
	color: oklch(var(--pc)) !important;
}
</style>

<script lang="ts">
import { enhance } from '$app/forms';
import { page } from '$app/stores';
import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
import AddCategoryModal from '$lib/components/AddCategoryModal/AddCategoryModal.svelte';
import CategoryTree from '$lib/components/CategoryTree/CategoryTree.svelte';
import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
import EditCategoryModal from '$lib/components/EditCategoryModal/EditCategoryModal.svelte';
import Footer from '$lib/components/Footer/Footer.svelte';
import ShowBookmarkModal from '$lib/components/ShowBookmarkModal/ShowBookmarkModal.svelte';
import ThemeSwitch from '$lib/components/ThemeSwitch/ThemeSwitch.svelte';
import { searchedValue } from '$lib/stores/search.store';
import type { Category } from '$lib/types/Category.type';
import { buildCategoryTree } from '$lib/utils/build-category-tree';
import { ToastNode } from '$lib/utils/show-toast';
import { IconMenu, IconX } from '@tabler/icons-svelte';
import { writable } from 'svelte/store';
import '../app.css';

const categoriesTree = writable<(Category & { children?: Category[] })[] | []>([]);
const user = $page.data.user;

$: {
	const categories = $page.data.categories;

	categoriesTree.set(buildCategoryTree(categories));
}
</script>

<div class="flex min-h-screen flex-col">
	<head>
		<title>Grimoire</title>
	</head>
	<div class="min-w-screen flex flex-1 flex-col">
		<div class="z-1 navbar">
			<div class="flex">
				<a href="/" class="btn btn-ghost text-xl normal-case">grimoire</a>
			</div>
			<div class="navbar-center flex-1">
				<div class="form-control join join-horizontal mx-auto flex w-10/12">
					<input
						type="text"
						placeholder="Search"
						bind:value={$searchedValue}
						class={`input input-bordered w-full ${$searchedValue ? 'rounded-r-none' : ''}`} />
					{#if $searchedValue}
						<button class="btn join-item" on:click={() => ($searchedValue = '')}>
							<IconX />
						</button>
					{/if}
				</div>
			</div>
			<div class="flex-none gap-2 md:mr-6">
				<ThemeSwitch user={user} />
				{#if !user}
					<ul class="menu menu-horizontal px-1">
						<li><a href="/signup">Sign up</a></li>
						<li><a href="/login">Login</a></li>
					</ul>
				{:else if user && user.isAdmin}
					<form method="POST" action="/logout" use:enhance>
						<button class="btn btn-outline btn-error btn-sm w-28">Log out admin</button>
					</form>
				{:else}
					<div class="dropdown dropdown-end z-10">
						<label for="avatar" tabindex="-1" class="avatar placeholder btn btn-circle btn-ghost">
							<div class="w-10 rounded-full bg-neutral text-neutral-content">
								<span> {user.name[0] || user.username[0]} </span>
							</div>
						</label>
						<ul
							tabindex="-1"
							class="menu dropdown-content menu-sm mt-3 w-auto gap-2 rounded-box bg-base-100 p-2 shadow">
							<li>
								<a href="/profile" class="justify-between">
									Profile
									<!-- <span class="badge">New</span> -->
								</a>
							</li>
							<li><a href="/settings">Settings</a></li>
							<form method="POST" action="/logout" use:enhance>
								<button class="btn btn-outline btn-error btn-sm w-24">Log out</button>
							</form>
						</ul>
					</div>
				{/if}
			</div>
		</div>
		<div class="z-2 mb-20 flex min-w-full flex-1 sm:mb-0">
			{#if user}
				<div class="drawer lg:drawer-open">
					<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
					<div class="justify-top drawer-content m-2 flex flex-1 flex-col items-center sm:m-8">
						<slot />
						<label
							for="my-drawer-2"
							class="btn btn-primary drawer-button fixed bottom-4 right-4 lg:hidden"
							><IconMenu /></label>
					</div>
					<div class="min-w-screen drawer-side min-h-full">
						<div class="flex h-14 flex-col items-end justify-center">
							{#if $page.url.pathname !== '/'}
								<a href="/" class="link">{'< Back to Home'}</a>
							{/if}
						</div>
						<label for="my-drawer-2" class="drawer-overlay" />
						<ul class="menu h-auto w-64 gap-4 rounded-r-xl bg-base-200 p-4 text-base-content">
							<!-- Sidebar content here -->
							<div>
								<div class="flex">
									<h3 class="text-xl">Categories</h3>
									<button
										class="link-hover link ml-auto opacity-50 hover:opacity-90"
										onclick="addCategoryModal.showModal()">➕</button>
								</div>
								<div class="flex flex-col p-2">
									<CategoryTree categories={$categoriesTree} />
								</div>
							</div>
							<div>
								<h3 class="text-xl">Tags</h3>
								<div class="flex flex-wrap p-2">
									{#each $page.data.tags as tag (tag.id)}
										{#if tag.bookmarks?.length > 0}
											<a href={`/tags/${tag.slug}`} class="link m-1 hover:text-secondary"
												>#{tag.name}</a>
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
				<div class="justify-top m-2 flex flex-1 flex-col items-center sm:m-8">
					<slot />
				</div>
			{/if}
		</div>
	</div>
	<Footer />
</div>
<!-- Modals -->
<AddBookmarkModal />
<EditBookmarkModal />
<ShowBookmarkModal />
<EditCategoryModal />
<AddCategoryModal />

<ToastNode
	toastOptions={{
		position: 'bottom-right'
	}} />
