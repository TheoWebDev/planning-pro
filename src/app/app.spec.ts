import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('affiche les quatre onglets de navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll('.tab');
    expect([...tabs].map((tab) => tab.textContent?.trim())).toEqual([
      'Tableau de bordSynthèse',
      'CalendrierCalendrier',
      'RécapitulatifRécap',
      'RéglagesRéglages',
    ]);
  });

  it('propose l’année courante dans le sélecteur', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#year-select',
    );
    expect(select?.value).toBe(String(new Date().getFullYear()));
  });
});
