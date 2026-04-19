# supabase/

Migraciones y Edge Functions.

## Estructura

```
supabase/
├── migrations/
│   └── 0001_initial_schema.sql   (tablas, enums, índices, RLS)
└── functions/                    (llm-proxy, día 4+)
```

## Cómo aplicar el schema

**Opción A — SQL Editor del dashboard (hackathon-friendly):**

1. Abrir el proyecto en https://supabase.com/dashboard.
2. SQL Editor → "New query".
3. Pegar el contenido de `migrations/0001_initial_schema.sql` y ejecutar.
4. Verificar en Table Editor que aparecen `platillos`, `variantes`, `feedback`.

**Opción B — Supabase CLI:**

```bash
supabase db push
```

Requiere `supabase init` previo y `supabase link --project-ref <ref>`.

## Cómo sembrar el catálogo

Ver `scripts/seed-supabase.ts` en la raíz del repo (día 1, punto 7).

## Consideraciones de RLS

| Tabla     | SELECT (anon)     | INSERT (anon) | UPDATE / DELETE |
| --------- | ----------------- | ------------- | --------------- |
| platillos | ✅ (catálogo)     | ❌            | ❌              |
| variantes | ✅ (catálogo)     | ❌            | ❌              |
| feedback  | ❌ (solo service) | ✅ (anónimo)  | ❌              |

El cliente usa la `anon key`. Todo escrito al catálogo requiere la `service_role key`,
que vive solo en el script de seed y nunca sale del desarrollador.
