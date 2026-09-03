-- ════════════════════════════════════════════════════════════════
--  Schéma DMgp. Idempotent : rejoué sans risque à chaque démarrage.
-- ════════════════════════════════════════════════════════════════

-- Les identifiants clients viennent d'une séquence, jamais d'un COUNT.
-- Une séquence ne recule pas : supprimer un client ne peut plus
-- provoquer la réattribution d'un identifiant déjà utilisé. Le numéro tiré
-- ici n'est pas affiché tel quel : db.js le transforme en code lettré
-- (« GPGHWF »), seul format acceptable dans le champ « Nom » d'un marchand.
CREATE SEQUENCE IF NOT EXISTS gp_id_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  gp_id       TEXT        NOT NULL UNIQUE,
  prenom      TEXT        NOT NULL,
  nom         TEXT        NOT NULL,
  telephone   TEXT        NOT NULL,
  email       TEXT        UNIQUE,
  password    TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'client',
  -- Compteur de colis propre à chaque client, incrémenté de façon
  -- atomique : deux déclarations simultanées ne peuvent pas produire
  -- la même référence DMG-…
  colis_seq   INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ancien identifiant chiffré (« GP-1001 »), conservé après la conversion en
-- code lettré. Les colis expédiés avant le changement portent encore l'ancien
-- code : sans cette colonne, l'équipe ne pourrait plus les rattacher.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ancien_gp_id TEXT;

CREATE TABLE IF NOT EXISTS colis (
  id            SERIAL PRIMARY KEY,
  ref           TEXT        NOT NULL UNIQUE,
  client_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fournisseur   TEXT,
  num_commande  TEXT,
  tracking_num  TEXT,
  description   TEXT,
  poids         NUMERIC(8,2),
  status        TEXT        NOT NULL DEFAULT 'attente',
  photo         TEXT,
  declared_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at   TIMESTAMPTZ,
  shipped_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ
);

-- Paiement, marqué par l'équipe une fois le colis remis. Colonnes ajoutées
-- après coup : en ALTER idempotent, comme ancien_gp_id, pour que les bases
-- déjà en service se mettent à jour toutes seules au démarrage.
ALTER TABLE colis ADD COLUMN IF NOT EXISTS paye    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE colis ADD COLUMN IF NOT EXISTS paye_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  colis_id    INTEGER     REFERENCES colis(id) ON DELETE CASCADE,
  ref         TEXT,
  fournisseur TEXT,
  message     TEXT        NOT NULL,
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index sur les colonnes réellement filtrées par l'application.
CREATE INDEX IF NOT EXISTS idx_colis_client  ON colis(client_id);
CREATE INDEX IF NOT EXISTS idx_colis_status  ON colis(status);
CREATE INDEX IF NOT EXISTS idx_notifs_client ON notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);
