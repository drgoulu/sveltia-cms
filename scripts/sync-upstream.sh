#!/usr/bin/env bash
set -e

# ==============================================================================
# sync-upstream.sh
# Synchronise proprement le fork avec le dépôt officiel sveltia/sveltia-cms
# ==============================================================================

UPSTREAM_URL="https://github.com/sveltia/sveltia-cms.git"

echo "==> 1. Vérification de la configuration git..."

# Activer git rerere pour mémoriser les résolutions de conflits
git config rerere.enabled true

# S'assurer que le remote upstream existe
if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "    Ajout du remote upstream: $UPSTREAM_URL"
  git remote add upstream "$UPSTREAM_URL"
fi

# Vérifier que l'arbre de travail est propre
if [ -n "$(git status --porcelain)" ]; then
  echo "Erreur: Des modifications locales non commitées sont présentes."
  echo "Veuillez committer ou remiser (git stash) vos changements avant de synchroniser."
  exit 1
fi

echo "==> 2. Récupération des changements amont (git fetch upstream)..."
git fetch upstream --tags

# S'assurer d'être sur la branche main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "    Bascule sur la branche main..."
  git checkout main
fi

# Vérifier s'il y a de nouveaux commits
NEW_COMMITS=$(git rev-list --count HEAD..upstream/main)
if [ "$NEW_COMMITS" -eq 0 ]; then
  echo "==> Le fork est déjà parfaitement à jour avec upstream/main !"
  exit 0
fi

echo "==> 3. $NEW_COMMITS nouveau(x) commit(s) détecté(s) sur upstream/main."
echo "    Derniers commits amont :"
git log --oneline -n 5 upstream/main

echo "==> 4. Fusion de upstream/main dans main..."
set +e
git merge upstream/main -m "Merge remote-tracking branch 'upstream/main' into main"
MERGE_STATUS=$?
set -e

if [ $MERGE_STATUS -ne 0 ]; then
  echo ""
  echo "⚠️  Des conflits ont été détectés lors de la fusion !"
  echo "Fichiers en conflit :"
  git status --short | grep -E '^(UU|AA|DU|UD|DD|AU|UA)'
  echo ""
  echo "Veuillez résoudre les conflits, puis exécuter :"
  echo "  git add <fichiers résolus>"
  echo "  git commit"
  echo "  npm run build && npx vitest run"
  exit 1
fi

echo "==> 5. Fusion réussie sans conflit direct. Installation des dépendances si nécessaire..."
if git diff --name-only HEAD~1 HEAD | grep -qE '(package\.json|pnpm-lock\.yaml)'; then
  echo "    package.json ou pnpm-lock.yaml a changé, mise à jour des dépendances..."
  pnpm install || npm install
fi

echo "==> 6. Validation de la compilation..."
npm run build

echo "==> 7. Exécution des tests..."
npx vitest run

echo ""
echo "✅ Synchronisation avec upstream terminée et validée avec succès !"
echo "Pour publier sur votre dépôt distant, exécutez :"
echo "  git push origin main --tags"
