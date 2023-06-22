<script>
	import '../app.css';
	import { currentUser, pb } from '$lib/pb';
	import { applyAction, enhance } from '$app/forms';
</script>

<div class="navbar bg-base-100 z-10">
	<div class="flex">
		<a class="btn btn-ghost normal-case text-xl">grimoire</a>
	</div>
	<div class="navbar-center flex-1">
		<div
			class="form-control
            hidden md:flex mx-auto
            w-10/12
        "
		>
			<input type="text" placeholder="Search" class="input input-bordered w-24 md:w-full" />
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
				<label tabindex="0" class="btn btn-ghost btn-circle avatar placeholder">
					<div class="bg-neutral-focus text-neutral-content rounded-full w-10">
						<span> {$currentUser.name[0]} </span>
					</div>
				</label>
				<ul
					tabindex="0"
					class="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-auto gap-2"
				>
					<li>
						<a class="justify-between">
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
<slot />
