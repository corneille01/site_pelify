import type { Booking, NotificationLog, UserAccount } from '../types';

export type Channel = 'email' | 'sms' | 'whatsapp';

export interface ServerConfig {
  demo: boolean;
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  payment: { tmoney: boolean; flooz: boolean; mtn_momo: boolean };
}

export interface Challenge {
  challenge: string;
  channel: Channel;
  destination: string;
  expiresInMinutes: number;
  demoCode?: string;
}

export interface Busy {
  date: string;
  slotTime: string;
  slotEndTime: string;
  startsAt: string;
  endsAt: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre réseau et réessayez.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = String(data?.error || data?.message || '');
    // Un texte technique (base de données, réseau) n'est jamais montré au client.
    const technical = !raw || res.status >= 500 && /password|authentication|postgres|neon|sql|relation|econn|timeout|stack|error:|exception/i.test(raw);
    const fallback = res.status >= 500 ? 'Le service est momentanément indisponible. Réessayez dans quelques minutes.' : 'Une erreur est survenue. Réessayez.';
    throw new ApiError(technical ? fallback : raw, res.status, data?.code);
  }
  return data as T;
}

export interface RegisterInput {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  countryCode: string;
  password: string;
  channel: Channel;
  sector?: string;
  country?: string;
  onScreenPhone?: string;
}

export interface BookingInput {
  mode: string;
  packId: string;
  date: string;
  slotTime: string;
  activity: {
    businessName: string;
    sector: string;
    productsDescription: string;
    country: string;
    onScreenPhone: string;
    liveGoal: string;
  };
  paymentMethod: string;
  consents: { cgv: boolean; data: boolean; image: boolean };
}

export const api = {
  config: () => call<ServerConfig>('GET', '/config'),
  register: (b: RegisterInput) => call<Challenge>('POST', '/auth/register', b),
  login: (identifier: string, password: string, channel: Channel) => call<Challenge>('POST', '/auth/login', { identifier, password, channel }),
  resend: (challenge: string, channel: Channel) => call<Challenge>('POST', '/auth/resend', { challenge, channel }),
  verify: (challenge: string, code: string) => call<{ user?: UserAccount; resetToken?: string }>('POST', '/auth/verify', { challenge, code }),
  recover: (identifier: string, channel: Channel) => call<Challenge>('POST', '/auth/recover', { identifier, channel }),
  reset: (resetToken: string, newPassword: string) => call<{ ok: boolean }>('POST', '/auth/reset', { resetToken, newPassword }),
  logout: () => call<{ ok: boolean }>('POST', '/auth/logout', {}),
  me: () => call<{ user: UserAccount | null }>('GET', '/auth/me'),
  updateMe: (patch: Partial<UserAccount>) => call<{ user: UserAccount }>('PUT', '/me', patch),
  changePassword: (currentPassword: string, newPassword: string) => call<{ ok: boolean }>('POST', '/me/password', { currentPassword, newPassword }),
  availability: () => call<{ busy: Busy[] }>('GET', '/availability'),
  bookings: () => call<Booking[]>('GET', '/bookings'),
  createBooking: (b: BookingInput) => call<{ booking: Booking }>('POST', '/bookings', b),
  cancelBooking: (id: string) => call<{ booking: Booking }>('POST', `/bookings/${encodeURIComponent(id)}/cancel`, {}),
  patchBooking: (id: string, patch: { status?: string; paymentStatus?: string; regieNotes?: string }) =>
    call<{ booking: Booking }>('PATCH', `/bookings/${encodeURIComponent(id)}`, patch),
  notifications: () => call<NotificationLog[]>('GET', '/notifications'),
};
