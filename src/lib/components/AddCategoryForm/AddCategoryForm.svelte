<script lang="ts">
	import Select from 'svelte-select';
	import { writable } from 'svelte/store';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	import type { Category } from '$lib/interfaces/Category.interface';
	import { icons } from '$lib/enums/icons';
	import Icon from '$lib/components/Icon/Icon.svelte';
	import { showToast } from '$lib/utils/show-toast';

	const category = writable<
		Partial<
			Omit<Category, 'public'> & {
				public: boolean;
			}
		>
	>({});
	$: $category = {
		name: '',
		icon: '',
		description: '',
		color: '',
		public: false,
		parent: undefined
	};

	let form: HTMLFormElement;
	export let closeModal: () => void;

	const categoriesOptions = writable<{ value: string; label: string }[]>([
		{
			value: 'null',
			label: 'No parent'
		}
	]);

	$: {
		$categoriesOptions = [
			{
				value: 'null',
				label: 'No parent'
			},
			...$page.data.categories
				.filter((c) => {
					return c.id !== $category.id;
				})
				.map((c) => ({
					value: c.id,
					label: c.name
				}))
		];
	}

	let error = '';
</script>

<form
	bind:this={form}
	method="POST"
	action="/?/addNewCategory"
	use:enhance={() =>
		({ update, result }) => {
			if (result.type === 'success') {
				showToast.success('Category added', {
					position: 'bottom-center'
				});
			}

			if (result.type === 'error') {
				showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
					position: 'bottom-center'
				});
			}
			closeModal();
			update();
		}}
>
	<input type="text" class="hidden" name="id" value={$category.id} />
	<input type="text" class="hidden" name="icon" value={$category.icon} />
	<div class="w-full">
		<div class="flex flex-col w-full">
			<div class="flex flex-col w-full">
				<label for="name" class="label">Name</label>
				<input
					type="text"
					class="input input-bordered"
					name="name"
					value={$category.name}
					placeholder="School, Work, etc..."
					required
					on:input={(event) => {
						// @ts-ignore-next-line
						$category.name = event.target.value;
					}}
				/>
			</div>
			<div class="flex flex-col w-full">
				<label for="icon" class="label">Icon</label>
				<div class="flex gap-1">
					{#each icons as icon}
						<div
							class={`badge badge-outline cursor-pointer rounded-full w-8 h-8 flex justify-center items-center p-1
								${$category.icon === icon.id ? 'ring-primary ring-2 bg-primary bg-opacity-20' : ''}
								`}
							title={icon.title}
							role="button"
							tabindex="0"
							on:keydown={(event) => {
								if (event.key === 'Enter') {
									// @ts-ignore-next-line
									$category.icon = icon.id;
								}
							}}
							on:click={() => {
								// @ts-ignore-next-line
								$category.icon = icon.id;
							}}
						>
							<Icon name={icon.id} />
						</div>
					{/each}
				</div>
			</div>
			<div class="flex flex-col w-auto">
				<label for="description" class="label">Description</label>
				<textarea
					class="textarea textarea-bordered"
					name="description"
					value={$category.description}
					placeholder="What is this category about?"
					on:change={(event) => {
						// @ts-ignore-next-line
						$category.description = event.target.value;
					}}
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label for="color" class="label">Color</label>

				<div class="flex gap-2">
					{#each ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#ff0000'] as color}
						<div
							class="w-6 h-6 rounded-full"
							style={`background-color: ${color};`}
							on:click={() => {
								// @ts-ignore-next-line
								$category.color = color;
							}}
						/>
					{/each}

					<input
						type="text"
						class="input input-bordered w-9/12"
						name="color"
						value={$category.color}
						on:input={(event) => {
							// @ts-ignore-next-line
							$category.color = event.target.value;
						}}
					/>
				</div>
			</div>
			<div class="flex flex-col w-auto">
				<label for="parent" class="label">Parent</label>
				<Select
					name="parent"
					searchable
					placeholder="Select parent category..."
					required
					value={$category.parent?.id || $categoriesOptions[0].value}
					items={$categoriesOptions}
					on:change={(event) => {
						// @ts-ignore-next-line
						$category.parent = $page.data.categories.find((c) => c.id === event.detail.value);
					}}
				/>
			</div>
			<div class="flex flex-col w-full">
				<label for="public" class="label">Public</label>
				<input
					type="checkbox"
					class="checkbox checkbox-primary"
					name="public"
					checked={!!$category.public}
					on:change={(event) => {
						// @ts-ignore-next-line
						$category.public = event.target.checked;
					}}
				/>
			</div>
		</div>

		<button class="btn btn-primary my-6 mx-auto w-full max-w-xs" disabled={!$category.name}
			>Save</button
		>
	</div>
</form>
