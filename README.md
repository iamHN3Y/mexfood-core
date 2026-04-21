# mexfood-core

Motor de recomendación de comida mexicana para turistas (hackathon FIFA 2026).
Este repo contiene **la capa de lógica + persistencia** que consume la app móvil
(React Native/Expo, en otro repo).

---

## 1. Qué hay acá (y qué no)

**Acá:**

- Parseo del dataset CSV (214 platillos + 190 variantes).
- Cliente de Supabase: `fetchCatalogo`, cache local, `registrarFeedback`.
- Motor de recomendación: reglas puras de compatibilidad (hard filters y,
  próximamente, soft filters + scoring).
- Migraciones SQL y script de seed.

**No acá:**

- UI, navegación, componentes de React Native. Viven en otro repo.
- El LLM (Gemini) se llamará desde una Edge Function de Supabase —
  todavía no está.

Documentos de referencia:

- [CONTEXT.md](CONTEXT.md) — contexto y decisiones de producto.
- [API_CONTRACT.md](API_CONTRACT.md) — contrato público que el front consume.

---

## 2. Setup en máquina nueva

Requisitos: **Node 20+** (este repo usa 24.15 en dev), **git**, y una cuenta de
Supabase para el proyecto (ya provisionada — pedir acceso al team lead).

```bash
git clone https://github.com/iamHN3Y/mexfood-core.git
cd mexfood-core
npm install
cp .env.example .env        # y rellenar con las 3 claves de Supabase
```

Las claves viven en [Settings → API Keys](https://supabase.com/dashboard) del
proyecto:

| Variable                    | Qué es                              | Dónde se usa                           |
| --------------------------- | ----------------------------------- | -------------------------------------- |
| `SUPABASE_URL`              | URL pública                         | Todo                                   |
| `SUPABASE_ANON_KEY`         | "publishable" — segura en cliente   | `@core/data` en producción             |
| `SUPABASE_SERVICE_ROLE_KEY` | "secret" — NUNCA al cliente ni repo | Solo `scripts/seed-supabase.ts` en dev |

`.env` está en `.gitignore`. No subir credenciales al repo, ni pegarlas en
Slack/chat si no es necesario.

---

## 3. Estructura del monorepo

```
mexfood-core/
├── packages/                    ← librerías publicadas como @core/*
│   ├── types/                   ← tipos compartidos (Perfil, Catalogo, Recomendacion…)
│   ├── parser/                  ← CSV → Catalogo (usado por el seed)
│   ├── data/                    ← cliente Supabase (fetchCatalogo, cache, feedback)
│   ├── recomendador/            ← motor de reglas (hard filters + scoring + orden)
│   └── llm/                     ← cliente Edge Function (explicaciones, frases) + plantillas
│
├── supabase/functions/llm/      ← Edge Function Deno (proxy a Gemini)
│
├── data/                        ← dataset CSV origen
│   ├── platillos.csv
│   └── variantes_platillo.csv
│
├── supabase/                    ← migraciones y (futuras) Edge Functions
│   ├── migrations/
│   └── README.md                ← cómo aplicar el schema y RLS
│
├── scripts/
│   └── seed-supabase.ts         ← poblar las tablas desde los CSV
│
├── API_CONTRACT.md              ← contrato público (leer antes de tocar firmas)
├── CONTEXT.md                   ← por qué el proyecto existe y decisiones
├── tsconfig.base.json           ← config TS compartida
├── tsconfig.json                ← orquestador de project references
├── vitest.config.ts             ← workspace de tests (un proyecto por package)
└── .env.example                 ← plantilla de credenciales
```

Cada package de `packages/*` tiene su propio README con API y ejemplos:

- [@core/parser](packages/parser/README.md)
- [@core/data](packages/data/README.md)
- [@core/recomendador](packages/recomendador/README.md)
- [@core/llm](packages/llm/README.md)

---

## 4. Comandos útiles

Todo se corre desde la raíz:

| Comando                     | Qué hace                                                  |
| --------------------------- | --------------------------------------------------------- |
| `npm install`               | Instala dependencias de todos los packages                |
| `npm test`                  | Corre los 203 tests (Vitest, un proyecto por package)     |
| `npm run test:watch`        | Tests en watch mode                                       |
| `npm run typecheck`         | `tsc --build` de todo el monorepo                         |
| `npm run typecheck:scripts` | Typecheck del script de seed                              |
| `npm run format`            | Prettier: escribe cambios                                 |
| `npm run format:check`      | Prettier: solo verifica                                   |
| `npm run clean`             | Borra `dist/` y `.tsbuildinfo`                            |
| `npm run seed:dry`          | Parsea los CSV y valida — NO escribe a Supabase           |
| `npm run seed`              | Parsea y hace upsert a Supabase (requiere `SERVICE_ROLE`) |

---

## 5. Cómo el front nos va a consumir

El repo del front hará `npm link` o dep directa a estos packages. Ejemplo
minimal:

```typescript
import { crearDataClient } from "@core/data";
import { aplicarHardFilters } from "@core/recomendador";
import type { Perfil } from "@core/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 1) Crear cliente una sola vez al arrancar la app
const data = crearDataClient({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
});

// 2) Cargar catálogo (primero intenta cache local, 7 días TTL)
const catalogo = await data.fetchCatalogoConCache(AsyncStorage);

// 3) Perfil del usuario (lo arma el onboarding; vive solo en el device)
const perfil: Perfil = {
  alergias: ["cacahuate"],
  dieta: { vegano: false, vegetariano: true, pescetariano: false },
  restricciones: { sinGluten: false, sinLacteos: false },
  evitaCerdo: true,
  evitaAlcohol: false,
  evitaMariscos: false,
  toleranciaPicante: "bajo",
  estomagoSensible: true,
  ingredientesEvitar: [],
  ingredientesFavoritos: ["queso"],
  estadoActual: "Oaxaca",
  idioma: "es",
};

// 4) Filtrar variantes aptas (por ahora solo hard filters)
const aptas = catalogo.variantes
  .map((v) => ({ v, res: aplicarHardFilters(perfil, v) }))
  .filter(({ res }) => res.apto);

// 5) Feedback anónimo (nunca lanza)
await data.registrarFeedback(aptas[0].v.id, true);
```

Ahora con `@core/recomendador` completo y `@core/llm` disponible, el front
puede pedir recomendaciones ordenadas con score y luego generar la
explicación narrativa del top platillo:

```typescript
import { recomendarPlatillos } from "@core/recomendador";
import { crearLlmClient, generarExplicacion } from "@core/llm";

const { recomendados } = recomendarPlatillos(perfil, catalogo);
const top = recomendados[0];

const llm = crearLlmClient({
  url: `${process.env.SUPABASE_URL}/functions/v1/llm`,
  anonKey: process.env.SUPABASE_ANON_KEY!,
});

const platillo = catalogo.platillos.find((p) => p.id === top.platilloId)!;
const variante = catalogo.variantes.find((v) => v.id === top.varianteId)!;
const exp = await generarExplicacion(llm, perfil, top, platillo, variante);
// exp.fuente === "llm" si Gemini respondió, o "plantilla" si falló
```

---

## 6. Cómo probar lo que ya tenemos

### 6.1 Tests automatizados

```bash
npm test
```

Salida esperada: `Tests 203 passed (203)`. Cubre:

- Parser: 60 tests (incluye integración contra los CSV reales).
- Data: 30 tests (mockeando Supabase, sin red).
- Recomendador: 83 tests (hard filters, dieta, scoring, orden y evitar).
- LLM: 30 tests (plantillas, cliente con fake fetch, fallback en fallos).

### 6.2 Parseo del dataset de punta a punta (sin tocar red)

```bash
npm run seed:dry
```

Lee los CSV, corre el parser y reporta el conteo esperado:

```
Leyendo CSVs...
  214 platillos + 190 variantes
--dry-run: no se escribe a Supabase. Saliendo.
```

Si el CSV tiene una fila rota (valor inválido en un enum, booleano mal formado,
JSON mal cerrado) explota con mensaje claro indicando qué fila y qué campo.

### 6.3 Seed real a Supabase

Solo si tienes `SUPABASE_SERVICE_ROLE_KEY` en tu `.env`:

```bash
npm run seed
```

Es idempotente (usa `upsert` por `id_platillo` / `id_variante`), así que
correrlo dos veces no duplica filas.

### 6.4 Probar el cliente de data manualmente

No hay script aún; se prueba vía los tests unitarios (que usan un fake de
Supabase y un fake de `AsyncStorage`). Cuando conectemos el front o armemos un
playground, agregamos un `npm run demo`.

---

## 7. Convenciones del repo

- **Todo en español**: nombres de funciones, variables, comentarios. Tipos
  exportados mantienen los nombres del contrato (`Perfil`, `Catalogo`, etc.).
- **ESM-only**: `"type": "module"` en todos los `package.json`. Los imports
  internos van con extensión `.js` (incluso en `.ts`), porque
  `moduleResolution: "bundler"` lo requiere.
- **Sin comentarios decorativos**. Solo comentario cuando el _porqué_ no sea
  obvio del código.
- **No romper firmas públicas** después del día 5 sin avisar al front.
  Todo lo que expongas en `packages/*/src/index.ts` es contrato.

---

## 8. Git y PRs

- `main` es la rama viva. Features chicas van directo; cambios grandes o que
  afecten firmas públicas vía PR para que el front revise.
- Pre-commit NO está configurado; corran manualmente `npm run format` +
  `npm test` antes de commitear.

---

## 9. Cuando algo no compila

Orden de diagnóstico (de más probable a menos):

1. **`npm run clean && npm install`** — resuelve 80% de los problemas de
   hoist y builds incrementales stale.
2. **`npm run typecheck`** — errores claros de TS.
3. **`npm test`** — si los tests pasan pero el front rompe, probable
   descompás de versión del package local.
4. Si aparecen errores raros con `node_modules`, borrarlo y reinstalar:
   `rm -rf node_modules packages/*/node_modules && npm install`.
