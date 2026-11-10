import { Pack } from '../types';

export const PACKS: Pack[] = [
  {
    id: 'express',
    name: 'Express',
    durationLabel: '1 h 30',
    durationMinutes: 90,
    priceFcfa: 15000,
    priceEur: 23,
    headline: 'Un live de 1 h 30',
    description: 'Un live pour présenter vos produits et afficher votre numéro WhatsApp. Vous le faites au studio ou à distance.',
    sessionsCount: 1,
    features: [
      'Un live de 1 h 30 en direct sur TikTok et Facebook.',
      'L\'équipe du studio vous accompagne pendant tout le live.',
      'Votre numéro WhatsApp reste affiché à l\'écran.',
      'Vous venez au studio de Lomé, ou vous restez chez vous avec une animatrice du studio.',
      'Nous vous donnons des conseils pour préparer vos produits et votre présentation.'
    ]
  },
  {
    id: 'duo',
    name: 'Duo',
    durationLabel: '2 lives de 1 h 30',
    durationMinutes: 90,
    priceFcfa: 27000,
    priceEur: 41,
    headline: 'Deux lives de 1 h 30, 3 000 FCFA d\'économie',
    description: 'Deux lives pour revenir devant vos spectateurs et présenter plus de produits.',
    sessionsCount: 2,
    features: [
      'Deux lives de 1 h 30 chacun.',
      'Vous choisissez la date du premier live ici.',
      'Vous fixez le deuxième avec l\'équipe du studio, selon vos disponibilités.',
      'Votre numéro WhatsApp reste affiché à l\'écran.',
      'L\'équipe du studio suit les commentaires pendant le live.'
    ]
  },
  {
    id: 'marathon',
    name: 'Marathon',
    durationLabel: '4 h en continu',
    durationMinutes: 240,
    priceFcfa: 30000,
    priceEur: 46,
    headline: 'Un live de 4 h à 7 500 FCFA l\'heure',
    description: 'Un long live pour vendre votre stock, faire des promotions ou montrer votre savoir-faire.',
    sessionsCount: 1,
    isContinuousBlock: true,
    features: [
      'Un seul live de 4 heures, le matin de 9 h à 13 h ou l\'après-midi de 14 h à 18 h.',
      'Le tarif est de 7 500 FCFA l\'heure, au lieu de 10 000 FCFA.',
      'L\'équipe du studio vous aide à enchaîner vos produits pendant tout le live.',
      'Votre numéro WhatsApp reste affiché à l\'écran.',
      'Un technicien reste à vos côtés pendant les 4 heures.'
    ]
  },
  {
    id: 'visibilite',
    name: 'Visibilité',
    durationLabel: '1 h 30 avec annonce vidéo',
    durationMinutes: 90,
    priceFcfa: 35000,
    priceEur: 53,
    headline: 'Un live et une annonce par le studio',
    description: 'Le studio annonce votre live en vidéo sur les comptes TikTok et Facebook de House of Challenge.',
    recommended: true,
    sessionsCount: 1,
    features: [
      'Un live de 1 h 30 mené avec l\'équipe du studio.',
      'Le studio publie une vidéo d\'annonce avant le live, sur TikTok et Facebook.',
      'Nous vous aidons à préparer cette vidéo.',
      'Votre numéro WhatsApp reste affiché à l\'écran pendant le live.'
    ]
  },
  {
    id: 'mensuel',
    name: 'Mensuel',
    durationLabel: '4 lives de 1 h 30',
    durationMinutes: 90,
    priceFcfa: 55000,
    priceEur: 84,
    headline: 'Quatre lives, un par semaine, et une annonce',
    description: 'Un live chaque semaine pendant un mois, pour rester présent devant vos clients.',
    sessionsCount: 4,
    features: [
      'Quatre lives de 1 h 30, un par semaine pendant le mois.',
      'Vous choisissez la date du premier live ici.',
      'Vous fixez les trois suivants avec l\'équipe du studio.',
      'Le studio publie une annonce vidéo sur ses réseaux.',
      'Votre numéro WhatsApp reste affiché à l\'écran.'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    durationLabel: '10 h en tout',
    durationMinutes: 90,
    priceFcfa: 120000,
    priceEur: 183,
    headline: 'Quatre lives, un marathon et quatre annonces',
    description: 'Quatre lives de 1 h 30, un live de 4 h et quatre annonces vidéo, avec une vidéo de présentation réalisée par le studio.',
    sessionsCount: 5,
    features: [
      'Quatre lives de 1 h 30 et un live continu de 4 heures, soit 10 heures en tout.',
      'Vous choisissez la date du premier live ici.',
      'Vous fixez les suivants avec l\'équipe du studio.',
      'Le studio publie quatre annonces sur les comptes de House of Challenge.',
      'Le studio enregistre et publie une vidéo de présentation de votre activité.'
    ]
  }
];

export const TIME_SLOTS_1H30 = [
  { time: '09:00', endTime: '10:30', label: '09h00 – 10h30 GMT' },
  { time: '10:30', endTime: '12:00', label: '10h30 – 12h00 GMT' },
  { time: '14:00', endTime: '15:30', label: '14h00 – 15h30 GMT' },
  { time: '15:30', endTime: '17:00', label: '15h30 – 17h00 GMT' },
  { time: '17:00', endTime: '18:30', label: '17h00 – 18h30 GMT' }
];

export const TIME_SLOTS_4H = [
  { time: '09:00', endTime: '13:00', label: '09h00 – 13h00 GMT' },
  { time: '14:00', endTime: '18:00', label: '14h00 – 18h00 GMT' }
];
