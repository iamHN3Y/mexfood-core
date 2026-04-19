import { CoreError } from "@core/types";
import { describe, expect, it } from "vitest";
import { fetchCatalogo } from "../src/catalogo.js";
import { crearFakeSupabase } from "./fake-supabase.js";
import { filaPlatilloValida, filaVarianteValida } from "./fixtures.js";

describe("fetchCatalogo", () => {
  it("lee ambas tablas y devuelve Catalogo con camelCase", async () => {
    const { cliente, llamadas } = crearFakeSupabase({
      platillos: { data: [filaPlatilloValida()], error: null },
      variantes: { data: [filaVarianteValida()], error: null },
    });

    const catalogo = await fetchCatalogo(cliente);

    expect(catalogo.platillos).toHaveLength(1);
    expect(catalogo.platillos[0]?.id).toBe("PL001");
    expect(catalogo.platillos[0]?.estadoTipico).toBe("Oaxaca");
    expect(catalogo.variantes).toHaveLength(1);
    expect(catalogo.variantes[0]?.idPlatillo).toBe("PL001");
    expect(catalogo.variantes[0]?.ingredientes).toEqual([
      "tortilla",
      "frijoles",
      "quesillo",
      "tasajo",
    ]);

    expect(llamadas.from).toEqual(["platillos", "variantes"]);
  });

  it("filtra platillos por activo=true", async () => {
    const { cliente, llamadas } = crearFakeSupabase();
    await fetchCatalogo(cliente);
    expect(llamadas.eq).toContainEqual({ tabla: "platillos", columna: "activo", valor: true });
  });

  it("lanza CoreError SUPABASE si platillos falla", async () => {
    const { cliente } = crearFakeSupabase({
      platillos: { data: null, error: { message: "connection refused" } },
    });

    await expect(fetchCatalogo(cliente)).rejects.toBeInstanceOf(CoreError);
    await expect(fetchCatalogo(cliente)).rejects.toMatchObject({
      code: "SUPABASE",
      recoverable: true,
    });
  });

  it("lanza CoreError SUPABASE si variantes falla aunque platillos haya sido OK", async () => {
    const { cliente } = crearFakeSupabase({
      platillos: { data: [filaPlatilloValida()], error: null },
      variantes: { data: null, error: { message: "timeout" } },
    });

    try {
      await fetchCatalogo(cliente);
      expect.fail("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(CoreError);
      expect((e as CoreError).code).toBe("SUPABASE");
      expect((e as CoreError).message).toMatch(/variantes/);
    }
  });

  it("lanza CoreError SUPABASE no recuperable si el mapeo falla por datos corruptos", async () => {
    const { cliente } = crearFakeSupabase({
      variantes: {
        data: [filaVarianteValida({ ingredientes_es: "tortilla" as unknown as string[] })],
        error: null,
      },
    });

    try {
      await fetchCatalogo(cliente);
      expect.fail("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(CoreError);
      expect((e as CoreError).code).toBe("SUPABASE");
      expect((e as CoreError).recoverable).toBe(false);
      expect((e as CoreError).message).toMatch(/Catálogo malformado/);
    }
  });

  it("tolera data: null retornando arrays vacíos (no debería pasar pero es defensivo)", async () => {
    const { cliente } = crearFakeSupabase({
      platillos: { data: null, error: null },
      variantes: { data: null, error: null },
    });

    const catalogo = await fetchCatalogo(cliente);
    expect(catalogo.platillos).toEqual([]);
    expect(catalogo.variantes).toEqual([]);
  });
});
