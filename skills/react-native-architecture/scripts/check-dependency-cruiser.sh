#!/usr/bin/env bash
set -euo pipefail

# Reports whether dependency-cruiser is set up in the current project, so the
# react-native-architecture skill knows whether to offer installing it and
# scaffolding a starter config. Run from the project root.
#
# Prints two lines:
#   package: installed | declared-not-installed | missing
#   config: present | missing
#
# Exits 0 only when both are already set up. Does not install anything or
# write any file itself — the skill decides what to do with the result,
# after asking the user.

if [ ! -f package.json ]; then
  echo "package: no-package-json"
  echo "config: unknown"
  exit 3
fi

if [ -x node_modules/.bin/depcruise ]; then
  package_status="installed"
elif grep -q '"dependency-cruiser"' package.json 2>/dev/null; then
  package_status="declared-not-installed"
else
  package_status="missing"
fi

config_status="missing"
for candidate in .dependency-cruiser.cjs .dependency-cruiser.js .dependency-cruiser.json .dependency-cruiser.mjs; do
  if [ -f "$candidate" ]; then
    config_status="present"
    break
  fi
done

echo "package: $package_status"
echo "config: $config_status"

if [ "$package_status" = "installed" ] && [ "$config_status" = "present" ]; then
  exit 0
fi
exit 1
