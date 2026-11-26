// tools/confronto/dati/misure.d.mts: i tipi di misure.mjs, per la pagina scheletri/ (scheletri/scheletri.ts), controllata da tsc.
// Dipende da: misure.mjs. Usato da: scheletri/scheletri.ts.

export type Bordo = 'top' | 'bottom' | 'left' | 'right';
export interface Caso {
  v: string;
  a: [string, Bordo];
  b: [string, Bordo];
  turni?: string[];
  fattore?: number;
  prima?: Record<string, string>;
  piu?: string[];
  nonUguale?: string;
  diffSpiegata?: string;
  nota?: string;
}
export interface Momento { id: string; atteso?: string; passi: [string, string][] }
export interface Bordi { top: number; bottom: number; left: number; right: number }
export interface Lettura { misura: number; a: Bordi; b: Bordi }

export const VISTE_PROVA: string[];
export const MOMENTI: Momento[];
export const CASI: Caso[];
export const NON_PROVABILI: { v: string; motivo: string }[];
export const LEGGI: (arg: { casi: Caso[] }) => (Lettura | null)[];
export const IMPOSTA: (arg: { valori: Record<string, string | null> }) => void;
