# Project Context

This checkout is the public Grimoire repository. Maintainer-only planning and
visual evidence live in a sibling workspace so the public tree stays focused
on the product, its public documentation, and its source code.

## Private workspace

The private workspace mirrors the former repository-relative paths. This keeps
existing links inside task files working while keeping the records out of Git:

- Task board: `../_project-work/grimoire/tasks/`
- Task index: `../_project-work/grimoire/tasks/README.md`
- Task reports and evidence: `../_project-work/grimoire/docs/task-reports/`
- Report instructions: `../_project-work/grimoire/docs/task-reports/INSTRUCTION.md`
- UI audit archive and generator: `../_project-work/grimoire/audits/ui-ux/`

## Working on a task

1. Read the relevant task file and `../_project-work/grimoire/tasks/README.md`.
2. Keep the existing task ID and update its status directory when the workflow
   requires a state change.
3. For non-trivial implementation, documentation-presentation, packaging, or
   visible-flow work, follow the private report instructions and store the
   evidence in the external task-report directory.
4. Keep public repository documentation limited to user-facing, contributor,
   operational, API, and other intentionally published material.
5. Do not recreate `tasks/` or `docs/task-reports/` in this checkout. If the
   private workspace is unavailable, restore or create it beside the checkout
   rather than placing local work records in the repository.
