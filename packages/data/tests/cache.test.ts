import { CoreError } from "@core/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAVE_CACHE,
  fetchCatalogoConCache,
  TTL_DIAS_DEFAULT,
} from "../src/cache.js";
import { crearFakeSupabase, crearStorageFake } from "./fake-supabase.js";
import { filaPlatilloValida, filaVarianteValida } from "./fixtures.js";

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function supaConCatalogoMinimo() {
  return crearFakeSupabase({
    platillos: { data: [filaPlatilloValida()], error: null },
    variantes: { data: [filaVarianteValida()], error: null },
  });
}

describe("fetchCatalogoConCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve fresco desde Supabase cuando no hay cache y lo guarda", async () => {
    const { cliente } = supaConCatalogoMinimo();
    const { storage, mapa } = crearStorageFake();

    const catalogo = await fetchCatalogoConCache(cliente, storage);

    expect(catalogo.platillos).toHaveLength(1);
    const crudo = mapa.get(CLAVE_CACHE);
    expect(crudo).toBeDefined();
    const entrada = JSON.parse(crudo!) as { version: number; timestamp: number; catalogo: unknown };
    expect(entrada.version).toBe(1);
    expect(entrada.timestamp).toBe(Date.now());
  });

  it("devuelve desde cache sin tocar Supabase si la entrada es fresca", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 1,
        timestamp: Date.now() - UN_DIA_MS, // 1 día de edad, TTL=7
        catalogo: {
          platillos: [{ id: "PL_CACHE", nombre: "desde cache" }],
          variantes: [],
        },
      }),
    });

    const catalogo = await fetchCatalogoConCache(cliente, storage);
    expect(catalogo.platillos[0]?.id).toBe("PL_CACHE");
    expect(llamadas.from).toHaveLength(0);
  });

  it("ignora cache expirada (edad > ttlDias) y refetchea", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 1,
        timestamp: Date.now() - 8 * UN_DIA_MS, // expiró (TTL default = 7)
        catalogo: {
          platillos: [{ id: "PL_STALE" }],
          variantes: [],
        },
      }),
    });

    const catalogo = await fetchCatalogoConCache(cliente, storage);
    expect(catalogo.platillos[0]?.id).toBe("PL001");
    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("respeta ttlDias personalizado", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 1,
        timestamp: Date.now() - 2 * UN_DIA_MS,
        catalogo: { platillos: [{ id: "PL_CACHE" }], variantes: [] },
      }),
    });

    const catalogo = await fetchCatalogoConCache(cliente, storage, { ttlDias: 1 });
    expect(catalogo.platillos[0]?.id).toBe("PL001");
    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("forzarRefetch=true ignora cache fresca", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        catalogo: { platillos: [{ id: "PL_CACHE" }], variantes: [] },
      }),
    });

    const catalogo = await fetchCatalogoConCache(cliente, storage, { forzarRefetch: true });
    expect(catalogo.platillos[0]?.id).toBe("PL001");
    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("si cache está corrupta (JSON inválido), refetchea", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage } = crearStorageFake({ [CLAVE_CACHE]: "not json {{{" });

    await fetchCatalogoConCache(cliente, storage);
    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("si cache tiene versión distinta, refetchea", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 99,
        timestamp: Date.now(),
        catalogo: { platillos: [], variantes: [] },
      }),
    });

    await fetchCatalogoConCache(cliente, storage);
    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("si getItem falla (excepción), cae a fetch", async () => {
    const { cliente, llamadas } = supaConCatalogoMinimo();
    const { storage, errorAlLeer } = crearStorageFake();
    errorAlLeer.activo = true;

    await fetchCatalogoConCache(cliente, storage);
    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("si setItem falla, retorna el catálogo igualmente (no re-lanza)", async () => {
    const { cliente } = supaConCatalogoMinimo();
    const { storage, errorAlEscribir } = crearStorageFake();
    errorAlEscribir.activo = true;

    const catalogo = await fetchCatalogoConCache(cliente, storage);
    expect(catalogo.platillos).toHaveLength(1);
  });

  it("si Supabase falla y hay cache (aunque sea stale), devuelve la cache como fallback", async () => {
    const { cliente } = crearFakeSupabase({
      platillos: { data: null, error: { message: "down" } },
    });
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 1,
        timestamp: Date.now() - 30 * UN_DIA_MS,
        catalogo: { platillos: [{ id: "PL_STALE" }], variantes: [] },
      }),
    });

    const catalogo = await fetchCatalogoConCache(cliente, storage);
    expect(catalogo.platillos[0]?.id).toBe("PL_STALE");
  });

  it("si Supabase falla y no hay cache, re-lanza CoreError", async () => {
    const { cliente } = crearFakeSupabase({
      platillos: { data: null, error: { message: "down" } },
    });
    const { storage } = crearStorageFake();

    await expect(fetchCatalogoConCache(cliente, storage)).rejects.toBeInstanceOf(CoreError);
  });

  it("forzarRefetch con Supabase caído NO usa cache como fallback", async () => {
    const { cliente } = crearFakeSupabase({
      platillos: { data: null, error: { message: "down" } },
    });
    const { storage } = crearStorageFake({
      [CLAVE_CACHE]: JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        catalogo: { platillos: [{ id: "PL_CACHE" }], variantes: [] },
      }),
    });

    await expect(
      fetchCatalogoConCache(cliente, storage, { forzarRefetch: true }),
    ).rejects.toBeInstanceOf(CoreError);
  });

  it("TTL_DIAS_DEFAULT es 7 (constante expuesta)", () => {
    expect(TTL_DIAS_DEFAULT).toBe(7);
  });
});
