<script lang="ts">
	import '../app.css';
	import { currentUser, pb } from '$lib/pb';
	import { applyAction, enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { IconMenu } from '@tabler/icons-svelte';

	onMount(async () => {
		pb.authStore.loadFromCookie(document.cookie);
	});
</script>

<head>
	<title>Grimoire</title>
</head>
<div class="navbar bg-base-100 z-10">
	<div class="flex">
		<a href="/" class="btn btn-ghost normal-case text-xl">grimoire</a>
	</div>
	<div class="navbar-center flex-1">
		<div class="form-control flex mx-auto w-10/12">
			<input type="text" placeholder="Search" class="input input-bordered w-full" />
		</div>
	</div>
	<div class="flex-none">
		{#if !$currentUser}
			<ul class="menu menu-horizontal px-1">
				<li><a href="/signup">Sign up</a></li>
				<li><a href="/login">Login</a></li>
			</ul>
		{:else}
			<div class="dropdown dropdown-end z-10">
				<label for="avatar" tabindex="-1" class="btn btn-ghost btn-circle avatar placeholder">
					<div class="bg-neutral-focus text-neutral-content rounded-full w-10">
						<span> {$currentUser.name[0]} </span>
					</div>
				</label>
				<ul
					tabindex="-1"
					class="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-auto gap-2"
				>
					<li>
						<a href="/" class="justify-between">
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
								pb.authStore.clear();
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
<div class="flex">
	<div class="drawer lg:drawer-open">
		<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
		<div class="drawer-content flex flex-col items-center justify-top m-2 sm:m-8">
			<slot />

			<label
				for="my-drawer-2"
				class="btn btn-primary drawer-button lg:hidden sticky bottom-4 ml-auto mr-4"
				><IconMenu /></label
			>
		</div>
		{#if $currentUser}
			<div class="drawer-side mt-4 w-screen h-max">
				<label for="my-drawer-2" class="drawer-overlay" />
				<ul class="menu p-4 w-64 h-full bg-slate-100 text-base-content rounded-r-xl mt-8 gap-4">
					<!-- Sidebar content here -->
					<!-- <li><a>Sidebar Item 1</a></li>
				<li><a>Sidebar Item 2</a></li> -->
					<div>
						<h3 class="text-xl">Categories</h3>
						<div class="flex flex-col p-2">
							{#each $page.data.categories as category}
								<div class="flex">
									<div
										class="w-4 h-4 mx-1 my-auto rounded-full"
										style={`background-color: ${category?.color || '#a0a0a0'};`}
									/>
									<a href={`/categories/${category.slug}`} class="link m-1">{category.name}</a>
								</div>
							{/each}
						</div>
					</div>
					<div>
						<h3 class="text-xl">Tags</h3>
						<div class="flex flex-wrap p-2">
							{#each $page.data.tags as tag}
								<a href={`/tags/${tag.slug}`} class="link m-1">#{tag.name}</a>
							{/each}
						</div>
					</div>
				</ul>
			</div>
		{/if}
	</div>
</div>
