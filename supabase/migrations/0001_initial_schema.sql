-- ============================================================
-- Schema inicial: platillos, variantes, feedback
--
-- Principios:
--   * Catálogo normalizado (1 platillo -> N variantes).
--   * ingredientes_es y alergenos viven como JSONB porque su
--     shape (array de strings) coincide con el CSV original.
--   * RLS activo en las 3 tablas:
--       - platillos/variantes: SELECT abierto a anon,
--         INSERT/UPDATE/DELETE cerrados desde el cliente.
--       - feedback: INSERT abierto a anon (anónimo),
--         SELECT cerrado (solo service_role lo lee).
-- ============================================================


-- ---------------------------
-- Tipos enumerados
-- ---------------------------

CREATE TYPE nivel AS ENUM ('bajo', 'medio', 'alto');

CREATE TYPE categoria AS ENUM (
  'platillo fuerte',
  'antojito',
  'sopa/caldo',
  'botana',
  'bebida',
  'postre',
  'desayuno',
  'pan/antojito dulce'
);

CREATE TYPE tipo_estructura AS ENUM (
  'cerrado_con_relleno',
  'abierto_con_toppings',
  'caldo',
  'guiso',
  'pan_relleno',
  'tortilla_rellena',
  'antojito_frito',
  'bebida',
  'postre'
);


-- ---------------------------
-- platillos (214 filas)
-- ---------------------------

CREATE TABLE platillos (
  id_platillo              TEXT PRIMARY KEY,
  nombre_es                TEXT NOT NULL,
  categoria                categoria NOT NULL,
  subcategoria             TEXT NOT NULL,
  estado_tipico            TEXT NOT NULL,
  region_tipica            TEXT NOT NULL,
  descripcion_es           TEXT NOT NULL,
  tipo_estructura          tipo_estructura NOT NULL,
  personalizable           BOOLEAN NOT NULL,
  nivel_picante_base       nivel NOT NULL,
  riesgo_digestivo_base    nivel NOT NULL,
  nota_cultural_es         TEXT NOT NULL,
  recomendacion_turista_es TEXT NOT NULL,
  activo                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platillos_estado_tipico ON platillos (estado_tipico);
CREATE INDEX idx_platillos_categoria     ON platillos (categoria);
CREATE INDEX idx_platillos_activos       ON platillos (id_platillo) WHERE activo;


-- ---------------------------
-- variantes (190 filas)
-- ---------------------------

CREATE TABLE variantes (
  id_variante         TEXT PRIMARY KEY,
  id_platillo         TEXT NOT NULL REFERENCES platillos(id_platillo) ON DELETE CASCADE,
  nombre_variante_es  TEXT NOT NULL,
  tipo_variante       TEXT NOT NULL,
  ingredientes_es     JSONB NOT NULL,
  alergenos           JSONB NOT NULL,
  contiene_cerdo      BOOLEAN NOT NULL,
  contiene_mariscos   BOOLEAN NOT NULL,
  contiene_lacteos    BOOLEAN NOT NULL,
  contiene_gluten     BOOLEAN NOT NULL,
  contiene_alcohol    BOOLEAN NOT NULL,
  apto_vegetariano    BOOLEAN NOT NULL,
  apto_vegano         BOOLEAN NOT NULL,
  nivel_picante       nivel NOT NULL,
  riesgo_digestivo    nivel NOT NULL,
  observaciones_es    TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ingredientes_es_array CHECK (jsonb_typeof(ingredientes_es) = 'array'),
  CONSTRAINT alergenos_array       CHECK (jsonb_typeof(alergenos) = 'array')
);

CREATE INDEX idx_variantes_id_platillo       ON variantes (id_platillo);
CREATE INDEX idx_variantes_alergenos_gin     ON variantes USING GIN (alergenos);
CREATE INDEX idx_variantes_ingredientes_gin  ON variantes USING GIN (ingredientes_es);


-- ---------------------------
-- feedback (anónimo)
-- ---------------------------

CREATE TABLE feedback (
  id          BIGSERIAL PRIMARY KEY,
  variante_id TEXT NOT NULL REFERENCES variantes(id_variante) ON DELETE CASCADE,
  util        BOOLEAN NOT NULL,
  perfil_hash TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_variante_id ON feedback (variante_id);
CREATE INDEX idx_feedback_created_at  ON feedback (created_at DESC);


-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE platillos ENABLE ROW LEVEL SECURITY;
ALTER TABLE variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback  ENABLE ROW LEVEL SECURITY;

-- Catálogo: SELECT público. INSERT/UPDATE/DELETE sin policy = bloqueado.
CREATE POLICY platillos_select_public
  ON platillos
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY variantes_select_public
  ON variantes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Feedback: INSERT abierto. Sin policy de SELECT => el cliente no puede leerlo.
CREATE POLICY feedback_insert_anonimo
  ON feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
