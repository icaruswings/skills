#!/usr/bin/env bash
set -euo pipefail

# Dev-only script, for working on this repo.
#
# Links every skill in the repo into the local skill directories used by each
# agent harness:
#   - ~/.claude/skills  — Claude Code
#   - ~/.agents/skills  — Codex and other Agent Skills-compatible harnesses
# Each entry is a symlink into this repo, so a `git pull` keeps the installed
# skills current. Re-run after adding, removing, or renaming a skill.
#
# It never deletes your files or directories. It removes symlinks in two cases
# only: one sitting at a name it needs (that is the idempotent re-link path),
# and one with the exact shape it writes, <dest>/<name> pointing at
# <repo>/skills/<name>, whose skill no longer exists. That second case is how a
# rename or a removal gets cleaned up. A link of your own under a different
# name, or one pointing at a file inside a skill, does not match either case.
#
# Every destination is validated before any link is written: it must resolve
# outside this repo, hold no files of yours at the names we need, and be
# writable. So a predictable failure stops the run instead of linking one
# destination and abandoning the other. Validation itself may create an empty
# destination directory, which is the one thing a refused run leaves behind.

# /bin/pwd -P calls getcwd() and returns the canonical path, including its real
# case. The bash builtin resolves symlinks textually from $PWD, so on a
# case-insensitive filesystem it keeps whatever case a symlink was written in,
# and two spellings of one directory then compare unequal — which is enough to
# walk a destination straight past the repo guard below.
PWD_BIN=/bin/pwd
[ -x "$PWD_BIN" ] || PWD_BIN=pwd

# Canonical path of an existing directory, or empty if it is not one. Callers
# must absorb its exit status (`|| var=""`): under `set -e` a bare assignment
# from a failing command substitution takes the whole script down, which would
# skip the error message the caller is about to print.
canonical() {
  (cd "$1" 2>/dev/null && "$PWD_BIN" -P) 2>/dev/null
}

REPO="$(cd "$(dirname "$0")/.." && "$PWD_BIN" -P)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

inside_repo() {
  case "$1" in
    "$REPO"|"$REPO"/*) return 0 ;;
  esac
  return 1
}

if [ ! -d "$REPO/skills" ]; then
  echo "no skills found under $REPO/skills — nothing to link"
  exit 0
fi
REPO_SKILLS="$(canonical "$REPO/skills")" || REPO_SKILLS=""
if [ -z "$REPO_SKILLS" ]; then
  echo "error: cannot resolve $REPO/skills" >&2
  exit 1
fi

names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$REPO_SKILLS" -name SKILL.md -print0)

if [ ${#names[@]} -eq 0 ]; then
  echo "no skills found under $REPO_SKILLS — nothing to link"
  exit 0
fi

# Pass 1: validate every destination. No skill is linked until all of this passes.
targets=()
conflicts=()
for DEST in "${DESTS[@]}"; do
  # A destination that does not exist yet still needs the repo guard, because a
  # parent of it may be a symlink into the repo and mkdir -p would then create
  # it in there. So resolve the nearest thing that does exist and check that.
  probe="$DEST"
  while [ ! -e "$probe" ] && [ ! -L "$probe" ] && [ "$probe" != "/" ]; do
    probe="$(dirname "$probe")"
  done

  probe_resolved="$(canonical "$probe")" || probe_resolved=""
  if [ -z "$probe_resolved" ]; then
    echo "error: $probe exists but is not a usable directory." >&2
    echo "It may be a dangling symlink or a file. Inspect it (ls -ld \"$probe\"), remove it, and re-run." >&2
    exit 1
  fi
  if inside_repo "$probe_resolved"; then
    echo "error: $DEST resolves into this repo (via $probe -> $probe_resolved)." >&2
    echo "Linking there would point the repo's own skills/ tree at itself." >&2
    echo "Repoint or remove that path and re-run. Do not move anything out of $REPO." >&2
    exit 1
  fi

  mkdir -p "$DEST"

  # Re-resolve now that it exists, so the checks below and the writes later both
  # use one canonical path.
  resolved="$(canonical "$DEST")" || resolved=""
  if [ -z "$resolved" ] || inside_repo "$resolved"; then
    echo "error: $DEST does not resolve to a usable directory outside this repo." >&2
    exit 1
  fi

  canary="$resolved/.link-skills-write-probe.$$"
  if ! ln -sfn /dev/null "$canary" 2>/dev/null; then
    echo "error: cannot write to $DEST (resolved: $resolved)." >&2
    echo "Fix its permissions and re-run; nothing has been linked." >&2
    exit 1
  fi
  rm -f "$canary"

  for name in "${names[@]}"; do
    target="$resolved/$name"
    # A symlink here is ours to replace. Anything else is your content, and this
    # script does not delete it.
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      conflicts+=("$target")
    fi
  done

  targets+=("$resolved")
done

if [ ${#conflicts[@]} -ne 0 ]; then
  echo "error: refusing to link — real files or directories are in the way:" >&2
  for conflict in "${conflicts[@]}"; do
    echo "  $conflict" >&2
  done
  echo >&2
  echo "These are not symlinks, so they may hold your own work (for example a skill" >&2
  echo "folder copied by hand). This script will not delete them. Move or remove each" >&2
  echo "one yourself, then re-run:" >&2
  echo "  mv \"${conflicts[0]}\" \"${conflicts[0]}.bak\"" >&2
  exit 1
fi

# Pass 2: link.
for DEST in "${targets[@]}"; do
  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"

    ln -sfn "$src" "$DEST/$name"
    echo "linked $name -> $src ($DEST)"
  done
done

# Pass 3: prune. A renamed or removed skill leaves its old symlink behind, and
# harnesses still enumerate it. Remove only links that point into this repo's
# skills/ tree and no longer match a skill — anything else is yours.
for DEST in "${targets[@]}"; do
  for entry in "$DEST"/*; do
    [ -L "$entry" ] || continue

    name="$(basename "$entry")"
    current=0
    for known in "${names[@]}"; do
      if [ "$known" = "$name" ]; then
        current=1
        break
      fi
    done
    if [ "$current" -eq 1 ]; then
      continue
    fi

    link="$(readlink "$entry")"
    case "$link" in
      /*) abs="$link" ;;
      *) abs="$DEST/$link" ;;
    esac

    # Canonicalize the parent, which works for a dangling link too — its own
    # path cannot be resolved, but the directory holding it usually can.
    parent="$(canonical "$(dirname "$abs")")" || parent=""
    if [ -n "$parent" ]; then
      abs="$parent/$(basename "$abs")"
    fi

    # Prune only the exact shape this script writes: <dest>/<name> pointing at
    # <repo>/skills/<name>. Your own alias under a different name, and your own
    # link to a file inside a skill, both fail this test and stay.
    if [ "$abs" = "$REPO_SKILLS/$name" ]; then
      rm "$entry"
      echo "pruned $name (stale link -> $link)"
    fi
  done
done
