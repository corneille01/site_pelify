import type { AppNotification, ArenaEventView, Participant, ReportView, UserAccount } from '../types';

export type Channel = 'email' | 'sms' | 'whatsapp';

export interface ServerConfig {
  demo: boolean;
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
}

export interface Challenge {
  challenge: string;
  channel: Channel;
  destination: string;
  expiresInMinutes: number;
  demoCode?: string;
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
  pseudo: string;
  email: string;
  phone: string;
  countryCode: string;
  password: string;
  channel: Channel;
  accept: boolean;
}

export type EventInput = Partial<Omit<ArenaEventView, 'id' | 'status' | 'taken'>>;

export interface AdminOverview {
  stats: { users: number; events: number; open: number; reports: number };
  users: { id: string; pseudo: string; email: string; createdAt: string; disabled: boolean; verified: boolean }[];
  events: ArenaEventView[];
  reports: ReportView[];
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
  exportMe: () => call<unknown>('GET', '/me/export'),
  deleteMe: (password: string) => call<{ ok: boolean }>('DELETE', '/me', { password }),

  events: () => call<ArenaEventView[]>('GET', '/events'),
  event: (id: string) => call<{ event: ArenaEventView; participants: Participant[] }>('GET', `/events/${encodeURIComponent(id)}`),
  createEvent: (b: EventInput) => call<{ event: ArenaEventView }>('POST', '/events', b),
  updateEvent: (id: string, b: EventInput) => call<{ event: ArenaEventView }>('PUT', `/events/${encodeURIComponent(id)}`, b),
  cancelEvent: (id: string) => call<{ event: ArenaEventView }>('POST', `/events/${encodeURIComponent(id)}/cancel`, {}),
  finishEvent: (id: string, result: string) => call<{ event: ArenaEventView }>('POST', `/events/${encodeURIComponent(id)}/finish`, { result }),
  join: (id: string) => call<{ status: string }>('POST', `/events/${encodeURIComponent(id)}/join`, {}),
  leave: (id: string) => call<{ ok: boolean }>('POST', `/events/${encodeURIComponent(id)}/leave`, {}),
  decide: (id: string, userId: string, action: 'accept' | 'refuse') => call<{ ok: boolean }>('POST', `/events/${encodeURIComponent(id)}/participants/${encodeURIComponent(userId)}`, { action }),
  myEvents: () => call<{ created: ArenaEventView[]; joined: ArenaEventView[] }>('GET', '/me/events'),

  notifications: () => call<AppNotification[]>('GET', '/notifications'),
  markRead: (id?: string) => call<{ ok: boolean }>('POST', '/notifications/read', { id }),
  report: (targetType: 'event' | 'user', targetId: string, reason: string) => call<{ ok: boolean }>('POST', '/reports', { targetType, targetId, reason }),

  admin: () => call<AdminOverview>('GET', '/admin/overview'),
  resolveReport: (id: string) => call<{ ok: boolean }>('POST', `/admin/reports/${encodeURIComponent(id)}/resolve`, {}),
  setUserDisabled: (id: string, disabled: boolean) => call<{ ok: boolean }>('POST', `/admin/users/${encodeURIComponent(id)}/${disabled ? 'disable' : 'enable'}`, {}),
};
