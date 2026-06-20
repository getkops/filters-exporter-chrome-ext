import { describe, it, expect } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { detectLocale, getMessages } from './index';

describe('detectLocale', () => {
  it('maps French language tags to fr and everything else to en', () => {
    expect(detectLocale('fr')).toBe('fr');
    expect(detectLocale('fr-FR')).toBe('fr');
    expect(detectLocale('FR-ca')).toBe('fr');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de')).toBe('en');
    expect(detectLocale('')).toBe('en');
  });
});

describe('catalog parity', () => {
  it('en and fr declare exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('every value has the same type (string vs function) across locales', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof fr[key]).toBe(typeof en[key]);
    }
  });
});

describe('message rendering', () => {
  it('pluralizes per locale', () => {
    expect(en.captured(1)).toBe('1 captured');
    expect(en.toastExported(1)).toBe('Exported 1 filter');
    expect(en.toastExported(3)).toBe('Exported 3 filters');
    expect(fr.captured(1)).toBe('1 capturé');
    expect(fr.captured(3)).toBe('3 capturés');
    expect(fr.toastExported(2)).toBe('2 filtres exportés');
  });

  it('substitutes params', () => {
    expect(en.selectedOf(2, 10)).toBe('2 of 10 selected');
    expect(fr.selectedOf(2, 10)).toBe('2 sur 10 sélectionnés');
    expect(en.errParse(1)).toBe('1 warning during capture');
    expect(en.errParse(4)).toBe('4 warnings during capture');
    expect(getMessages('fr').exportN(5)).toBe('Exporter 5');
  });
});
