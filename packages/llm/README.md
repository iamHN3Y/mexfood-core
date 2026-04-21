# @core/llm

Librería cliente del Edge Function de LLM. Expone funciones async que piden
explicaciones o frases a Gemini (vía proxy en Supabase) y **siempre resuelven**:
si el LLM falla, caen a plantillas deterministas.

**Dependencias:** `@core/types` y `@core/recomendador` (para puntuar items
detectados por el escáner de menús). Cero deps externas — el transporte es
`fetch`, inyectable.

---

## API pública

```typescript
import {
  crearLlmClient,
  generarExplicacion,
  generarFrasesParaPedir,
  analizarMenu,
  plantillaExplicacion,
  plantillaFrases,
  plantillaAnalisisMenu,
} from "@core/llm";
```

### `crearLlmClient(config)`

Factory que envuelve `fetch` con timeout, auth header y validación de forma.

```typescript
const cliente = crearLlmClient({
  url: process.env.SUPABASE_URL + "/functions/v1/llm",
  anonKey: process.env.SUPABASE_ANON_KEY,
  timeoutMs: 8000, // default 8000
  fetch: customFetch, // default globalThis.fetch (útil para RN, tests)
});
```

### `generarExplicacion(cliente, perfil, recomendacion, platillo, variante)`

```typescript
const exp = await generarExplicacion(cliente, perfil, rec, platillo, variante);
// {
//   texto: "El taco al pastor es un clásico de CDMX...",
//   tipCultural?: "...",
//   advertencia?: "...",
//   fuente: "llm" | "plantilla"
// }
```

**Nunca lanza.** En timeout, error de red, HTTP 5xx, o respuesta malformada
del modelo, devuelve `plantillaExplicacion(...)` con `fuente: "plantilla"`.
El front puede mostrar un badge sutil ("explicación offline") en ese caso.

### `generarFrasesParaPedir(cliente, platillo, perfil)`

```typescript
const frases = await generarFrasesParaPedir(cliente, platillo, perfil);
// [{ fraseEs, traduccion, pronunciacionFonetica }, ...]
```

Mismas garantías: siempre devuelve ≥1 frase. Fallback determinista incluye
3 frases básicas (pedir el platillo, preguntar ingredientes, una condicional
según `toleranciaPicante` o `alergias` del perfil).

### `analizarMenu(cliente, imagenBase64, perfil, catalogo, opciones?)`

```typescript
const analisis = await analizarMenu(cliente, imagenBase64, perfil, catalogo, {
  mimeType: "image/jpeg", // opcional, default "image/jpeg"
});
// {
//   itemsDetectados: [
//     {
//       textoOriginal: "Tacos al pastor",
//       matchPlatillo?: Platillo,
//       score?: 85,
//       color?: "verde",
//       motivo: "Muy recomendable · Típico de CDMX"
//     },
//     ...
//   ],
//   confianzaOCR: "alta" | "media" | "baja"
// }
```

Manda la imagen del menú a Gemini visión (en la edge function), recibe
los nombres detectados y los matchea fuzzy contra `catalogo.platillos` +
`catalogo.variantes`. Para cada match corre `calcularMatchScore` y devuelve
score + color semáforo. `confianzaOCR` se deriva del ratio de items que
pudieron matchearse (≥70% → alta, 40-70% → media, <40% → baja).

**Nunca lanza.** Si el LLM falla, devuelve `plantillaAnalisisMenu()` —
items vacíos, confianza baja. El matching pasa localmente en el cliente
(no se manda el catálogo a Gemini), así que si el catálogo ya está
cacheado no hay roundtrip extra.

### Plantillas expuestas

`plantillaExplicacion`, `plantillaFrases` y `plantillaAnalisisMenu` son
funciones **puras** útiles para:

- Tests del front sin tocar red.
- Generar preview estático mientras el LLM carga.
- Demos offline.

---

## Contrato con la Edge Function

La librería POSTea a `${SUPABASE_URL}/functions/v1/llm` con:

```json
{ "accion": "explicar" | "frases", "datos": { ... } }
```

La edge function responde con:

```json
{ "ok": true, "datos": { ... } }
// o
{ "ok": false, "error": "mensaje" }
```

Si `ok: false` o la forma no coincide, la librería cae a plantilla.

### Payload por acción

| Acción          | `datos` incluye                                   | Respuesta `datos`                       |
| --------------- | ------------------------------------------------- | --------------------------------------- |
| `explicar`      | `perfil`, `recomendacion`, `platillo`, `variante` | `{ texto, tipCultural?, advertencia? }` |
| `frases`        | `perfil`, `platillo`                              | `{ frases: Frase[] }`                   |
| `analizar-menu` | `imagenBase64`, `mimeType?`                       | `{ items: string[] }`                   |

---

## Estado actual (2026-04-21)

**Ya está desplegado y funcionando.** El equipo NO necesita redeployar a menos
que toque el código de la edge function.

- **Endpoint vivo:** `https://pnrqjefkhcgwreqqqfiu.supabase.co/functions/v1/llm`
- **Modelo:** `gemini-2.5-flash-lite` (default)
- **Timeout:** 12s (subido desde 7s tras smoke test — `frases` a veces tarda)
- **Secrets configurados:** `GEMINI_API_KEY`, `LLM_TIMEOUT_MS=12000`
- **Auth:** deploy con `--no-verify-jwt`, basta mandar `anon_key` en headers

Smoke test rápido desde la raíz del repo:

```bash
source .env
curl -sS -X POST "${SUPABASE_URL}/functions/v1/llm" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"accion":"explicar","datos":{ ... }}'
```

---

## Deploy de la Edge Function (solo si tocaste el código)

El código vive en [`supabase/functions/llm/index.ts`](../../supabase/functions/llm/index.ts).
Requiere Supabase CLI.

```bash
# 1. Configurar el secret con la API key de Gemini
supabase secrets set GEMINI_API_KEY=tu_key_aqui
#    (opcional) GEMINI_MODEL=gemini-2.5-flash-lite  LLM_TIMEOUT_MS=7000

# 2. Deploy
supabase functions deploy llm --no-verify-jwt
```

El flag `--no-verify-jwt` permite que el `anon_key` baste (sin sesión de
usuario logueado). Seguridad se apoya en Supabase RLS + rate limits.

**Modelo:** `gemini-2.5-flash-lite` por default (el más rápido y barato de la
familia 2.5). Ajustable via
env `GEMINI_MODEL`. El prompt pide JSON estructurado (`responseMimeType:
application/json`), lo que minimiza respuestas malformadas.

---

## Tests

```bash
npm test -- --project @core/llm
```

54 tests:

- `plantillas.test.ts` (9): templates deterministas, advertencias, frases
  condicionales al perfil.
- `cliente.test.ts` (8): headers de auth, serialización, timeout, errores HTTP,
  respuestas malformadas.
- `explicacion.test.ts` (7): parseo LLM, fallback a plantilla en todos los
  modos de fallo, opcionales.
- `frases.test.ts` (6): parseo, fallback, validación del array `frases`.
- `matcher.test.ts` (14): `normalizar`, `similitud` (plurales, acentos,
  stopwords), `encontrarMejorMatch` (match por platillo/variante, umbral).
- `analizar-menu.test.ts` (10): payload a edge function, happy path con
  scoring, items no encontrados, ratio → confianzaOCR, todos los fallbacks.

**No hay tests de integración contra Gemini real** — no queremos flakiness
ni gastar API calls en CI. Si necesitas validar end-to-end, corre la app
apuntando al proyecto Supabase real.

---

## Decisiones de diseño no obvias

### Siempre resuelve, nunca rechaza

Las funciones async del LLM **nunca lanzan**. Un error del modelo no debería
romper la UX: el usuario igual merece ver una explicación, aunque sea la
plantilla. El flag `fuente` permite al front mostrar un indicador si quiere.

### `fetch` inyectable

La config acepta `fetch` opcional. En RN con `fetch` polyfill extraño, o en
tests con un fake, lo inyectas. En producción usa `globalThis.fetch`.

### Prompts en la Edge Function, no en la librería

El prompt engineering cambia más rápido que las firmas. Manteniéndolo en la
edge function, podemos iterar prompts sin publicar una nueva versión de la
librería (ni hacer que el equipo actualice `npm install`).

### Gemini con `responseMimeType: application/json`

Forzamos JSON estructurado en la generación. Aún así hay un parse defensivo
(strip de code fences por si el modelo ignora la instrucción). Si el parse
falla, la librería cae a plantilla — no lanzamos al front.
