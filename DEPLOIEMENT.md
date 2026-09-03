# Déploiement DMgp

## Qui sert quoi

```
dm-gp.com        A     191.96.63.15                     Hostinger  → 301 vers www
www.dm-gp.com    CNAME dmpg-production.up.railway.app   Railway    → l'application
```

Deux hébergeurs, mais pas de conflit : ils sont chaînés. Hostinger ne fait
qu'une redirection, toute l'application tourne sur Railway.

| | Rôle |
|---|---|
| **Hostinger** | Registrar du domaine, zone DNS, et redirection de l'apex vers le www |
| **Railway** | Application (API + site), projet `humorous-fulfillment`, service `dmpg` |
| **Cloudinary** | Photos des colis — le disque de Railway est effacé à chaque déploiement |
| **Postgres (Railway)** | Base de données, via `DATABASE_URL` |

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
curl -sI https://www.dm-gp.com | grep -i last-modified
```

## Le fichier `.htaccess` de l'apex

`dm-gp.com` est un domaine addon sur le plan Hostinger, dossier
`/home/u282623197/domains/dm-gp.com/public_html`. Il ne contient qu'un fichier :

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} !^www\. [NC]
RewriteRule ^(.*)$ https://www.dm-gp.com/$1 [L,R=301]
```

La règle capture **toutes** les requêtes et conserve le chemin :
`dm-gp.com/suivi/DMG-2-001` arrive bien sur `www.dm-gp.com/suivi/DMG-2-001`.
Les QR codes et les liens de suivi fonctionnent donc avec ou sans `www`.

> **Ne pas supprimer ni vider ce fichier.** C'est la seule chose qui fait
> répondre `dm-gp.com` tapé sans `www`. Un fichier déposé à côté ne casse rien
> (la réécriture passe avant le service des fichiers), mais toucher au
> `.htaccess` lui-même coupe l'apex.

## Mettre l'apex directement sur Railway

Aujourd'hui impossible : le plan Railway n'autorise **qu'un domaine
personnalisé par service**, et `www.dm-gp.com` l'occupe.

```
$ railway domain dm-gp.com
You have reached the limit for custom domains per service on your plan.
```

Après montée de plan, la marche à suivre :

1. `railway domain dm-gp.com` — Railway renvoie l'enregistrement DNS à poser.
2. Remplacer l'enregistrement `A` de `@` (aujourd'hui `191.96.63.15`) par cette
   cible dans la zone DNS Hostinger. Le TTL est à 300 s : retour arrière en
   5 minutes si besoin.
3. Une fois l'apex servi par Railway, supprimer le domaine addon `dm-gp.com`
   côté Hostinger — il ne sert plus à rien.

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
