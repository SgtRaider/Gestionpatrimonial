import { dashboardSchema, type Dashboard } from '@gp/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string, parser: (raw: unknown) => T): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }
  const json: unknown = await res.json();
  return parser(json);
}

export const api = {
  getDashboard: (): Promise<Dashboard> =>
    get('/api/dashboard', (raw) => dashboardSchema.parse(raw)),
};
