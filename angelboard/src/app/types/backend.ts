/** Mirrors backend AlertOut schema */
export interface BackendAlert {
  id: number;
  incident_id: number;
  timestamp: string; // ISO datetime
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  label: string; // e.g. "violence_detection"
  confidence: number; // 0.0–1.0
  threat_score: number; // 0.0–1.0
  frame_url: string | null;
  gemini_narration: string | null;
  status: 'pending' | 'confirmed_threat' | 'false_alarm';
}

/** Mirrors backend IncidentOut schema */
export interface BackendIncident {
  id: number;
  device_id: number | null;
  latitude: number;
  longitude: number;
  label: string;
  status: string; // "open", "resolved", etc.
  first_seen: string; // ISO datetime
  last_seen: string; // ISO datetime
  event_count: number;
  max_confidence: number; // 0.0–1.0
  max_threat_score: number; // 0.0–1.0
  last_frame_url: string | null;
}

// ── WebSocket message payloads ──

export interface WsFrameLive {
  device_id: string;
  frame_b64: string;
  threat_score: number;
  threat_level: string;
  people: unknown[];
  timestamp: number | string;
}

export interface WsAlertCreated {
  alert_id: number;
  incident_id: number;
  device_id: number | null;
  timestamp: string;
  threat_level: string;
  label: string;
  confidence: number;
  threat_score: number;
  latitude: number;
  longitude: number;
  frame_url: string | null;
  gemini_narration: string | null;
}

export interface WsAlertTriaged {
  alert_id: number;
  incident_id: number;
  status: 'pending' | 'confirmed_threat' | 'false_alarm';
}

export interface WsClipUploaded {
  timestamp: string;
  device_id: string | null;
  incident_id: number | null;
  clip_url: string;
  bytes: number;
}

export type WsMessage =
  | { type: 'frame.live'; payload: WsFrameLive }
  | { type: 'alert.created'; version: number; payload: WsAlertCreated }
  | { type: 'alert.triaged'; version: number; payload: WsAlertTriaged }
  | { type: 'clip.uploaded'; version: number; payload: WsClipUploaded };
