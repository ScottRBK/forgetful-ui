{
  description = "Read-only web UI for Forgetful, and the environment its checks run in";

  inputs = {
    # The OS-agnostic unstable branch. Named explicitly here so the channel is a
    # reviewable choice rather than an implicit default; flake.lock pins the revision.
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };

    git-hooks-nix = {
      url = "github:cachix/git-hooks.nix";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        # Follow our edge so the lock holds one flake-compat node, not one per
        # consumer of it.
        flake-compat.follows = "flake-compat";
      };
    };

    # default.nix / shell.nix entry points for nix-build and nix-shell.
    flake-compat = {
      url = "github:NixOS/flake-compat";
      flake = false;
    };
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.git-hooks-nix.flakeModule ];

      # Only a system someone can build on is listed. Every output here is
      # evaluated per system, so a listed system that cannot build turns
      # `nix flake check` into a claim without a builder behind it. Add a system
      # together with the machine that proves it.
      systems = [ "x86_64-linux" ];

      perSystem =
        {
          config,
          pkgs,
          ...
        }:
        let
          inherit (pkgs) lib;

          # Read at eval time from the manifest so the checks cannot disagree
          # with the project about what they are testing.
          manifest = lib.importJSON ./package.json;
          inherit (manifest) version;

          # The project's own dependency graph, resolved from package-lock.json.
          # The lockfile stays the single source of truth; Nix only fetches what
          # it already pins.
          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };

          # Source: the flake's own git-based copy of the tree, with no extra
          # filter. An allow-list is the wrong instrument for a repository we do
          # not own, because it silently drops files added upstream and the
          # failure surfaces as a missing test fixture rather than a decision.
          # Nix already excludes untracked and ignored paths, so build outputs
          # never enter the store.
          src = ./.;

          # The Biome CLI is published to npm as a prebuilt binary and the project
          # pins its exact version. The Linux build is linked against the generic
          # loader at /lib64/ld-linux-x86-64.so.2, which does not exist on a system
          # whose loader lives in the store, so the binary cannot start there.
          # This wraps that same pinned release: the same tarball, with its
          # interpreter and library paths rewritten, so the version and its output
          # stay identical to what the project pins.
          # Read from the manifest rather than repeated here, so the lint the
          # checks and the shell use cannot drift from the version npm installs.
          biomeVersion = manifest.devDependencies."@biomejs/biome";

          biome = pkgs.stdenv.mkDerivation {
            pname = "biome";
            version = biomeVersion;

            src = pkgs.fetchurl {
              url = "https://registry.npmjs.org/@biomejs/cli-linux-x64/-/cli-linux-x64-${biomeVersion}.tgz";
              hash = "sha256-w2CIa13tJj3lBGCMb/YmyH6NSlIhC1k++r2tfsIjKDU=";
            };

            sourceRoot = "package";
            nativeBuildInputs = [ pkgs.autoPatchelfHook ];
            buildInputs = [ pkgs.stdenv.cc.cc.lib ];

            dontConfigure = true;
            dontBuild = true;
            dontStrip = true;

            installPhase = ''
              runHook preInstall
              install -Dm755 biome $out/bin/biome
              runHook postInstall
            '';

            meta = {
              description = "Biome formatter and linter, pinned to the version this project uses";
              mainProgram = "biome";
            };
          };

          # Playwright downloads its own patched browser builds and validates the
          # build number against the client library, so a browser from another
          # Playwright release cannot be substituted: the two speak a versioned
          # protocol and the client rejects the older build at runtime. This
          # fetches the exact build the project's Playwright version expects and
          # rewrites it the same way, which is what lets the browser suite run on
          # a system that cannot run the generic Linux archive.
          playwrightFirefox = pkgs.stdenv.mkDerivation {
            pname = "playwright-firefox";
            version = "1572";

            src = pkgs.fetchurl {
              url = "https://cdn.playwright.dev/dbazure/download/playwright/builds/firefox/1572/firefox-ubuntu-24.04.zip";
              hash = "sha256-GJzj4Jxhd2AQq4p8v/qgFrixkU08m1DLWrbQxdtMNo8=";
            };

            nativeBuildInputs = pkgs.firefox-bin.unwrapped.nativeBuildInputs ++ [ pkgs.unzip ];
            inherit (pkgs.firefox-bin.unwrapped)
              buildInputs
              runtimeDependencies
              appendRunpaths
              patchelfFlags
              ;

            dontConfigure = true;
            doCheck = false;

            # Playwright looks for $PLAYWRIGHT_BROWSERS_PATH/firefox-<revision>/firefox.
            unpackPhase = "unzip -q $src";
            buildPhase = ''
              runHook preBuild
              mkdir -p $out/firefox-1572
              cp -R firefox $out/firefox-1572/
              runHook postBuild
            '';

            meta.description = "Playwright's Firefox build for the version this project uses";
          };

          # The default output: the production bundle, built from the pinned
          # dependency graph rather than from a dist/ that is not in the tree.
          # Node is a build-time dependency only; the output is static files.
          bundle = pkgs.buildNpmPackage {
            pname = "forgetful-ui";
            inherit version src npmDeps;
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;
            nodejs = pkgs.nodejs_24;
            # Browser downloads and binary post-installs are not needed to build,
            # and the project documents installing without them.
            npmInstallFlags = [ "--ignore-scripts" ];

            buildPhase = ''
              runHook preBuild
              npm run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -r dist/. $out/
              runHook postInstall
            '';

            # No mainProgram: the output is static files, not something to run.
            meta.description = "Built static bundle of the Forgetful web UI";
          };

          # The build is one thing to prove, the shape of what it produced is
          # another: a build that succeeds and emits an empty directory would
          # otherwise pass. This asserts the shell and the chunk it references.
          bundleCheck = pkgs.runCommand "forgetful-ui-bundle-check" { } ''
            test -s ${bundle}/index.html
            entry=$(sed -n 's/.*src="\.\/\(assets\/[^"]*\.js\)".*/\1/p' ${bundle}/index.html | head -1)
            test -n "$entry"
            test -f "${bundle}/$entry"
            ls ${bundle}/assets/*.css > /dev/null
            mkdir -p $out
            echo "bundle contains $entry" > $out/passstamp
          '';

          # Both checks run the project's own commands against its own dependency
          # graph. Neither needs the network, a browser, or a running server.
          nodeCheck =
            name: command: extraEnv:
            pkgs.buildNpmPackage {
              pname = "forgetful-ui-${name}";
              inherit version src npmDeps;
              # The lockfile-derived dependency tree is only usable with the hook
              # that understands it; the default hook expects a byte-identical
              # lock and would reject the store-path rewrite.
              npmConfigHook = pkgs.importNpmLock.npmConfigHook;

              # The project declares two install scripts (esbuild and the optional
              # macOS fsevents package) and documents installing without them.
              npmInstallFlags = [ "--ignore-scripts" ];
              dontNpmBuild = true;

              doCheck = true;
              checkPhase = ''
                runHook preCheck
                export HOME="$TMPDIR"
                ${extraEnv}
                ${command}
                runHook postCheck
              '';

              installPhase = ''
                runHook preInstall
                mkdir -p $out
                echo "${command} passed" > $out/passstamp
                runHook postInstall
              '';

              meta.description = "Runs ${command} for the web UI";
            };
        in
        {
          packages = {
            default = bundle;
            inherit biome;
            playwright-firefox = playwrightFirefox;
          };

          checks = {
            bundle = bundleCheck;
            typecheck = nodeCheck "typecheck" "npm run typecheck" "";
            unit-tests = nodeCheck "unit-tests" "npm test" "export CI=1";
          };

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_24
              pkgs.git
              biome
              playwrightFirefox
            ]
            ++ config.pre-commit.settings.enabledPackages;

            shellHook = ''
              ${config.pre-commit.shellHook}

              # Point the project's own Biome wrapper at the wrapped binary of the
              # version it pins, rather than letting it fail on the generic loader.
              export BIOME_BINARY=${biome}/bin/biome

              # Playwright's browsers come from the store, so no download step is
              # needed and nothing lands in the home directory.
              export PLAYWRIGHT_BROWSERS_PATH=${playwrightFirefox}

              # Install the dependencies the lockfile pins when they are missing
              # or older than the lockfile. Nothing is installed on every entry.
              if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
                npm ci --ignore-scripts
              fi
            '';
          };

          # Hook stages: a hook that would fail on the existing tree is pinned to
          # the manual stage, so it is available without being imposed on anyone.
          # TypeScript, JSON formatting and Markdown prose are owned by the
          # project's own Biome configuration; re-linting them here would mean two
          # tools disagreeing about the same files.
          pre-commit.settings.hooks = {
            nixfmt.enable = true;
            statix.enable = true;
            deadnix.enable = true;
            check-json.enable = true;
            check-yaml.enable = true;
            # The existing tree carries misspellings in prose this project does not
            # own, so enabling this at commit time would fail on a file nobody here
            # is editing. Manual stage keeps it available without imposing it.
            typos.enable = true;
            typos.stages = [ "manual" ];
            # The existing documents predate this linter and fail it wholesale
            # (line length, trailing spaces, missing headings in files we did not
            # write). Manual stage keeps it usable on a file you are editing.
            markdownlint.enable = true;
            markdownlint.stages = [ "manual" ];
          };

          # `nix fmt` is the same hook set over the whole tree, so formatting and
          # the commit hooks cannot drift apart.
          formatter = pkgs.writeShellScriptBin "fmt" ''
            ${lib.getExe config.pre-commit.settings.package} run --all-files --config ${config.pre-commit.settings.configFile}
          '';
        };
    };
}
