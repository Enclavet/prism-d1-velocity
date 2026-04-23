import { truncate } from '../src/lib/truncate';

describe('truncate', () => {
  it('returns original string if shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
    expect(truncate('Short text', 20)).toBe('Short text');
  });

  it('returns original string if exactly maxLength', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
    expect(truncate('Exactly ten', 11)).toBe('Exactly ten');
  });

  it('truncates and adds ellipsis when text exceeds maxLength', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
    expect(truncate('This is a long sentence', 10)).toBe('This is...');
    expect(truncate('PRISM D1 Velocity Workshop', 15)).toBe('PRISM D1 Vel...');
  });

  it('handles very short maxLength values', () => {
    expect(truncate('Hello', 3)).toBe('...');
    expect(truncate('Hello', 2)).toBe('He');
    expect(truncate('Hello', 1)).toBe('H');
    expect(truncate('Hello', 0)).toBe('');
  });

  it('handles empty strings', () => {
    expect(truncate('', 10)).toBe('');
    expect(truncate('', 0)).toBe('');
  });

  it('handles unicode characters correctly', () => {
    expect(truncate('Café ☕ Restaurant', 10)).toBe('Café ☕ ...');
    expect(truncate('日本語テキスト', 5)).toBe('日本...');
  });

  it('preserves whitespace in truncated portion', () => {
    expect(truncate('Hello   World', 8)).toBe('Hello...');
    expect(truncate('  Leading space', 10)).toBe('  Leadi...');
  });

  it('throws error for negative maxLength', () => {
    expect(() => truncate('Hello', -1)).toThrow('maxLength must be non-negative');
    expect(() => truncate('Test', -5)).toThrow('maxLength must be non-negative');
  });

  it('handles maxLength of exactly 3', () => {
    expect(truncate('Hello', 3)).toBe('...');
    expect(truncate('Hi', 3)).toBe('Hi');
  });

  it('handles real-world examples', () => {
    expect(truncate('This is a very long product description that needs truncation', 30))
      .toBe('This is a very long product...');
    expect(truncate('user@example.com', 12))
      .toBe('user@exam...');
    expect(truncate('Short', 50))
      .toBe('Short');
  });
});
