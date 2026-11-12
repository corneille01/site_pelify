export type EventType = 'defi' | 'match' | 'tournoi' | 'equipe' | 'session' | 'autre';
export type EventFormat = '1v1' | 'equipe' | 'multi' | 'libre';
export type Visibility = 'public' | 'prive';
export type EventStatus = 'open' | 'full' | 'closed' | 'live' | 'finished' | 'cancelled';
export type PartStatus = 'pending' | 'accepted' | 'refused' | 'withdrawn';

export const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: 'defi', label: 'Défi individuel' },
  { id: 'match', label: 'Match amical' },
  { id: 'tournoi', label: 'Tournoi' },
  { id: 'equipe', label: 'Compétition par équipe' },
  { id: 'session', label: 'Session communautaire' },
  { id: 'autre', label: 'Autre' },
];
export const EVENT_FORMATS: { id: EventFormat; label: string }[] = [
  { id: '1v1', label: '1 contre 1' },
  { id: 'equipe', label: 'Équipe contre équipe' },
  { id: 'multi', label: 'Plusieurs joueurs' },
  { id: 'libre', label: 'Participation libre' },
];
export const STATUS_LABEL: Record<EventStatus, string> = {
  open: 'Ouvert', full: 'Complet', closed: 'Inscriptions closes', live: 'En cours', finished: 'Terminé', cancelled: 'Annulé',
};
export const PART_LABEL: Record<PartStatus, string> = {
  pending: 'En attente', accepted: 'Accepté', refused: 'Refusé', withdrawn: 'Retiré',
};
export const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Nintendo', 'Mobile', 'Autre'];

export interface UserAccount {
  fullName: string;
  pseudo: string;
  email: string;
  phone: string;
  countryCode: string;
  country: string;
  games: string[];
  emailNotifications: boolean;
  role?: 'joueur' | 'admin';
  createdAt: string;
  lastLoginAt: string;
}

export interface ArenaEvent {
  id: string;
  ownerId: string;
  ownerPseudo: string;
  title: string;
  game: string;
  platform: string;
  type: EventType;
  format: EventFormat;
  description: string;
  rules: string;
  maxPlayers: number;
  requireApproval: boolean;
  startsAt: string;
  deadline: string;
  link: string;
  visibility: Visibility;
  banner: string;
  createdAt: string;
  updatedAt: string;
  finished?: boolean;
  cancelled?: boolean;
  result?: string;
}

export interface ArenaEventView extends ArenaEvent {
  status: EventStatus;
  taken: number;
  mine?: PartStatus;
  isOwner?: boolean;
}

export interface Participant {
  userId?: string;
  pseudo: string;
  status: PartStatus;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  timestamp: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
}

export interface ReportView {
  id: string;
  createdAt: string;
  targetType: 'event' | 'user';
  targetId: string;
  targetLabel: string;
  reason: string;
  reporter: string;
  status: 'open' | 'resolved';
}
