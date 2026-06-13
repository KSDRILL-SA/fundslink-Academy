import { describe, expect, it } from 'vitest';

import { slugify } from './strings';

describe('slugify', () => {
  it('lowercases and hyphenates whitespace', () => {
    expect(slugify('FundsLink Academy')).toBe('fundslink-academy');
  });

  it('strips punctuation and accents', () => {
    expect(slugify('Café  & Crème!')).toBe('cafe-creme');
  });
});
