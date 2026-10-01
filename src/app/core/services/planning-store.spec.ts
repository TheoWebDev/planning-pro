import { TestBed } from '@angular/core/testing';
import { WORKWEEK } from '../utils/date';
import { PlanningStore } from './planning-store';

describe('PlanningStore', () => {
  let store: PlanningStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    store = TestBed.inject(PlanningStore);
    store.selectYear(2026);
  });

  describe('résolution des journées', () => {
    it('déduit les week-ends du calendrier', () => {
      // 3 janvier 2026 est un samedi.
      expect(store.resolve('2026-01-03').type).toBe('weekend');
      expect(store.resolve('2026-01-04').type).toBe('weekend');
    });

    it('déduit les jours fériés et les nomme', () => {
      const newYear = store.resolve('2026-01-01');

      expect(newYear.type).toBe('holiday');
      expect(newYear.holidayName).toBe('Jour de l’An');
    });

    it('applique le type par défaut aux jours ouvrés non saisis', () => {
      expect(store.resolve('2026-01-05').type).toBe('remote');

      store.updateSettings({ defaultWeekdayType: 'onsite' });

      expect(store.resolve('2026-01-05').type).toBe('onsite');
    });

    it('n’attribue kilomètres et péage qu’aux journées sur site', () => {
      store.setDay('2026-01-05', { type: 'onsite' });

      expect(store.resolve('2026-01-05').km).toBe(store.settings().defaultKm);
      expect(store.resolve('2026-01-06').km).toBe(0);
    });
  });

  describe('saisie d’une journée', () => {
    it('conserve les surcharges de kilomètres et de péage', () => {
      store.setDay('2026-01-05', { type: 'onsite' });
      store.setDay('2026-01-05', { km: 120, toll: 9.5 });

      const day = store.resolve('2026-01-05');
      expect(day.km).toBe(120);
      expect(day.toll).toBe(9.5);
      expect(day.isOverridden).toBe(true);
    });

    it('repasse sur la valeur par défaut quand la surcharge est retirée', () => {
      store.setDay('2026-01-05', { type: 'onsite', km: 120 });
      store.setDay('2026-01-05', { km: undefined });

      expect(store.resolve('2026-01-05').km).toBe(store.settings().defaultKm);
    });

    it('propage une nouvelle valeur par défaut aux journées non surchargées', () => {
      store.setDay('2026-01-05', { type: 'onsite' });
      store.updateSettings({ defaultKm: 100 });

      expect(store.resolve('2026-01-05').km).toBe(100);
    });

    it('efface la saisie et revient au calendrier déduit', () => {
      store.setDay('2026-01-03', { type: 'onsite' });
      expect(store.resolve('2026-01-03').type).toBe('onsite');

      store.clearDay('2026-01-03');

      expect(store.resolve('2026-01-03').type).toBe('weekend');
      expect(store.resolve('2026-01-03').isOverridden).toBe(false);
    });
  });

  describe('remplissage de masse', () => {
    const options = { skipNonWorkingDays: true, keepExistingEntries: false };

    it('applique un rythme hebdomadaire en préservant week-ends et fériés', () => {
      const applied = store.applyWeeklyPattern([0], 'onsite', options);

      // 2026 compte 52 lundis, dont 2 fériés : Pâques (6 avril) et Pentecôte (25 mai).
      expect(applied).toBe(50);
      expect(store.resolve('2026-04-06').type).toBe('holiday');
      expect(store.yearStats().onsiteDays).toBe(50);
    });

    it('limite le rythme à un mois quand il est précisé', () => {
      store.applyWeeklyPattern([...WORKWEEK], 'onsite', options, 1);

      expect(store.monthStats()[1].onsiteDays).toBe(20);
      expect(store.monthStats()[2].onsiteDays).toBe(0);
    });

    it('applique un type sur une période, bornes incluses', () => {
      const applied = store.applyToRange('2026-08-03', '2026-08-07', 'leave', options);

      expect(applied).toBe(5);
      expect(store.resolve('2026-08-03').type).toBe('leave');
      expect(store.resolve('2026-08-07').type).toBe('leave');
      expect(store.resolve('2026-08-10').type).toBe('remote');
    });

    it('respecte l’option de conservation des saisies existantes', () => {
      store.setDay('2026-08-03', { type: 'onsite' });

      store.applyToRange('2026-08-03', '2026-08-04', 'leave', {
        skipNonWorkingDays: true,
        keepExistingEntries: true,
      });

      expect(store.resolve('2026-08-03').type).toBe('onsite');
      expect(store.resolve('2026-08-04').type).toBe('leave');
    });

    it('ignore un intervalle inversé', () => {
      expect(store.applyToRange('2026-08-10', '2026-08-01', 'leave', options)).toBe(0);
    });
  });

  describe('statistiques annuelles', () => {
    it('comptabilise 252 jours travaillés en 2026 par défaut', () => {
      const stats = store.yearStats();

      // 261 jours ouvrés en 2026, moins 9 jours fériés tombant en semaine.
      expect(stats.workedDays).toBe(252);
      expect(stats.holidayDays).toBe(9);
      expect(stats.weekendDays).toBe(104);
      expect(stats.totalDays).toBe(365);
    });

    it('chaîne kilomètres, péages et montant à déclarer', () => {
      store.updateSettings({ defaultKm: 80, defaultToll: 6 });
      store.applyWeeklyPattern([0, 3], 'onsite', {
        skipNonWorkingDays: true,
        keepExistingEntries: false,
      });

      const stats = store.yearStats();
      expect(stats.km).toBe(stats.onsiteDays * 80);
      expect(stats.toll).toBe(stats.onsiteDays * 6);
      expect(stats.totalDeclared).toBeCloseTo(stats.km * 0.394 + 1515 + stats.toll, 2);
    });
  });

  describe('persistance et import', () => {
    it('relit l’état enregistré dans le localStorage', () => {
      store.setDay('2026-03-02', { type: 'onsite', km: 95 });
      // Déclenche l'effet de persistance.
      TestBed.tick();

      TestBed.resetTestingModule();
      const reloaded = TestBed.inject(PlanningStore);

      expect(reloaded.resolve('2026-03-02').km).toBe(95);
    });

    it('importe une sauvegarde valide', () => {
      store.setDay('2026-03-02', { type: 'onsite', km: 95 });
      const backup = JSON.stringify(store.snapshot());

      store.resetAll();
      expect(store.entryCount()).toBe(0);

      store.importState(backup);
      expect(store.resolve('2026-03-02').km).toBe(95);
    });

    it('rejette un fichier qui n’est pas un objet JSON', () => {
      expect(() => store.importState('"bonjour"')).toThrow();
      expect(() => store.importState('{')).toThrow();
    });

    it('ignore les journées invalides d’une sauvegarde corrompue', () => {
      store.importState(
        JSON.stringify({
          days: {
            '2026-03-02': { type: 'onsite' },
            'pas-une-date': { type: 'onsite' },
            '2026-03-03': { type: 'sieste' },
          },
        }),
      );

      expect(store.entryCount()).toBe(1);
      expect(store.resolve('2026-03-02').type).toBe('onsite');
    });

    it('n’efface que l’année demandée', () => {
      store.setDay('2026-03-02', { type: 'onsite' });
      store.setDay('2027-03-02', { type: 'onsite' });

      expect(store.resetYear(2026)).toBe(1);
      expect(store.resolve('2027-03-02').type).toBe('onsite');
    });
  });
});
