# Avance de `mexfood-core`

Registro por día de lo terminado. Sirve para el equipo y para retrospectiva.

---

## Día 1 — 2026-04-17 · Scaffold

- Monorepo npm workspaces con TS project references (`composite: true`).
- Packages iniciales: `@core/types`, `@core/parser`.
- Parser de CSV → `Catalogo` con validación estricta de filas.
- Migraciones SQL de Supabase (`platillos`, `variantes`, `feedback`) + RLS.
- Script `scripts/seed-supabase.ts` con `--dry` idempotente por upsert.
- 60 tests en parser (unit + integración contra los CSV reales).

## Día 2 — 2026-04-18 · @core/data y hard filters

- Paquete `@core/data` con `fetchCatalogo`, cache local (StorageAdapter
  inyectable, TTL 7d), `registrarFeedback` (nunca lanza). Fake Supabase y
  fake AsyncStorage para tests.
- `@core/recomendador` primer release: `aplicarHardFilters`, `cumpleDieta`,
  `dietaEfectiva`. Precedencia vegano > pescetariano > vegetariano
  correctamente codificada.
- 30 tests en data, 42 en recomendador. **132 tests totales.**
- Fix: `tsc --build --noEmit` falla con composite; se cambió a `tsc --build`.

## Día 2.5 — 2026-04-18 · Documentación para onboarding

- README raíz (setup, estructura, comandos, uso desde el front, testing).
- README por paquete (`parser`, `data`, `recomendador`) con API,
  decisiones no obvias y tests.

## Día 3 — 2026-04-19 · Scoring y recomendación ordenada

- `calcularMatchScore`: score 0-100, clamp, semáforo verde/amarillo/naranja/rojo.
- Pesos soft expuestos en `PESOS` (picante, digestivo, ingredientesEvitar
  con tope -30, ingredientesFavoritos con tope +15, bonus regional +10).
- `recomendarPlatillos`: orden por score desc, diversificación (máx 1
  variante por `platilloId` en top N), listas separadas de
  recomendados / evitar, con fallback para rellenar top N si hace falta.
- 27 tests de scoring, 14 de `recomendarPlatillos`. **173 tests totales.**

## Día 4 — 2026-04-20 · LLM end-to-end

- Paquete `@core/llm`:
  - `crearLlmClient`: factory con timeout via `AbortController`, `fetch`
    inyectable (para RN y tests), validación de forma.
  - `generarExplicacion` y `generarFrasesParaPedir`: async, **nunca lanzan**;
    caen a `plantillaExplicacion` / `plantillaFrases` si el LLM falla.
  - Plantillas puras, deterministas, expuestas para uso del front offline.
- Edge Function Deno en `supabase/functions/llm/index.ts`: proxy a Gemini
  2.5 Flash con `responseMimeType: application/json`, prompts estructurados
  para `explicar` y `frases`. Parse defensivo con strip de code fences.
- 30 tests en `@core/llm` (plantillas, cliente con fake fetch, fallback en
  todos los modos de fallo). **203 tests totales.**
- **Deploy en vivo:**
  - Supabase CLI instalado (scoop).
  - Proyecto linkeado: `pnrqjefkhcgwreqqqfiu`.
  - Secrets: `GEMINI_API_KEY` (rotar cuando se pueda — quedó en transcript)
    y `LLM_TIMEOUT_MS=12000`.
  - Edge function desplegada con `--no-verify-jwt`.
  - Smoke test de `explicar` y `frases` ok contra Gemini real.

## Día 5 — 2026-04-21 · Gemini Flash Lite + demo end-to-end

- Cambio de modelo por default de `gemini-2.5-flash` a `gemini-2.5-flash-lite`
  (más barato y aún más rápido para el tamaño de prompts que usamos).
  Actualizado en `supabase/functions/llm/index.ts`, `.env.example`,
  `packages/llm/README.md`. Redeploy de la edge function con `--no-verify-jwt`.
  Smoke test ok en `explicar` y `frases`.
- `GEMINI_API_KEY` rotada (la vieja quedó en transcript de Día 4).
- Nuevo `scripts/demo.ts` + `npm run demo`: carga catálogo real de Supabase,
  corre `recomendarPlatillos` con un perfil de ejemplo (turista vegetariano
  en Oaxaca, picante bajo, alergia a cacahuate), y llama al LLM para
  explicación del top 1 + frases para pedirlo. Imprime tiempos por etapa
  y el flag `fuente: llm | plantilla`.
- Típico resultado: 214 platillos + 190 variantes cargados en ~1.3s,
  recomendación en 3ms, LLM ~2.5s por llamada. Sirve como smoke test
  manual end-to-end y como material para la demo del hackathon.

---

## Estado global

- **Capa de lógica (parser, data, recomendador, llm):** feature-complete
  para el MVP del hackathon.
- **Tests:** 203 pasando, cero dependencias externas en recomendador/llm,
  mocks puros para data/parser.
- **Infra:** Supabase con schema + seed + edge function LLM desplegada.
  El front ya puede consumir todo sin bloqueos.

## Pendiente opcional

- Parametrizar `scripts/demo.ts` para aceptar perfiles alternos vía
  CLI args o JSON (hoy el perfil está hardcoded).
- Tests de integración reales (catálogo real + edge function real) —
  sin meterlos al pipeline por costo/flakiness de Gemini.
