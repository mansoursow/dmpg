# Déploiement DMgp

## Qui sert quoi

```
dm-gp.com        ALIAS  arszvqzr.up.railway.app          Railway → l'application
www.dm-gp.com    CNAME  dmpg-production.up.railway.app   Railway → l'application
```

Les deux adresses sont servies directement par Railway. Hostinger ne fait plus
que le registrar et la zone DNS : plus aucune requête du site ne passe par lui.

| | Rôle |
|---|---|
| **Railway** | Application (API + site), projet `humorous-fulfillment`, service `dmpg` |
| **Hostinger** | Registrar du domaine et zone DNS — rien d'autre |
| **Cloudinary** | Photos des colis — le disque de Railway est effacé à chaque déploiement |
| **Postgres (Railway)** | Base de données, via `DATABASE_URL` |

L'apex utilise un `ALIAS` et non un `CNAME` : un `CNAME` à la racine d'une zone
est interdit par le DNS. Hostinger refuse d'ailleurs explicitement de faire
cohabiter un `A` et un `ALIAS` sur le même nom.

## Déployer

**`git push` ne déploie rien.** Le dépôt GitHub n'est pas connecté à Railway et
il n'y a pas de workflow CI. Le déploiement se fait à la main, depuis la racine
du projet :

```bash
railway up
```

Railway construit (`npm install && npm run build`) puis démarre (`npm start`).
Après déploiement, `Ctrl+F5` dans le navigateur : le nom du bundle change à
chaque build, mais `index.html` peut rester en cache.

Pour vérifier que la bonne version est en ligne :

```bash
curl -sI https://dm-gp.com | grep -i last-modified
```

## Historique : la bascule de l'apex (3 septembre 2026)

Avant cette date, `dm-gp.com` pointait sur un plan d'hébergement Hostinger
(`191.96.63.15`) dont le seul rôle était un `.htaccess` redirigeant vers
`www`. Le site dépendait donc de deux hébergeurs en chaîne.

La bascule, si elle doit être refaite ou comprise :

1. **Plan Railway Hobby requis** — le plan gratuit n'autorise qu'un seul
   domaine personnalisé par service, et `www` l'occupait.
2. `railway domain dm-gp.com` — Railway renvoie la cible et un TXT de
   vérification.
3. Poser le TXT `_railway-verify` (sans impact sur le trafic), attendre que
   `railway domain status <id>` affiche `Verified: yes`.
4. **Supprimer l'enregistrement `A` de `@`**, puis poser l'`ALIAS` vers la
   cible Railway. Ces deux opérations sont à enchaîner : l'apex ne répond plus
   entre les deux.
5. Attendre l'émission du certificat TLS — environ 6 minutes après la
   propagation. Tant qu'il n'est pas émis, le navigateur affiche
   `ERR_CERT_COMMON_NAME_INVALID` : c'est normal, il faut laisser faire.

La zone DNS est sauvegardée automatiquement par Hostinger à chaque
modification. En cas de problème, restaurer l'instantané précédent remet
l'état d'avant en une minute (TTL des enregistrements : 300 s).

## Reste du ménage Hostinger

Deux éléments ne servent plus à rien mais n'ont pas été supprimés :

- le **domaine addon `dm-gp.com`** et son `.htaccess` de redirection : plus
  aucun DNS ne pointe vers lui, il est inerte. Le supprimer risquerait
  d'emporter la zone DNS avec lui, donc à ne faire qu'en connaissance de cause ;
- l'enregistrement **`A ftp` → `191.96.63.15`**, inutilisé par l'application.

## Variables d'environnement (Railway)

Toutes obligatoires en production, l'application refuse de démarrer sans elles
(voir `backend/env.js`) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Injectée par le service Postgres |
| `JWT_SECRET` | Signature des jetons de session |
| `ADMIN_PASSWORD` | **Fait foi** : le mot de passe admin est réaligné dessus à chaque démarrage |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Stockage des photos |

`ADMIN_EMAIL` (défaut `admin@dmgp.fr`) et `CANONICAL_HOST` sont optionnelles.

## En local

Pas de Postgres à installer : sans `DATABASE_URL`, l'application démarre sur
PGlite dans `backend/.pgdata`. Si ce dossier se corrompt (`Aborted()` au
démarrage), le mettre de côté suffit — une base neuve est recréée :

```bash
mv backend/.pgdata backend/.pgdata.casse
```
