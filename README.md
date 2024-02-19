# Grimoire

<p align="center">
  <img alt="Grimoire Logo" src="static/grimoire_logo_300.webp">
</p>

Glimpse into the magical book of _your_ forbidden knowledge - **Grimoire!** 📖💫

Unleash your inner sorcerer and conquer the chaos of bookmarks! With Grimoire, you'll have a bewitching way to store and sort your enchanted links.

But wait, there's **more**!

Transmute your saved pages into juicy content snippets with our mystical extraction feature. Embrace the magic, tame the clutter, and let Grimoire be your mystical companion in the vast library of the web.

It's time to conjure up some organization! 📚✨

## Features

- add and organize bookmarks easily 🔖
- create new user accounts, each with their own bookmarks, categories and tags 🙋
- fuzzy search through bookmarks 🔍
- supports tags and categories 🏷️
- fetch metadata from websites, store it locally and update it when needed 🌐
- add your personal notes to bookmarks 📝
- integration API to add bookmarks from other sources 🧰

## Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Steps

```bash
# Clone the repository
git clone https://github.com/goniszewski/grimoire

# Rename the `.env.example` file to `.env`
# "mv .env.example .env" on Linux/MacOS, "ren .env.example .env" on Windows

# [RECOMMENDED] Update the `.env` to set the initial admin user credentials
# (admins are separate from regular users)

# Build and run the containers
docker-compose up
```

## Development

Check out the [development guide](https://grimoire.pro/docs/getting-started/development) to learn how to set up the project for development.

## Roadmap

- [x] Initial relase (0.1.0) 🚀
- [x] Official Docker image 🐳
- [x] Add Integration API 🧰
- [ ] Official browser extension 🪄
- [ ] Bookmark import and export features 💼
- [ ] AI features, like generated descriptions and tags suggestions 🤖
- [ ] Public User profiles & bookmark sharing 🌍
- [ ] Flows - a way to keep bookmarks in a session-like order with related notes (e.g. for learning, research, etc.) ✨
- [ ] ...and more to come! 🧙

We're open to suggestions and feature requests! If you have an idea for a feature, please [open an issue](https://github.com/goniszewski/grimoire/issues) or [start a discussion](https://github.com/goniszewski/grimoire/discussions/categories/ideas).

## Contributing

If you want to contribute to the project, please read the [contributing guide](CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](LICENSE).

## Credits

Special thanks to: [@extractus/article-extractor](https://github.com/extractus/article-extractor),
[DaisyUI](https://github.com/saadeghi/daisyui),
[Fuse.js](https://github.com/krisk/fuse),
[MetaScraper](https://github.com/microlinkhq/metascraper),
[PocketBase](https://github.com/pocketbase/pocketbase),
[sanitize-html](https://github.com/apostrophecms/sanitize-html),
[SvelteKit](https://github.com/sveltejs/kit),
[Svelte Select](https://github.com/rob-balfre/svelte-select),
[Svelte French Toast](https://github.com/kbrgl/svelte-french-toast),
[Tailwind CSS](https://tailwindcss.com)
