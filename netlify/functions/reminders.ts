import { sendReminders } from '../../apps/live/server/app';

// Exécutée chaque heure par Netlify : prévient les participants des événements qui commencent dans les 24 heures.
export default async () => {
  const n = await sendReminders();
  return new Response(JSON.stringify({ rappels: n }), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '@hourly' };
