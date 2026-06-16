# Optional dev shell for NixOS users.
#
# Playwright distributes prebuilt browsers as Ubuntu binaries, which fail to
# launch on NixOS because the dynamic linker can't resolve their shared libs
# (libnspr4, libnss3, etc). The supported pattern is to use the browsers from
# the `playwright-driver.browsers` derivation, which are wrapped with the
# correct LD_LIBRARY_PATH for NixOS.
#
# Usage:
#   nix-shell           # drops you into a shell with browsers wired up
#   npm run test:playwright -- tests/brainstorm/profile-tags.spec.js
#
# Note: the npm @playwright/test version (in package.json) must match the
# version in nixpkgs' playwright-driver. Currently both are pinned to 1.56.1.
# When you bump one, bump the other.
#
# Non-NixOS dev boxes (Ubuntu, macOS) don't need this file; the standard
# `npx playwright install --with-deps` flow works there.

{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = [
    pkgs.nodejs_22
    pkgs.playwright-driver.browsers
  ];

  shellHook = ''
    export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
    export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    echo "Tapestry NixOS dev shell — Playwright browsers from $PLAYWRIGHT_BROWSERS_PATH"
  '';
}
