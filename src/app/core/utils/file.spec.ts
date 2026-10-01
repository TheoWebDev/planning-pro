import { toCsv } from './file';

describe('toCsv', () => {
  it('sépare les colonnes par un point-virgule et les lignes par CRLF', () => {
    expect(
      toCsv([
        ['Mois', 'Km'],
        ['Janvier', 640],
      ]),
    ).toBe('Mois;Km\r\nJanvier;640');
  });

  it('écrit les nombres avec une virgule décimale, pour Excel en français', () => {
    expect(toCsv([[48.5, 1515]])).toBe('48,5;1515');
  });

  it('échappe les guillemets et les séparateurs présents dans le texte', () => {
    expect(toCsv([['Réunion "client"', 'a;b']])).toBe('"Réunion ""client""";"a;b"');
  });

  it('accepte une ligne vide comme séparateur de bloc', () => {
    expect(toCsv([['a'], [], ['b']])).toBe('a\r\n\r\nb');
  });
});
