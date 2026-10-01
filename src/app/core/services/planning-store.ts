import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  DEFAULT_SETTINGS,
  STATE_VERSION,
  tollRateFor,
  type DayEntry,
  type DayType,
  type PlanningSettings,
  type PlanningState,
  type ResolvedDay,
  type TollRate,
} from '../models/planning';
import { fromIso, isoListBetween, isoListOfMonth, toIso, weekdayIndex } from '../utils/date';
import { frenchHolidays } from '../utils/holidays';
import {
  computeMonthStats,
  computeYearStats,
  type MonthStats,
  type YearStats,
} from '../utils/stats';
import { PlanningApi } from './planning-api';

/** Ancienne clé navigateur : lue une seule fois pour migrer vers SQLite. */
const STORAGE_KEY = 'planning-pro:state:v1';

export type StoreStatus = 'loading' | 'ready' | 'offline';

export interface RangeOptions {
  /** Laisse inchangés les week-ends et jours fériés. */
  readonly skipNonWorkingDays: boolean;
  /** Laisse inchangées les journées déjà saisies manuellement. */
  readonly keepExistingEntries: boolean;
}

/**
 * Source de vérité unique de l'application : réglages, journées saisies et année
 * sélectionnée. Chaque changement est écrit dans la base SQLite.
 */
@Injectable({ providedIn: 'root' })
export class PlanningStore {
  private readonly api = inject(PlanningApi);
  private readonly state = signal<PlanningState>(createInitialState());
  private readonly hydrated = signal(false);
  private lastSaved = '';
  private queued: PlanningState | null = null;
  private drainPromise: Promise<void> | null = null;
  private ready: Promise<void> = Promise.resolve();

  readonly status = signal<StoreStatus>('loading');
  readonly saveError = signal(false);

  readonly settings = computed(() => this.state().settings);
  readonly selectedYear = computed(() => this.state().selectedYear);
  readonly entryCount = computed(() => Object.keys(this.state().days).length);

  /** Années disponibles dans le sélecteur : année courante ± 3, plus celles saisies. */
  readonly availableYears = computed(() => {
    const current = new Date().getFullYear();
    const years = new Set<number>([this.selectedYear()]);
    for (let year = current - 3; year <= current + 3; year++) {
      years.add(year);
    }
    for (const iso of Object.keys(this.state().days)) {
      years.add(fromIso(iso).getFullYear());
    }
    return [...years].sort((a, b) => a - b);
  });

  private readonly holidays = computed(() => frenchHolidays(this.selectedYear()));

  /** Les 365/366 journées de l'année sélectionnée, groupées par mois. */
  readonly monthDays = computed<ResolvedDay[][]>(() => {
    const year = this.selectedYear();
    const { days, settings } = this.state();
    const holidays = this.holidays();
    const today = toIso(new Date());

    return Array.from({ length: 12 }, (_, month) =>
      isoListOfMonth(year, month).map((iso) =>
        resolveDay(iso, days[iso], settings, holidays, today),
      ),
    );
  });

  readonly days = computed<ResolvedDay[]>(() => this.monthDays().flat());

  readonly monthStats = computed<MonthStats[]>(() => computeMonthStats(this.monthDays()));

  readonly yearStats = computed<YearStats>(() =>
    computeYearStats(this.selectedYear(), this.monthStats(), this.settings()),
  );

  constructor() {
    effect(() => {
      if (!this.hydrated()) {
        return;
      }
      this.enqueueSave(this.state());
    });
    this.ready = this.hydrate();
  }

  /** Résolu quand la base a répondu, qu'elle soit disponible ou non. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Résolu quand la dernière écriture demandée s'est terminée. */
  whenSaved(): Promise<void> {
    return this.drainPromise ?? Promise.resolve();
  }

  /** Relance la lecture après un démarrage sans base. */
  retry(): void {
    if (this.status() === 'loading') {
      return;
    }
    this.hydrated.set(false);
    this.status.set('loading');
    this.ready = this.hydrate();
  }

  /** Renvoie l'état courant vers SQLite après un échec d'écriture. */
  retrySave(): void {
    this.queued = this.state();
    this.kickSave();
  }

  // ---------------------------------------------------------------- navigation

  selectYear(year: number): void {
    this.state.update((state) => ({ ...state, selectedYear: year }));
  }

  // ------------------------------------------------------------------ journées

  /** Renvoie la journée calculée pour une date ISO, même hors année sélectionnée. */
  resolve(iso: string): ResolvedDay {
    const { days, settings } = this.state();
    const year = fromIso(iso).getFullYear();
    const holidays = year === this.selectedYear() ? this.holidays() : frenchHolidays(year);
    return resolveDay(iso, days[iso], settings, holidays, toIso(new Date()));
  }

  setDay(iso: string, patch: Partial<DayEntry>): void {
    this.state.update((state) => {
      const current: DayEntry = state.days[iso] ?? { type: this.resolve(iso).type };
      const next: DayEntry = { ...current, ...patch };
      return { ...state, days: { ...state.days, [iso]: stripDefaults(next) } };
    });
  }

  /** Supprime la saisie : la journée repasse sur les valeurs déduites du calendrier. */
  clearDay(iso: string): void {
    this.state.update((state) => {
      if (!(iso in state.days)) {
        return state;
      }
      const days = { ...state.days };
      delete days[iso];
      return { ...state, days };
    });
  }

  /** Applique un type à toutes les dates d'un intervalle (bornes incluses). */
  applyToRange(
    fromIsoDate: string,
    toIsoDate: string,
    type: DayType,
    options: RangeOptions,
  ): number {
    return this.applyToDates(isoListBetween(fromIsoDate, toIsoDate), type, options);
  }

  /**
   * Applique un type aux jours de la semaine choisis (0 = lundi) sur l'année
   * sélectionnée, ou sur un seul mois.
   */
  applyWeeklyPattern(
    weekdays: readonly number[],
    type: DayType,
    options: RangeOptions,
    month?: number,
  ): number {
    const year = this.selectedYear();
    const months = month === undefined ? Array.from({ length: 12 }, (_, index) => index) : [month];
    const targets = months
      .flatMap((index) => isoListOfMonth(year, index))
      .filter((iso) => weekdays.includes(weekdayIndex(fromIso(iso))));
    return this.applyToDates(targets, type, options);
  }

  private applyToDates(isoDates: readonly string[], type: DayType, options: RangeOptions): number {
    let applied = 0;
    this.state.update((state) => {
      const days = { ...state.days };
      for (const iso of isoDates) {
        const resolved = this.resolve(iso);
        if (
          options.skipNonWorkingDays &&
          (resolved.type === 'weekend' || resolved.type === 'holiday')
        ) {
          continue;
        }
        if (options.keepExistingEntries && resolved.isOverridden) {
          continue;
        }
        days[iso] = stripDefaults({ ...days[iso], type });
        applied++;
      }
      return applied ? { ...state, days } : state;
    });
    return applied;
  }

  // ------------------------------------------------------------------ réglages

  updateSettings(patch: Partial<PlanningSettings>): void {
    this.state.update((state) => {
      const merged: PlanningSettings = { ...state.settings, ...patch };
      const settings: PlanningSettings =
        'fuelPricePerLiter' in patch && !('fuelPriceReadAt' in patch)
          ? { ...merged, fuelPriceReadAt: null }
          : merged;
      return {
        ...state,
        settings: { ...settings, tollRates: normalizeTollRates(settings.tollRates) },
      };
    });
  }

  /** Péage par défaut d'une date, hors surcharge de la journée. */
  tollRateAt(iso: string): number {
    return tollRateFor(iso, this.settings().tollRates);
  }

  // -------------------------------------------------------------------- données

  snapshot(): PlanningState {
    return this.state();
  }

  /** Remplace l'état complet depuis un export JSON. Lève une erreur si invalide. */
  importState(raw: string): void {
    const parsed: unknown = JSON.parse(raw);
    this.state.set(normalizeState(parsed));
  }

  /** Supprime les saisies d'une année, en conservant les réglages. */
  resetYear(year: number): number {
    const prefix = `${year}-`;
    let removed = 0;
    this.state.update((state) => {
      const days: Record<string, DayEntry> = {};
      for (const [iso, entry] of Object.entries(state.days)) {
        if (iso.startsWith(prefix)) {
          removed++;
        } else {
          days[iso] = entry;
        }
      }
      return removed ? { ...state, days } : state;
    });
    return removed;
  }

  resetAll(): void {
    this.state.set({ ...createInitialState(), selectedYear: this.selectedYear() });
  }

  private async hydrate(): Promise<void> {
    try {
      const payload = await this.api.load();
      if (payload !== null && payload !== undefined) {
        const remote = normalizeState(payload);
        this.lastSaved = JSON.stringify(remote);
        this.state.set(remote);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const migrated = readLocalState();
        if (migrated && hasUserData(migrated)) {
          this.state.set(migrated);
        } else {
          this.lastSaved = JSON.stringify(this.state());
        }
      }
      this.saveError.set(false);
      this.hydrated.set(true);
      this.status.set('ready');
    } catch {
      this.hydrated.set(false);
      this.status.set('offline');
    }
  }

  private enqueueSave(state: PlanningState): void {
    if (JSON.stringify(state) === this.lastSaved) {
      return;
    }
    this.queued = state;
    this.kickSave();
  }

  private kickSave(): void {
    if (this.drainPromise) {
      return;
    }
    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null;
    });
  }

  private async drain(): Promise<void> {
    while (this.queued) {
      const state = this.queued;
      this.queued = null;
      const raw = JSON.stringify(state);
      if (raw === this.lastSaved) {
        continue;
      }
      try {
        await this.api.save(state);
        this.lastSaved = raw;
        localStorage.removeItem(STORAGE_KEY);
        this.saveError.set(false);
      } catch {
        this.saveError.set(true);
        if (this.queued === null) {
          return;
        }
      }
    }
  }
}

// -------------------------------------------------------------------- helpers

function resolveDay(
  iso: string,
  entry: DayEntry | undefined,
  settings: PlanningSettings,
  holidays: ReadonlyMap<string, string>,
  todayIso: string,
): ResolvedDay {
  const date = fromIso(iso);
  const weekday = weekdayIndex(date);
  const holidayName = holidays.get(iso) ?? null;

  let type: DayType;
  if (entry) {
    type = entry.type;
  } else if (weekday >= 5) {
    type = 'weekend';
  } else if (holidayName) {
    type = 'holiday';
  } else {
    type = settings.defaultWeekdayType;
  }

  const commutes = type === 'onsite';
  return {
    iso,
    year: date.getFullYear(),
    month: date.getMonth(),
    dayOfMonth: date.getDate(),
    weekday,
    type,
    km: commutes ? (entry?.km ?? settings.defaultKm) : 0,
    toll: commutes ? (entry?.toll ?? tollRateFor(iso, settings.tollRates)) : 0,
    note: entry?.note ?? '',
    holidayName,
    isOverridden: entry !== undefined,
    isToday: iso === todayIso,
  };
}

/** Retire les champs vides pour ne pas figer inutilement les valeurs par défaut. */
function stripDefaults(entry: DayEntry): DayEntry {
  const result: { type: DayType; km?: number; toll?: number; note?: string } = { type: entry.type };
  if (entry.type === 'onsite') {
    if (typeof entry.km === 'number' && Number.isFinite(entry.km)) {
      result.km = entry.km;
    }
    if (typeof entry.toll === 'number' && Number.isFinite(entry.toll)) {
      result.toll = entry.toll;
    }
  }
  if (entry.note?.trim()) {
    result.note = entry.note.trim();
  }
  return result;
}

function createInitialState(): PlanningState {
  return {
    version: STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    days: {},
    selectedYear: new Date().getFullYear(),
  };
}

const VALID_TYPES = new Set<string>(['onsite', 'remote', 'leave', 'holiday', 'weekend', 'other']);
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valide et nettoie un état venant de SQLite, du navigateur ou d'un fichier importé. */
function normalizeState(input: unknown): PlanningState {
  const base = createInitialState();
  if (typeof input !== 'object' || input === null) {
    throw new Error('Fichier invalide : objet JSON attendu.');
  }
  const raw = input as Partial<Record<keyof PlanningState, unknown>>;

  const settings: PlanningSettings = {
    defaultKm: positiveNumber(readProp(raw.settings, 'defaultKm'), base.settings.defaultKm),
    tollRates: readTollRates(raw.settings, base.settings.tollRates),
    defaultWeekdayType:
      readProp(raw.settings, 'defaultWeekdayType') === 'onsite' ? 'onsite' : 'remote',
    taxRatePerKm: positiveNumber(
      readProp(raw.settings, 'taxRatePerKm'),
      base.settings.taxRatePerKm,
    ),
    taxFixedAmount: positiveNumber(
      readProp(raw.settings, 'taxFixedAmount'),
      base.settings.taxFixedAmount,
    ),
    fuelConsumption: positiveNumber(
      readProp(raw.settings, 'fuelConsumption'),
      base.settings.fuelConsumption,
    ),
    fuelPricePerLiter: positiveNumber(
      readProp(raw.settings, 'fuelPricePerLiter'),
      base.settings.fuelPricePerLiter,
    ),
    fuelPriceReadAt: readIsoDateTime(readProp(raw.settings, 'fuelPriceReadAt')),
  };

  const days: Record<string, DayEntry> = {};
  const rawDays = raw.days;
  if (typeof rawDays === 'object' && rawDays !== null) {
    for (const [iso, value] of Object.entries(rawDays as Record<string, unknown>)) {
      const type = readProp(value, 'type');
      if (!ISO_PATTERN.test(iso) || typeof type !== 'string' || !VALID_TYPES.has(type)) {
        continue;
      }
      days[iso] = stripDefaults({
        type: type as DayType,
        km: optionalNumber(readProp(value, 'km')),
        toll: optionalNumber(readProp(value, 'toll')),
        note:
          typeof readProp(value, 'note') === 'string'
            ? (readProp(value, 'note') as string)
            : undefined,
      });
    }
  }

  const year = Number(raw.selectedYear);
  return {
    version: STATE_VERSION,
    settings,
    days,
    selectedYear: Number.isInteger(year) && year >= 1970 && year <= 2200 ? year : base.selectedYear,
  };
}

/**
 * Lit le barème de péage d'un état externe. Les sauvegardes antérieures ne
 * connaissent qu'un tarif unique (`defaultToll`) : il devient le tarif le plus
 * ancien, donc les totaux déjà calculés restent identiques.
 */
function readTollRates(source: unknown, fallback: readonly TollRate[]): readonly TollRate[] {
  const raw = readProp(source, 'tollRates');
  if (Array.isArray(raw)) {
    return normalizeTollRates(
      raw.map((item) => ({
        from: String(readProp(item, 'from')),
        amount: Number(readProp(item, 'amount')),
      })),
      fallback,
    );
  }
  const legacy = optionalNumber(readProp(source, 'defaultToll'));
  return legacy === undefined ? fallback : [{ from: fallback[0].from, amount: legacy }];
}

/** Trie par date, écarte les tarifs invalides et ne garde qu'un montant par date. */
function normalizeTollRates(
  rates: readonly TollRate[],
  fallback: readonly TollRate[] = DEFAULT_SETTINGS.tollRates,
): readonly TollRate[] {
  const amountByDate = new Map<string, number>();
  for (const rate of rates) {
    if (ISO_PATTERN.test(rate.from) && Number.isFinite(rate.amount) && rate.amount >= 0) {
      amountByDate.set(rate.from, rate.amount);
    }
  }
  if (amountByDate.size === 0) {
    return fallback;
  }
  return [...amountByDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, amount]) => ({ from, amount }));
}

function readProp(source: unknown, key: string): unknown {
  return typeof source === 'object' && source !== null
    ? (source as Record<string, unknown>)[key]
    : undefined;
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

function readIsoDateTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function readLocalState(): PlanningState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function hasUserData(state: PlanningState): boolean {
  return (
    Object.keys(state.days).length > 0 ||
    JSON.stringify(state.settings) !== JSON.stringify(DEFAULT_SETTINGS)
  );
}
