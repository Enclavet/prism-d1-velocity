/**
 * Converts a string to a URL-safe slug
 *
 * @param text - The input string to slugify
 * @returns A URL-safe slug string
 *
 * @example
 * slugify('Hello World!') // returns 'hello-world'
 * slugify('Café & Crème') // returns 'cafe-creme'
 * slugify('  Multiple---Hyphens  ') // returns 'multiple-hyphens'
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD') // Decompose unicode characters (é -> e + ́)
    .replace(/[̀-ͯ]/g, '') // Remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '') // Strip special characters (keep letters, numbers, spaces, underscores, hyphens)
    .replace(/[\s_]+/g, '-') // Replace whitespace and underscores with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens into one
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
