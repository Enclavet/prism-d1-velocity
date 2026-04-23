/**
 * Truncates a string to a specified length, adding '...' if truncated
 *
 * @param text - The input string to truncate
 * @param maxLength - Maximum length of the output string (including ellipsis)
 * @returns The truncated string with '...' appended if truncation occurred
 *
 * @example
 * truncate('Hello World', 8) // returns 'Hello...'
 * truncate('Short', 10) // returns 'Short'
 * truncate('', 5) // returns ''
 */
export function truncate(text: string, maxLength: number): string {
  if (maxLength < 0) {
    throw new Error('maxLength must be non-negative');
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength < 3) {
    return text.slice(0, maxLength);
  }

  return text.slice(0, maxLength - 3) + '...';
}
