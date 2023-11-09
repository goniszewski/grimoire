<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { user } from '$lib/pb';
</script>

<div class="w-full mt-24">
	<div class="form-control mx-auto max-w-xs gap-4">
		<form
			method="POST"
			class="card"
			use:enhance={() => {
				return async ({ result }) => {
					// $user.loadFromCookie(document.cookie);
					await applyAction(result);
				};
			}}
		>
			<div>
				<label class="label">
					<span class="label-text">Username</span>
				</label>
				<input
					type="text"
					name="username"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label">
					<span class="label-text">Display name</span>
				</label>
				<input
					type="text"
					name="name"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label">
					<span class="label-text">Email</span>
				</label>
				<input
					type="email"
					name="email"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label">
					<span class="label-text">Password</span>
				</label>
				<input
					type="password"
					name="password"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label">
					<span class="label-text">Repeat password</span>
				</label>
				<input
					type="password"
					name="passwordConfirm"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<button class="btn btn-primary">Sign up</button>
		</form>
	</div>
</div>
