<script lang="ts">
	import Select from 'svelte-select';
	import { writable } from 'svelte/store';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	import { editCategoryStore } from '$lib/stores/edit-category.store';
	import { icons } from '$lib/enums/icons';
	import Icon from '$lib/components/Icon/Icon.svelte';
	import { showToast } from '$lib/utils/show-toast';
	import type { Category } from '$lib/types/Category.type';

	const category = writable<Partial<Category>>({});
	$: $category = { ...$editCategoryStore };

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

	const categoryColors = [
		'#FBEAA3',
		'#76C5EF',
		'#23E4FC',
		'#80CA90',
		'#FDD411',
		'#E7866E',
		'#57B55F',
		'#D97FBE',
		'#FE7197',
		'#C278FF',
		'#497AF3',
		'#E91074',
		'#844561',
		'#20164E'
	];
</script>

{#if $category?.id}
	<div class="w-full">
		<form
			bind:this={form}
			name="editCategoryForm"
			method="POST"
			action="/?/updateCategory"
			use:enhance={() =>
				({ update, result }) => {
					if (result.type === 'success') {
						showToast.success('Category updated', {
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
			<div class="flex flex-col w-full gap-2">
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
								class={`btn btn-circle btn-ghost btn-sm flex justify-center items-center p-1
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
						<div
							class={`btn btn-ghost btn-sm flex justify-center items-center p-1 text-xs
									${$category.icon === '' ? 'ring-primary ring-2 bg-primary bg-opacity-20' : ''}
									`}
							title="None"
							role="button"
							tabindex="0"
							on:keydown={(event) => {
								if (event.key === 'Enter') {
									// @ts-ignore-next-line
									$category.icon = '';
								}
							}}
							on:click={() => {
								// @ts-ignore-next-line
								$category.icon = '';
							}}
						>
							None
						</div>
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
						<div class="flex flex-wrap max-w-[12rem] gap-1">
							{#each categoryColors as color}
								<div
									class={`w-6 h-6 rounded-full ${
										$category.color === color ? 'ring-primary ring-2 bg-primary bg-opacity-20' : ''
									}`}
									style={`background-color: ${color};`}
									role="button"
									tabindex="0"
									on:keydown={(event) => {
										if (event.key === 'Enter') {
											// @ts-ignore-next-line
											$category.color = color;
										}
									}}
									on:click={() => {
										// @ts-ignore-next-line
										$category.color = color;
									}}
								/>
							{/each}
						</div>
						<div class="join">
							<div class="tooltip" data-tip="Color preview">
								<div
									class="join-item border border-slate-600 w-6 h-12 flex flex-col justify-end"
									style={`background-color: ${$category.color};`}
								/>
							</div>
							<input
								type="text"
								class="join-item input input-bordered w-9/12 backdrop-invert"
								name="color"
								value={$category.color}
								placeholder="E.g. #00FFFF"
								on:input={(event) => {
									// @ts-ignore-next-line
									$category.color = event.target.value;
								}}
							/>
						</div>
					</div>
				</div>
				<div class="flex flex-col w-auto">
					<label for="parent" class="label">Parent</label>
					<div class="tooltip" data-tip="Select parent category">
						<Select
							name="parent"
							searchable
							placeholder="Select parent category..."
							required
							value={$category.parent?.id || $categoriesOptions[0].value}
							items={$categoriesOptions}
							class="this-select input input-bordered w-max"
							on:change={(event) => {
								// @ts-ignore-next-line
								$category.parent = $page.data.categories.find((c) => c.id === event.detail.value);
							}}
						/>
					</div>
				</div>
			</div>
			<div>
				<div class="flex place-content-between">
					<button
						type="submit"
						formaction="/?/updateCategory"
						class="btn btn-primary my-6 w-full max-w-xs"
						disabled={!$category.name}>Save</button
					>
					<form
						method="POST"
						action="/?/deleteCategory"
						use:enhance={() =>
							({ update, result }) => {
								if (result.type === 'success') {
									showToast.success('Category deleted. Redirecting...', {
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
								setTimeout(() => {
									window.location.href = '/';
								}, 200);
							}}
					>
						<input type="text" class="hidden" name="id" value={$category.id} />
						<button
							class="btn btn-error my-6 mx-auto w-full max-w-xs"
							formaction="/?/deleteCategory"
						>
							Delete
						</button>
					</form>
				</div>
			</div>
		</form>
	</div>
{/if}
