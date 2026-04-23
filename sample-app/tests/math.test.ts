import { add } from '../src/lib/math';

describe('add', () => {
  it('adds two positive integers', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(10, 20)).toBe(30);
    expect(add(100, 250)).toBe(350);
  });

  it('adds two negative integers', () => {
    expect(add(-5, -3)).toBe(-8);
    expect(add(-10, -20)).toBe(-30);
  });

  it('adds positive and negative integers', () => {
    expect(add(5, -3)).toBe(2);
    expect(add(-10, 15)).toBe(5);
    expect(add(10, -10)).toBe(0);
  });

  it('adds zero to a number', () => {
    expect(add(0, 0)).toBe(0);
    expect(add(5, 0)).toBe(5);
    expect(add(0, 5)).toBe(5);
    expect(add(-5, 0)).toBe(-5);
  });

  it('adds decimal numbers', () => {
    expect(add(0.1, 0.2)).toBeCloseTo(0.3);
    expect(add(1.5, 2.5)).toBe(4);
    expect(add(3.14, 2.86)).toBe(6);
  });

  it('adds large numbers', () => {
    expect(add(1000000, 2000000)).toBe(3000000);
    expect(add(999999999, 1)).toBe(1000000000);
  });

  it('adds very small decimal numbers', () => {
    expect(add(0.0001, 0.0002)).toBeCloseTo(0.0003);
    expect(add(0.000001, 0.000002)).toBeCloseTo(0.000003);
  });

  it('handles negative decimals', () => {
    expect(add(-1.5, -2.5)).toBe(-4);
    expect(add(-0.1, 0.3)).toBeCloseTo(0.2);
  });
});
