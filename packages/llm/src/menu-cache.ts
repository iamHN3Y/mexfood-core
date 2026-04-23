import type { EntradaMenuCache } from "@core/types";

export interface MenuCache {
  get(hashImagen: string): Promise<EntradaMenuCache | null>;
  set(hashImagen: string, entrada: EntradaMenuCache): Promise<void>;
}
