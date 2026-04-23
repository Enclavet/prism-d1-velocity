import { slugify } from '../src/lib/slugify';

describe('slugify', () => {
  it('converts basic strings to lowercase slugs', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('UPPERCASE TEXT')).toBe('uppercase-text');
  });

  it('handles unicode characters with diacritics', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('naïve')).toBe('naive');
    expect(slugify('Zürich')).toBe('zurich');
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
  });

  it('strips special characters', () => {
    expect(slugify('Hello@World!')).toBe('helloworld');
    expect(slugify('Test & Development')).toBe('test-development');
    expect(slugify('Price: $99.99')).toBe('price-9999');
    expect(slugify('C++ Programming')).toBe('c-programming');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('Multiple---Hyphens')).toBe('multiple-hyphens');
    expect(slugify('Too -- Many -- Dashes')).toBe('too-many-dashes');
    expect(slugify('a----b----c')).toBe('a-b-c');
  });

  it('replaces whitespace with hyphens', () => {
    expect(slugify('Spaces   Between   Words')).toBe('spaces-between-words');
    expect(slugify('Tab\tSeparated\tText')).toBe('tab-separated-text');
    expect(slugify('Line\nBreak')).toBe('line-break');
  });

  it('replaces underscores with hyphens', () => {
    expect(slugify('snake_case_text')).toBe('snake-case-text');
    expect(slugify('multiple___underscores')).toBe('multiple-underscores');
  });

  it('trims leading and trailing whitespace and hyphens', () => {
    expect(slugify('  Leading and trailing  ')).toBe('leading-and-trailing');
    expect(slugify('---Hyphens---')).toBe('hyphens');
    expect(slugify('  ---Mixed---  ')).toBe('mixed');
  });

  it('handles empty and whitespace-only strings', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('---')).toBe('');
  });

  it('handles strings with only special characters', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
    expect(slugify('***')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Article 123')).toBe('article-123');
    expect(slugify('2024 Annual Report')).toBe('2024-annual-report');
  });

  it('handles complex real-world examples', () => {
    expect(slugify('PRISM D1: Velocity — AI Development')).toBe('prism-d1-velocity-ai-development');
    expect(slugify('Node.js & TypeScript: A Guide')).toBe('nodejs-typescript-a-guide');
    expect(slugify('São Paulo, Brazil (2024)')).toBe('sao-paulo-brazil-2024');
  });
});
