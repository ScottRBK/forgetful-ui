# Development environment

Two commands in this project run prebuilt binaries that assume a generic Linux layout. On a system
whose dynamic loader is not at `/lib64`, they fail before any project code runs.

This page records those failures and the commands that work without the Nix environment described
in [nix.md](./nix.md).

## What fails, and why

Biome ships as a native binary linked against the generic loader:

```text
$ ./node_modules/.bin/biome --version
Could not start dynamically linked executable: .../node_modules/@biomejs/cli-linux-x64/biome
NixOS cannot run dynamically linked executables intended for generic
linux environments out of the box. For more information, see:
https://nix.dev/permalink/stub-ld
```

Playwright downloads a browser that expects Ubuntu's shared libraries:

```text
Host system is missing dependencies to run browsers.
Missing libraries: libstdc++.so.6, libxcb-shm.so.0, libX11-xcb.so.1, ...
```

Reaching for a browser that is already installed does not help, because Playwright validates the
browser build number against the client library:

```text
Protocol error (Browser.setDownloadOptions): ERROR: failed to call method
'Browser.setDownloadOptions' ... (unknown method)
```

Neither failure is a defect in this project. Both are the cost of prebuilt binaries on a system
that does not match their assumptions, and the fix is an environment that provides the pinned
versions in a form that starts. That is what [nix.md](./nix.md) sets up.

## Without Nix

On macOS and on Linux distributions with a conventional loader, the documented commands work as
written:

```bash
npm ci --ignore-scripts
npx playwright install firefox
npm run typecheck
npm test
npm run lint
npx playwright test
```

Nothing in this repository requires Nix. The environment exists so those same commands work where
the prebuilt binaries cannot start.

## What still needs a running server

`npm run test:e2e:live` sets `LIVE=1` and talks to a real Forgetful instance on `127.0.0.1:8022`.
Without one, those two tests skip by design. That is a property of the test, not a gap in the
environment.
