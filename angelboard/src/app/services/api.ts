import type { BackendAlert, BackendIncident } from '../types/backend';

const API_URL = import.meta.env.VITE_API_URL as string;
const FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchAlerts(limit = 100): Promise<BackendAlert[]> {
  const res = await fetchWithTimeout(`${API_URL}/alerts?limit=${limit}`);
  if (!res.ok) throw new Error(`GET /alerts failed: ${res.status}`);
  return res.json();
}

export async function fetchIncidents(limit = 100): Promise<BackendIncident[]> {
  const res = await fetchWithTimeout(`${API_URL}/incidents?limit=${limit}`);
  if (!res.ok) throw new Error(`GET /incidents failed: ${res.status}`);
  return res.json();
}

export async function patchAlertFeedback(
  alertId: number,
  status: 'pending' | 'confirmed_threat' | 'false_alarm',
): Promise<BackendAlert> {
  const res = await fetchWithTimeout(`${API_URL}/alerts/${alertId}/feedback`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`PATCH /alerts/${alertId}/feedback failed: ${res.status}`);
  return res.json();
}

export interface BackendClip {
  clip_url: string;
  timestamp: string;
  device_id: number | null;
  incident_id: number | null;
  bytes: number;
}

export async function fetchClips(): Promise<BackendClip[]> {
  const res = await fetchWithTimeout(`${API_URL}/clips`);
  if (!res.ok) throw new Error(`GET /clips failed: ${res.status}`);
  return res.json();
}

/** Convert the HTTP API URL to a WebSocket URL for /ws/dashboard */
export function getDashboardWsUrl(): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/dashboard';
  return url.toString();
}

/** Resolve a relative media path (e.g. /media/clips/foo.avi) to a full URL */
export function getMediaUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
