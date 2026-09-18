# Rattrapage upstream v1.2 — fork `bbossa/grimoire`

Contexte : ce dépôt est un fork de [`goniszewski/grimoire`](https://github.com/goniszewski/grimoire),
utilisé ici pour appliquer des correctifs de vulnérabilités détectées par Trivy avant
redéploiement sur le NAS. Le upstream a publié la **v1.2** ; ce fork est encore sur
`main` = **1.1.0** (`package.json` / `daemon/package.json`).

État constaté au moment de la rédaction de ce fichier :

- Un seul remote configuré : `origin` → `git@github.com:bbossa/grimoire.git` (le fork).
  **Pas de remote `upstream`** pointant vers `goniszewski/grimoire` — à ajouter (étape 1).
- Branche `main` : propre, à jour avec `origin/main` (dernier commit `10e68e3`).
- Branche `fix/security-cve-2026-09` (sur `origin`, **non fusionnée dans `main`**) :
  contient 1 commit local, `fbc3f7f — fix: patch Debian base image and Node dependency CVEs`,
  qui corrige des CVE remontées par Trivy :
  - `apt-get upgrade` ajouté dans le `Dockerfile` (stage runtime, CVE OS Debian)
  - overrides npm/bun : `fast-uri@^3.1.3`, `fast-xml-builder@^1.1.7`,
    `fast-xml-parser@^5.5.6`, `ip-address@^10.3.1`, `path-to-regexp@^8.4.0`
  - `hono` remonté à `^4.12.25`

Objectif : intégrer la v1.2 upstream **sans perdre** le patch CVE local, revalider avec
Trivy, puis redéployer sur le NAS.

### Diagnostic déjà fait (remote `upstream` ajouté et fetché)

- `upstream/main` est 20 commits devant `main` (browser companion TASK-138, Homebrew/
  renommage CLI, fix recherche, `fix(deps): remediate release dependency advisories`,
  préparation release 1.2.0).
- `hono`, `fast-uri`, `ip-address`, `path-to-regexp` sont déjà bumpés par upstream à des
  versions **≥** celles de nos overrides locaux → **à supprimer** de
  `daemon/package.json` après le merge (upstream couvre déjà ces CVE).
- `fast-xml-builder` / `fast-xml-parser` **ont disparu de l'arbre de dépendances** en
  v1.2.0 → override devenu inutile, **à supprimer**.
- Le `Dockerfile` n'a **pas bougé** entre `main` et `v1.2.0` : le correctif
  `apt-get upgrade` (CVE OS Debian) du commit `fbc3f7f` reste nécessaire, à conserver
  tel quel après le merge.
- v1.2.0 ajoute ses propres overrides (`@hono/node-server`, `body-parser`, `qs`) — à
  garder.
- Changements sensibles à retester après merge : `react-router-dom` 6→7, `vite` 5→6,
  `vitest` 3→4.

---

## 1. Ajouter le remote upstream (une seule fois) — ✅ déjà fait

```bash
git remote add upstream https://github.com/goniszewski/grimoire.git
git remote -v   # vérifier que origin = bbossa/grimoire et upstream = goniszewski/grimoire
```

## 2. Récupérer l'historique upstream et mesurer le retard

```bash
git fetch upstream --tags
git log --oneline main..upstream/main          # commits upstream absents de main
git tag -l 'v1.2*'                              # confirmer le tag de la 1.2
git log --oneline main..upstream/main -- Dockerfile daemon/package.json daemon/bun.lock
```

Regarder en particulier si upstream a déjà bougé les mêmes dépendances
(`hono`, `fast-uri`, `fast-xml-parser`, `ip-address`, `path-to-regexp`) ou touché le
`Dockerfile` runtime stage : ça donne une idée des conflits à attendre à l'étape 4.

## 3. Mettre à jour `main` depuis upstream

Travailler sur une branche dédiée plutôt que directement sur `main` :

```bash
git checkout -b sync/upstream-v1.2 main
git merge upstream/main --no-edit
```

En cas de conflits, les résoudre normalement (`git status`, éditer, `git add`,
`git merge --continue`). Les fichiers les plus probables : `daemon/package.json`,
`daemon/bun.lock`, `Dockerfile`, `CHANGELOG.md`, `package.json`.

## 4. Réappliquer le correctif CVE local par-dessus la v1.2

```bash
git merge origin/fix/security-cve-2026-09 --no-edit
```

- Si upstream a déjà corrigé une des CVE listées ci-dessus avec une version égale ou
  supérieure à celle du patch local, garder la version upstream (plus récente) et
  laisser tomber l'override correspondant dans `daemon/package.json`.
- Si upstream n'a pas encore corrigé une CVE, garder l'override local.
- Vérifier `Dockerfile` : la ligne `apt-get update && apt-get upgrade -y && apt-get install -y`
  doit être présente dans le stage runtime après le merge (upstream aurait pu la
  réécrire sans le `upgrade -y`).

## 5. Réinstaller les dépendances et vérifier le lockfile

```bash
bun install --frozen-lockfile        # à la racine
cd daemon && bun install --frozen-lockfile && cd ..
git diff --stat                      # s'assurer que bun.lock reflète bien le merge
```

## 6. Revalider avec Trivy avant de builder l'image finale

```bash
# scan du filesystem (dépendances Node/Bun)
trivy fs --severity HIGH,CRITICAL .

# build de l'image candidate puis scan de l'image
docker build -t grimoire:v1.2-catchup .
trivy image --severity HIGH,CRITICAL grimoire:v1.2-catchup
```

Objectif : confirmer que les CVE du commit `fbc3f7f` restent corrigées et qu'aucune
nouvelle vulnérabilité n'a été introduite par la v1.2 upstream.

## 7. Tests

```bash
bun run lint
bun test               # ou la commande de test spécifique au projet, cf. CONTRIBUTING.md
```

## 8. Finaliser sur `main` et pousser sur le fork

```bash
git checkout main
git merge sync/upstream-v1.2 --no-edit
git push origin main
git branch -d sync/upstream-v1.2
# la branche fix/security-cve-2026-09 est maintenant fusionnée : possibilité de la
# supprimer côté origin une fois le déploiement validé
git push origin --delete fix/security-cve-2026-09
```

## 9. Redéploiement sur le NAS

```bash
# sur le NAS (ou poste qui buide l'image utilisée par le NAS)
git pull origin main
docker compose build --no-cache
docker compose up -d
docker compose ps
curl -f http://localhost:3210/health
docker compose logs -f grimoire   # vérifier l'absence d'erreurs au démarrage
```

Après redémarrage, relancer un scan Trivy sur l'image effectivement déployée pour
clore la boucle :

```bash
trivy image --severity HIGH,CRITICAL $(docker inspect --format='{{.Image}}' grimoire)
```

---

## Points de vigilance

- **Ordre merge upstream puis merge branche CVE** (étapes 3 puis 4) plutôt que l'inverse :
  ça évite de re-résoudre les mêmes conflits deux fois si upstream a touché les mêmes
  fichiers.
- Si `bun.lock` génère trop de conflits texte, le régénérer après resolution des
  `package.json` (`rm daemon/bun.lock && cd daemon && bun install`) plutôt que de
  merger le lockfile ligne à ligne.
- Vérifier `CHANGELOG.md` et les numéros de version (`package.json`,
  `daemon/package.json`) sont bien alignés sur 1.2.0 après le merge upstream.
- Garder trace des overrides CVE encore nécessaires après la 1.2 dans un commit dédié
  (comme `fbc3f7f`) pour faciliter le prochain rattrapage.
