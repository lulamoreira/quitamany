import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Safe wrapper around date-fns' formatDistanceToNow.
 * Returns "" for null/undefined/invalid dates instead of throwing RangeError.
 */
export function formatRelative(
  value: string | number | Date | null | undefined,
  opts: { addSuffix?: boolean } = { addSuffix: true },
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { locale: ptBR, addSuffix: opts.addSuffix ?? true });
  } catch {
    return "";
  }
}
