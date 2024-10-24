<script lang="ts">
import { applyAction, enhance } from '$app/forms';
import { page } from '$app/stores';

interface FormErrors {
	invalid?: boolean;
	username?: { message: string };
	name?: { message: string };
	email?: { message: string };
	password?: { message: string };
	passwordConfirm?: { message: string };
	data?: {
		username?: string;
		name?: string;
		email?: string;
	};
}

export let form: FormErrors | null;
</script>

<div class="mt-24 w-full">
	{#if $page.data.signupDisabled}
		<div class="mx-auto flex flex-col items-center justify-center gap-4 p-4">
			<h1 class="text-2xl font-bold">Sign up</h1>
			<p class="text-gray-500">
				Sign up is currently disabled. Please contact the administrator if you want to sign up.
			</p>
		</div>
	{:else}
		<form
			method="POST"
			use:enhance={() => {
				return async ({ result }) => {
					await applyAction(result);
					console.log('signup', result);
				};
			}}>
			<div class="form-control mx-auto max-w-xs gap-4">
				<div>
					<label class="label" for="name">
						<span class="label-text">Display name</span>
					</label>
					<input
						type="text"
						name="name"
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							form?.invalid && form?.name ? 'input-error' : ''
						}`} />
					{#if form?.invalid && form?.name}
						<p class="text-error">
							{form?.invalid ? form?.name.message : 'Invalid display name.'}
						</p>
					{/if}
				</div>
				<div>
					<label class="label" for="username">
						<span class="label-text">Username</span>
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="text"
						name="username"
						placeholder="Type here"
						required
						class={`input input-bordered w-full max-w-xs ${
							form?.invalid && form?.username ? 'input-error' : ''
						}`} />
					{#if form?.invalid && form?.username}
						<p class="text-error">
							{form?.invalid ? form?.username.message : 'Invalid username.'}
						</p>
					{/if}
				</div>
				<div>
					<label class="label" for="email">
						<span class="label-text">Email</span>
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="email"
						name="email"
						required
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							form?.invalid && form?.email ? 'input-error' : ''
						}`} />
					{#if form?.invalid && form?.email}
						<p class="text-error">{form?.invalid ? form?.email.message : 'Invalid email.'}</p>
					{/if}
				</div>
				<div>
					<label class="label" for="password">
						<span class="label-text">Password</span>
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="password"
						name="password"
						required
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							form?.invalid && form?.password?.message ? 'input-error' : ''
						}`} />
					{#if form?.invalid && form?.password}
						<p class="text-error">
							{form?.invalid ? form?.password?.message : 'Invalid password.'}
						</p>
					{/if}
				</div>
				<div>
					<label class="label" for="passwordConfirm">
						<span class="label-text">Repeat password</span>
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="password"
						name="passwordConfirm"
						placeholder="Type here"
						required
						class={`input input-bordered w-full max-w-xs ${
							form?.invalid && form?.passwordConfirm ? 'input-error' : ''
						}`} />
					{#if form?.invalid && form?.passwordConfirm}
						<p class="text-error">
							{form?.invalid ? form?.passwordConfirm.message : 'Invalid password.'}
						</p>
					{/if}
				</div>
				<button class="btn btn-primary">Sign up</button>
			</div>
		</form>
	{/if}
</div>
