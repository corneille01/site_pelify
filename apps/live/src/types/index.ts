export type BookingMode = 'presentiel' | 'distance';

export type PackId = 
  | 'express' 
  | 'duo' 
  | 'marathon' 
  | 'visibilite' 
  | 'mensuel' 
  | 'premium';

export interface Pack {
  id: PackId;
  name: string;
  durationLabel: string;
  durationMinutes: number;
  priceFcfa: number;
  priceEur: number;
  headline: string;
  description: string;
  features: string[];
  recommended?: boolean;
  sessionsCount: number;
  isContinuousBlock?: boolean;
}

export type ActivitySector = 
  | 'restauration' 
  | 'mode_textile' 
  | 'cosmetique_beaute' 
  | 'artisanat_deco' 
  | 'agrobusiness' 
  | 'tech_telecom' 
  | 'services' 
  | 'autre';

export type BookingStatus = 
  | 'pending'    // À confirmer par le studio
  | 'confirmed'  // Confirmée
  | 'completed'  // Réalisée
  | 'cancelled';  // Annulée

export type PaymentMethod = 
  | 'tmoney'
  | 'flooz'
  | 'mtn_momo'
  | 'onsite'
  | 'card'
  | 'wave_orange'
  | 'bank_transfer';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface Booking {
  id: string; // e.g. "OCD-2026-84920"
  reference: string;
  createdAt: string;
  mode: BookingMode;
  packId: PackId;
  date: string; // YYYY-MM-DD
  slotTime: string; // "09:00", "10:30", etc.
  slotEndTime: string;
  
  // Client Info
  fullName: string;
  phone: string;
  countryCode: string; // "+228", "+225", "+33", etc.
  email: string;
  
  // Business Info
  businessName: string;
  sector: ActivitySector;
  productsDescription: string;
  country: string; // e.g. "Togo", "Côte d'Ivoire", "France"
  onScreenPhone: string; // Phone displayed on screen for viewers
  liveGoal: string;
  
  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  totalFcfa: number;
  totalEur: number;
  
  // Logistics & Status
  status: BookingStatus;
  regieNotes?: string;
  assistantAssigned?: string;
  googleCalendarSynced?: boolean;
  
  // Notifications dispatched
  whatsappNotificationSentClient: boolean;
  emailNotificationSentClient: boolean;
  whatsappNotificationSentRegie: boolean;
  emailNotificationSentRegie: boolean;
}

export interface UserAccount {
  phone: string;
  countryCode: string;
  fullName: string;
  email: string;
  businessName: string;
  sector: ActivitySector;
  onScreenPhone: string;
  country: string;
  role?: 'client' | 'regie_admin';
  createdAt: string;
  lastLoginAt: string;
  liveGoal?: string;
  bookingIds: string[];
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  channel: 'whatsapp' | 'email';
  recipientType: 'client' | 'regie';
  recipient: string;
  subject: string;
  content: string;
  bookingRef: string;
  status?: 'sent' | 'demo' | 'failed' | 'not_configured';
}
