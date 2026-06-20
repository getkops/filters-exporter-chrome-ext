import type { Messages } from './types';

/** French catalog. Must declare the exact same keys as `en` (enforced by the
 *  `Messages` type). Plurals agree with French rules (≥2 → plural). */
export const fr: Messages = {
  // Header
  tagline: 'Exportez vos filtres V-Tools & Souk.to',
  howItWorks: 'Comment ça marche',
  close: 'Fermer',

  // Status chip
  statusWaiting: 'En attente de données…',
  sourceVtools: 'V-Tools',
  sourceSouk: 'Souk.to',
  sourceGeneric: 'Filtres',
  captured: (n) => `${n} capturé${n > 1 ? 's' : ''}`,

  // Toolbar
  searchPlaceholder: 'Rechercher des filtres…',
  filtersShown: (n) => `${n} affiché${n > 1 ? 's' : ''}`,
  selectedOf: (selected, total) => `${selected} sur ${total} sélectionné${selected > 1 ? 's' : ''}`,
  selectAll: 'Tout sélectionner',

  // Table
  colName: 'Nom',
  colBrands: 'Marques',
  colPrice: 'Prix',
  colStatus: 'Statut',
  statusActive: 'Actif',
  statusOff: 'Inactif',
  unnamed: '(sans nom)',
  noResults: 'Aucun filtre ne correspond',

  // Action bar
  exportN: (n) => `Exporter ${n}`,
  exportSelectedN: (n) => `Exporter ${n} sélectionné${n > 1 ? 's' : ''}`,
  refresh: 'Actualiser',
  more: 'Plus',

  // Menus
  refreshVtools: 'Actualiser V-Tools',
  refreshSouk: 'Actualiser Souk.to',
  clear: 'Effacer les filtres',
  debugExport: 'Exporter la session de débogage',
  debugInclude: 'Inclure les données de filtres',
  debugIncludeHint: 'Inclut vos filtres capturés dans le bundle (vos propres données)',
  lastCapture: (time) => `Dernière capture ${time}`,

  // Empty state / onboarding
  emptyTitle: 'Aucun filtre capturé',
  step1: 'Ouvrez votre page de filtres V-Tools ou Souk.to',
  step2: 'Vos filtres sont capturés automatiquement',
  step3: 'Revenez ici pour les exporter',
  openVtools: 'Ouvrir V-Tools',
  openSouk: 'Ouvrir Souk.to',

  // Loading
  loading: 'Chargement des filtres…',

  // Errors
  errConnect: "Connexion à l'extension impossible. Rouvrez le popup.",
  errParse: (n) => `${n} avertissement${n > 1 ? 's' : ''} pendant la capture`,
  errExport: "Échec de l'export — réessayez",
  errNoFilters: 'Aucun filtre à exporter',
  errClear: "Échec de l'effacement — réessayez",
  errDownload: 'Échec du téléchargement — voir la console',
  errOpenPage: "Impossible d'ouvrir la page",
  errDebug: "Échec de l'export de débogage — réessayez",

  // Toasts
  toastExported: (n) => `${n} filtre${n > 1 ? 's' : ''} exporté${n > 1 ? 's' : ''}`,
  toastCleared: 'Filtres effacés',
  toastDebugSavedCopied: 'Session de débogage enregistrée + copiée',
  toastDebugSaved: 'Session de débogage enregistrée',
  refreshOpening: (source) =>
    `Ouverture de ${source} — les filtres se capturent automatiquement. Rouvrez ce popup pour les voir.`,
};
