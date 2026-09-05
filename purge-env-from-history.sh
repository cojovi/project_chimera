#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Purge the committed .env (which carries a live Mailgun API key and a
# service_role key for a now-deleted Supabase project) from EVERY commit on
# EVERY branch of this repo.
#
# This REWRITES HISTORY. Every commit SHA after 9ae26db changes, on all
# branches (main, killswitch, multiple). Anyone else with a clone must re-clone.
#
# A full backup was taken first: BACKUP-before-history-rewrite.bundle
# Restore with:  git clone BACKUP-before-history-rewrite.bundle restored-repo
#
# IMPORTANT: purging history does NOT un-leak the key. The repo has been public;
# assume the key is compromised. REVOKE IT IN THE MAILGUN DASHBOARD FIRST.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "$(git status --porcelain)" ]; then
  echo "!! working tree is dirty — commit or stash first, then re-run." >&2
  exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1 && ! python3 -c 'import git_filter_repo' 2>/dev/null; then
  echo "installing git-filter-repo…"
  pip3 install --user git-filter-repo || brew install git-filter-repo
fi

echo "==> purging .env from all history"
git filter-repo --force --invert-paths --path .env

echo
echo "==> verifying the key is gone"
# Grep for an ASSIGNED secret value, not the bare variable name — the name
# legitimately appears in this script and in the v1 edge functions that read
# it from the environment, which would make this check cry wolf.
if git rev-list --all \
   | while read -r c; do
       git grep -lE '(MAILGUN_API_KEY|SUPABASE_SERVICE_ROLE_KEY)[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9._-]{16}' "$c" 2>/dev/null
     done | grep -q .; then
  echo "!! an assigned secret is still present — do NOT push. Investigate." >&2
  exit 1
fi
if git log --all --oneline -- .env | grep -q .; then
  echo "!! .env is still in history — do NOT push. Investigate." >&2
  exit 1
fi
echo "   clean: no assigned secrets, and .env is gone from every commit"

echo
echo "==> git-filter-repo drops the remote by design. Re-add and force-push:"
echo
echo "    git remote add origin https://github.com/cojovi/project_chimera.git"
echo "    git push --force --all origin"
echo "    git push --force --tags origin"
echo
echo "Then, on GitHub: Settings → scroll down → 'Delete all caches' is not a"
echo "thing, so open a support request to purge the cached blob, OR simply"
echo "accept that the old commit stays reachable via its SHA until GitHub GCs."
echo "Rotating the key remains the only real remediation."
