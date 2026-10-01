# Planning Pro

Application web de suivi du temps de travail et des trajets professionnels : calendrier annuel
(week-ends, jours fériés, présence sur site, télétravail, congés), kilomètres parcourus, coût des
péages et calcul du montant à déclarer aux impôts.

Remplace un tableur Excel annuel par une interface où chaque journée se saisit en un clic, avec
totaux, moyennes et graphiques recalculés en temps réel.

## Fonctionnalités

**Calendrier**

- Vue annuelle (12 mois d'un coup) et vue mensuelle détaillée affichant kilomètres et péage par jour.
- Week-ends et les 11 jours fériés légaux français déduits automatiquement, pour n'importe quelle
  année : les fêtes mobiles (Pâques, Ascension, Pentecôte) sont calculées avec l'algorithme de
  Meeus/Jones/Butcher.
- Édition d'une journée dans un panneau latéral : nature, distance, péage, note.
- Remplissage rapide : application d'un rythme hebdomadaire récurrent (« sur site le lundi et le
  jeudi ») sur l'année ou sur un mois, et application d'un type sur une période (congés, déplacement).

**Calculs**

- Jours travaillés, jours sur site, jours en télétravail, congés et jours fériés.
- Kilomètres et coût des péages par mois et sur l'année, moyennes mensuelles et par trajet.
- Barème kilométrique paramétrable : `(kilomètres × taux) + forfait`, réglé par défaut sur
  `(km × 0,394) + 1515`.
- Montant total à déclarer : barème kilométrique + péages de l'année.

**Données**

- Stockage local (`localStorage`), sans compte ni serveur.
- Sauvegarde et restauration au format JSON, exports CSV (récapitulatif mensuel et détail journalier)
  directement ouvrables dans Excel.

## Choix techniques

| Sujet      | Choix                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Framework  | Angular 22, composants standalone, change detection **zoneless**                   |
| État       | Signals (`signal`, `computed`, `linkedSignal`), store unique injectable            |
| Rendu      | `ChangeDetectionStrategy.OnPush`, nouveau flux de contrôle `@if` / `@for` / `@let` |
| Chargement | Une route = un chunk différé (`loadComponent`)                                     |
| Graphiques | SVG écrit à la main, `ResizeObserver` — aucune librairie de dataviz                |
| Styles     | SCSS et variables CSS, thème sombre, zéro dépendance UI                            |
| Tests      | Vitest, 37 tests sur la logique métier                                             |

Le modèle de données ne stocke que les journées qui s'écartent du calendrier déduit. Deux
conséquences utiles : les données restent très compactes, et modifier une valeur par défaut (distance,
péage, barème) se répercute immédiatement sur tout l'historique non surchargé.

## Démarrage

Angular 22 exige Node 22.22+ (ou 24.15+). Un fichier `.nvmrc` est fourni :

```bash
nvm use            # bascule sur Node 22
npm install
npm start          # http://localhost:4200
```

## Scripts

```bash
npm start          # serveur de développement
npm run build      # build de production dans dist/
npm test           # tests unitaires (Vitest)
npm run format     # formatage Prettier
```

## Architecture

```
src/app/
├── core/
│   ├── models/planning.ts          types du domaine, natures de journée, réglages
│   ├── services/
│   │   ├── planning-store.ts       état applicatif, persistance, statistiques dérivées
│   │   ├── export.service.ts       générations CSV et JSON
│   │   └── notification.service.ts notifications éphémères
│   └── utils/                      dates, jours fériés, statistiques, formatage, fichiers
├── features/
│   ├── dashboard/                  KPI, calcul fiscal, graphiques
│   ├── calendar/                   vues annuelle et mensuelle, éditeur de journée, remplissage
│   ├── summary/                    tableau mensuel et exports
│   └── settings/                   réglages, sauvegardes, réinitialisation
└── shared/                         composants de présentation réutilisables
```

## Accessibilité

Navigation complète au clavier, libellés ARIA sur les cellules du calendrier et les graphiques,
lien d'évitement, contrastes conformes au thème sombre et respect de `prefers-reduced-motion`.

## Limites connues

- Les données vivent dans le navigateur : vider le stockage du site les efface. L'export JSON sert de
  sauvegarde.
- Les jours fériés couvrent le régime général français (hors Alsace-Moselle et outre-mer).
- Le barème kilométrique est volontairement paramétrable plutôt que codé en dur, car il évolue chaque
  année et dépend de la puissance fiscale du véhicule.
