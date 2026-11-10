import { ActivitySector } from '../types';
import { ALL_COUNTRIES } from './countries';

export const SECTORS: { id: ActivitySector; label: string; icon: string }[] = [
  { id: 'restauration', label: 'Restauration et traiteur', icon: 'Utensils' },
  { id: 'mode_textile', label: 'Mode et textile', icon: 'Shirt' },
  { id: 'cosmetique_beaute', label: 'Beauté et cosmétique', icon: 'Sparkles' },
  { id: 'artisanat_deco', label: 'Artisanat et décoration', icon: 'Palette' },
  { id: 'agrobusiness', label: 'Agroalimentaire', icon: 'Wheat' },
  { id: 'tech_telecom', label: 'Téléphonie et high-tech', icon: 'Smartphone' },
  { id: 'services', label: 'Services et formations', icon: 'Briefcase' },
  { id: 'autre', label: 'Autre', icon: 'Store' }
];

export const COUNTRY_CODES = ALL_COUNTRIES.map(c => ({
  id: `${c.iso}-${c.code}`,
  code: c.code,
  country: c.name,
  flag: c.flag
}));
