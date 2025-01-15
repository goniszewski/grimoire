# Contributing

Thank you for considering contributing to this project! All contributors, big or small, are welcomed. To make the contribution process as smooth as possible, please follow the guidelines below.

## Prerequisites

- Bun

## Steps

1. **Fork the repository:** Start by forking the repository to your own GitHub account. This will create a copy of the repository under your username.
2. **Create a new branch:** Clone the forked repository to your local machine and create a new branch for your feature or bug fix.
   ```bash
   git clone https://github.com/your-username/grimoire.git
   cd grimoire
   git checkout -b your-branch-name
   ```
3. **Install Deps** run `bun install` to install the deps
4. **Start the server:** if you are on \*nix systems run `./run-dev.sh`. Might need to chmod it before. On windows just `bun --bun run dev` should work.
5. **Run migrations:** `bun run-migrations` to run migrations and have base DB setup.
6. **Make the changes:** Make the necessary changes to the codebase, ensuring that you follow any coding style guidelines mentioned in the project documentation or README file.
7. **Test your changes:** Thoroughly test your changes to ensure that they do not break existing functionality and introduce new bugs.
8. **Commit your changes:** Once you are satisfied with your modifications, commit them using a descriptive commit message following the rules of [Semantic Commit Messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716).
   ```bash
   git add .
   git commit -m "fix: Your detailed description of your changes."
   ```
9. **Push to your branch:** Push your changes to your forked repository on GitHub.
   ```bash
   git push origin your-branch-name
   ```
10. **Submit a Pull Request:** Navigate to the GitHub page of the original project and submit a pull request with a clear description of your changes.
11. **Wait for review:** Patiently wait for the maintainers to review your pull request. They might ask for additional information or changes, which you can address by updating your branch and submitting an updated pull request.
12. **Let it spark** ✨ Yay, your contribution has been accepted and merged into the project! Thank you for making this project better 🤝

Thank you for contributing to this project! We appreciate your efforts in making it even better. If you have any questions or need further clarification, feel free to reach out to us.
