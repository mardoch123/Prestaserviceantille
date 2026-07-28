import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Vérifie si un pack est le "Pack Sérénity" qui ne doit jamais
 * apparaître dans les interfaces clientes de réservation automatique.
 * La détection est insensible à la casse et aux accents.
 */
export function isPackSerenity(pack: { name?: string } | null | undefined): boolean {
  if (!pack?.name) return false;
  const n = pack.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return n.includes('serenit');
}
