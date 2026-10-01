import { toIso } from './date';
import { easterSunday, frenchHolidays } from './holidays';

describe('easterSunday', () => {
  // Dates de référence publiées par l'Église catholique.
  const references: Record<number, string> = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2030: '2030-04-21',
  };

  for (const [year, expected] of Object.entries(references)) {
    it(`tombe le ${expected}`, () => {
      expect(toIso(easterSunday(Number(year)))).toBe(expected);
    });
  }
});

describe('frenchHolidays', () => {
  it('retourne les 11 jours fériés légaux', () => {
    expect(frenchHolidays(2026).size).toBe(11);
  });

  it('place correctement les fêtes mobiles de 2026', () => {
    const holidays = frenchHolidays(2026);
    expect(holidays.get('2026-04-06')).toBe('Lundi de Pâques');
    expect(holidays.get('2026-05-14')).toBe('Ascension');
    expect(holidays.get('2026-05-25')).toBe('Lundi de Pentecôte');
  });

  it('place correctement les fêtes fixes', () => {
    const holidays = frenchHolidays(2026);
    expect(holidays.get('2026-01-01')).toBe('Jour de l’An');
    expect(holidays.get('2026-07-14')).toBe('Fête nationale');
    expect(holidays.get('2026-12-25')).toBe('Noël');
  });
});
