import serverless from 'serverless-http';
import { app } from '../../apps/live/server/app';

const run = serverless(app, { binary: false });

// Netlify transmet le chemin /.netlify/functions/api/... ; l'application attend /api/...
export const handler = async (event: any, context: any) => {
  const prefix = '/.netlify/functions/api';
  if (typeof event.path === 'string' && event.path.startsWith(prefix)) {
    event.path = '/api' + event.path.slice(prefix.length);
  }
  return run(event, context);
};
