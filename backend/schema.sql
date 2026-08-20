-- ════════════════════════════════════════════════════════════════
--  Schéma DMgp. Idempotent : rejoué sans risque à chaque démarrage.
-- ════════════════════════════════════════════════════════════════

-- Les identifiants clients viennent d'une séquence, jamais d'un COUNT.
-- Une séquence ne recule pas : supprimer un client ne peut plus
-- provoquer la réattribution d'un GP-ID déjà utilisé.
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
