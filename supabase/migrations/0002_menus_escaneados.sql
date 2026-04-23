-- ============================================================
-- Cache de escaneos de menús
--
-- Evita llamar a Gemini visión múltiples veces con la misma
-- imagen. El cliente calcula SHA-256 del base64, consulta la
-- tabla; si hay hit, usa los items cacheados; si no, llama al
-- LLM y hace upsert.
--
-- RLS: SELECT + INSERT públicos. Escritura es fire-and-forget;
-- un atacante podría insertar basura, pero el impacto es que
-- la próxima consulta con ese hash específico devuelve basura
-- (no puede leer perfiles ni catálogo). Aceptable para MVP.
-- ============================================================

-- Enum distinto a `nivel` porque los valores son de otra familia
-- (alta/media/baja vs alto/medio/bajo) — evita mapeo cliente/servidor.
CREATE TYPE confianza_ocr AS ENUM ('alta', 'media', 'baja');

CREATE TABLE menus_escaneados (
  hash_imagen   TEXT PRIMARY KEY,
  items         JSONB NOT NULL,
  confianza_ocr confianza_ocr NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT items_array CHECK (jsonb_typeof(items) = 'array')
);

CREATE INDEX idx_menus_escaneados_created ON menus_escaneados (created_at DESC);

ALTER TABLE menus_escaneados ENABLE ROW LEVEL SECURITY;

CREATE POLICY menus_escaneados_select_public
  ON menus_escaneados
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY menus_escaneados_insert_public
  ON menus_escaneados
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
