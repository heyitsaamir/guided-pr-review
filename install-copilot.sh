#!/bin/sh
set -eu

REPO_URL=${GUIDED_PR_REVIEW_REPO:-https://github.com/heyitsaamir/guided-pr-review.git}
REF=${GUIDED_PR_REVIEW_REF:-main}
COPILOT_HOME=${COPILOT_HOME:-"$HOME/.copilot"}
SKILL_DIR="$COPILOT_HOME/skills/guided-pr-review"
EXTENSION_SOURCE="$SKILL_DIR/extensions/guided-pr-review-canvas"
EXTENSION_DIR="$COPILOT_HOME/extensions/guided-pr-review-canvas"

fail() {
  printf 'guided-pr-review: %s\n' "$1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v node >/dev/null 2>&1 || fail "Node 18.17 or newer is required"
command -v gh >/dev/null 2>&1 || fail "GitHub CLI 2.48.0 or newer is required"

node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a > 18 || (a === 18 && b >= 17) ? 0 : 1)' ||
  fail "Node 18.17 or newer is required"

GH_VERSION=$(gh --version | sed -n '1s/^gh version \([0-9][0-9.]*\).*/\1/p')
node -e 'const p=s=>s.split(".").map(Number); const a=p(process.argv[1]),b=p("2.48.0"); let ok=true; for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0)){ok=(a[i]||0)>(b[i]||0);break}} process.exit(ok?0:1)' "$GH_VERSION" ||
  fail "GitHub CLI 2.48.0 or newer is required"

mkdir -p "$COPILOT_HOME/skills" "$COPILOT_HOME/extensions"

if [ -d "$SKILL_DIR/.git" ]; then
  printf 'Updating guided-pr-review...\n'
  git -C "$SKILL_DIR" fetch "$REPO_URL" "$REF"
  git -C "$SKILL_DIR" merge --ff-only FETCH_HEAD
  git -C "$SKILL_DIR" remote set-url origin "$REPO_URL"
elif [ -e "$SKILL_DIR" ]; then
  fail "$SKILL_DIR already exists and is not a git checkout"
else
  printf 'Installing guided-pr-review...\n'
  git clone --depth 1 --branch "$REF" --single-branch "$REPO_URL" "$SKILL_DIR"
fi

if [ -e "$EXTENSION_DIR" ] && {
  [ ! -d "$EXTENSION_DIR" ] ||
  [ ! -f "$EXTENSION_DIR/extension.mjs" ] ||
  ! grep -q "guided-pr-review" "$EXTENSION_DIR/extension.mjs"
}; then
  fail "$EXTENSION_DIR already exists and does not look like guided-pr-review"
fi

mkdir -p "$EXTENSION_DIR"
cp "$EXTENSION_SOURCE/extension.mjs" "$EXTENSION_DIR/extension.mjs"
cp "$EXTENSION_SOURCE/copilot-extension.json" "$EXTENSION_DIR/copilot-extension.json"

printf '\nInstalled:\n  skill:     %s\n  extension: %s\n\n' "$SKILL_DIR" "$EXTENSION_DIR"
printf 'Start a new Copilot session, then ask:\n'
printf '  Use /guided-pr-review to walk me through https://github.com/owner/repo/pull/123\n'
