# nix-build entry point (flake-compat). The flake is the source of truth; this
# shim only lets plain `nix-build` work without experimental flake features.
# The flake-compat node is read from flake.lock so `nix flake update` keeps the
# two in agreement. Do not hardcode an owner, repository or revision here.
(import (
  let
    lock = builtins.fromJSON (builtins.readFile ./flake.lock);
    node = lock.nodes.${lock.nodes.root.inputs.flake-compat}.locked;
  in
  fetchTarball {
    url = "https://github.com/${node.owner}/${node.repo}/archive/${node.rev}.tar.gz";
    sha256 = node.narHash;
  }
) { src = ./.; }).defaultNix
