# Nix

Nix is optional here. npm remains the way this project is run, built and tested, and every
command in the README works without Nix on a system where the prebuilt dependencies start.
The flake exists for two reasons: so the tools that ship as generic Linux binaries can start on
a system whose dynamic loader is not at `/lib64`, and so the checks have one reproducible
definition instead of a list of commands someone remembers.

Written 26 November 2026.

## Status and ownership

The canonical repository is `github.com/ScottRBK/forgetful-ui`. It is the only remote configured
in this checkout, named `origin`, and it is the maintainer's repository rather than a fork of it.
No second remote is assumed.

Releases and tags belong to the maintainer. This setup publishes nothing: no binaries, no cache,
no release artefacts.

## Prerequisites

Nix with the `flakes` and `nix-command` experimental features. No host Node or npm is required;
the shell supplies both.

## Development

```bash
nix develop
npm run typecheck
npm test
npm run lint
npx playwright test
```

Entering the shell installs `node_modules` from `package-lock.json` when it is missing or older
than the lockfile. Nothing is installed on every entry, and nothing is written outside the store
except the project's own `node_modules`.

Two tools need a word of explanation because they do not simply work from `node_modules`:

- **Biome.** The npm package resolves to a native binary linked against the generic loader, which
  cannot start here. The shell provides that same release, from the same tarball, with its
  interpreter and library paths rewritten, and points the project's own wrapper at it through
  `BIOME_BINARY`. The version is the one `package.json` pins; substituting a distribution build
  would mean reporting on a different tool.
- **Playwright.** `npm ci` does not download browsers, `npx playwright install firefox` fetches a
  generic Linux build that cannot start here, and a browser from a different Playwright release is
  rejected at runtime because the client and browser protocols are versioned. The shell builds the
  exact browser the pinned Playwright expects and points `PLAYWRIGHT_BROWSERS_PATH` at it, so
  nothing is downloaded at test time.

Do not set either variable in a committed file. They are shell state, and a contributor on a
system that needs neither should not inherit them.

## Channel and systems

The nixpkgs input is `github:NixOS/nixpkgs/nixpkgs-unstable`, named explicitly so the channel is a
reviewable choice rather than an implicit default. `flake.lock` pins the revision; updating it is a
deliberate act (`nix flake update`), not something that happens when the flake is evaluated.

`systems` lists only `x86_64-linux`. A listed system that no one can build on is documentation
pretending to be a guarantee, and `nix flake check` will happily report it as covered. Add a system
together with the machine that proves it, and say what was built.

## What the shell provides

| Item | Detail |
| --- | --- |
| Node and npm | from nixpkgs, at a version the `engines` field accepts |
| Dependencies | from `package-lock.json`, installed with `npm ci --ignore-scripts` |
| Biome | the version `package.json` pins, patched to start here |
| Playwright Firefox | build 1572, the build Playwright 1.65 expects |
| Commit hooks | the hook set described below |

## Build

`nix build` builds the production bundle and leaves it in `result/`:

```bash
nix build
ls result          # index.html, assets/, brand/
```

The output is the same `dist/` that `npm run build` produces: relative asset URLs, hashed chunk
names, and nothing that needs a runtime. Node is a build-time dependency only, and the build uses
the same lockfile-derived dependency graph as the checks, so there is one dependency definition
rather than one per output.

The derivation's version comes from the `version` field in `package.json`, read when the flake is
evaluated. There is no version literal in `flake.nix`, so the version an output reports is the one
the manifest names, and it cannot drift from a line someone forgot to edit.

## Checks

`nix flake check` runs four checks:

| Check | What it proves |
| --- | --- |
| `bundle` | the production build completes and its output contains the shell and the chunk the shell references |
| `pre-commit` | the enabled hooks pass on the tree as committed |
| `typecheck` | `npm run typecheck` passes with the lockfile's own TypeScript |
| `unit-tests` | `npm test` (Vitest) passes in the sandbox |

Run one on its own:

```bash
nix build .#checks.x86_64-linux.unit-tests -L
```

The browser suite is deliberately not a check. It needs a browser binary and a dev server on a
port, neither of which the sandbox provides, so it stays a command: `nix develop -c npx playwright
test`. Wrapping it as a check would mean shipping a browser and a listening socket into every
`nix flake check`, including on machines that only want the typecheck.

## Hooks and formatting

`nix fmt` runs the same hooks over the whole tree, so formatting and the commit hooks cannot drift
apart. `.pre-commit-config.yaml` is generated by the shell and gitignored.

Entering the shell installs a commit hook that runs through Nix. A commit made without ever
entering the shell therefore fails rather than quietly skipping the checks. Run
`nix develop -c git commit ...` the first time, or skip the hook with your usual escape hatch if
you would rather not have Nix involved in committing.

| Hook | Stage | Why |
| --- | --- | --- |
| `nixfmt` | commit | the declared formatter for Nix files |
| `statix` | commit | Nix anti-patterns |
| `deadnix` | commit | unused bindings |
| `check-json` | commit | malformed JSON fails here rather than in a build |
| `check-yaml` | commit | same, for workflow files |
| `typos` | manual | the existing tree carries misspellings in prose this project does not own, so commit-time enforcement would fail on a file nobody here is touching |
| `markdownlint` | manual | the existing documents predate it and would fail it wholesale; run it on the file you changed |

TypeScript, JSON formatting and Markdown prose inside the application are owned by the project's
own Biome configuration. Running a second formatter over the same files would mean two tools
disagreeing about the same bytes, so no such hook is enabled.

## Binary cache

None. The flake declares no substituters and ships no key. Publishing a cache would make this
checkout responsible for artefacts it does not release, and a wrong cache key is a support burden
that adds nothing to a repository developed on one architecture.

## Source filtering

There is none. The build and the checks take the flake's own view of the tree, which Nix derives
from git, so untracked build outputs never enter the store and nothing has to be maintained. An
allow-list is the wrong instrument for a repository we do not own: it silently drops files added
upstream and the failure surfaces later as a missing fixture rather than as a decision.

## Compatibility entry points

`default.nix` and `shell.nix` exist for `nix-build` and `nix-shell` without flakes enabled. Both
read the flake-compat input from `flake.lock`, so `nix flake update` keeps them in step, and
`shell.nix` delegates to `devShells.<system>.default` so there is one dev shell definition rather
than two that drift.

## Keeping the pins in step

Three values in `flake.nix` follow the project rather than the other way round:

| In `flake.nix` | Follows |
| --- | --- |
| Biome tarball hash | `devDependencies["@biomejs/biome"]` in `package.json` (the version itself is read from the manifest, not repeated) |
| Playwright Firefox build number and archive hash | `@playwright/test` in `package.json`; the build number is printed by `npx playwright install --dry-run firefox` |
| Node major version | `engines.node` |

After a dependency bump that changes either archive, update its hash, run `nix flake lock`, and
re-enter the shell. Hashes come from `nix hash file --type sha256 --sri <archive>`. A hash that no
longer matches fails the fetch loudly rather than building the wrong thing.

## What this does not cover

- Any system other than x86_64 Linux, including macOS. The patch step for both tools is
  Linux-specific and no other system was verified, so the flake provides nothing there. On those
  systems the README's own commands are the whole story, and they work because the npm packages
  start unmodified.
- `npm run test:e2e:live`. It talks to a real server on `127.0.0.1:8022` and skips without one.
  That is a property of the test, not a gap in the environment.
