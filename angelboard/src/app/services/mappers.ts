import type { BackendAlert, BackendIncident, WsAlertCreated } from '../types/backend';
import type { Incident, IncidentType, FeedbackType, ThreatLevel } from '../types/incident';

// ── Confidence ──

/** Backend 0.0–1.0 → Frontend 0–100 */
export function confidenceToPercent(c: number): number {
  return Math.round(c * 100);
}

// ── Feedback / status mapping ──

const feedbackFromBackend: Record<string, FeedbackType> = {
  pending: 'pending',
  confirmed_threat: 'confirmed-threat',
  false_alarm: 'false-alarm',
};

const feedbackToBackend: Record<string, 'pending' | 'confirmed_threat' | 'false_alarm'> = {
  'pending': 'pending',
  'confirmed-threat': 'confirmed_threat',
  'false-alarm': 'false_alarm',
};

export function mapFeedbackFromBackend(status: string): FeedbackType {
  return feedbackFromBackend[status] ?? 'pending';
}

export function mapFeedbackToBackend(feedback: FeedbackType): 'pending' | 'confirmed_threat' | 'false_alarm' {
  return feedbackToBackend[feedback] ?? 'pending';
}

// ── Label → IncidentType ──

const labelToType: Record<string, IncidentType> = {
  violence_detection: 'assault',
  suspicious_activity: 'suspicious-activity',
  vandalism: 'vandalism',
  medical_emergency: 'medical-emergency',
  fire: 'fire',
  theft: 'theft',
};

function mapLabel(label: string): IncidentType {
  return labelToType[label] ?? 'suspicious-activity';
}

// ── Location string from lat/lng ──

function formatLocation(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ── Full Alert → Incident conversion ──

export function alertToIncident(
  alert: BackendAlert,
  parentIncident?: BackendIncident,
): Incident {
  const lat = parentIncident?.latitude ?? 0;
  const lng = parentIncident?.longitude ?? 0;

  return {
    id: `ALT-${String(alert.id).padStart(3, '0')}`,
    type: mapLabel(alert.label),
    timestamp: alert.timestamp,
    threatLevel: alert.threat_level as ThreatLevel,
    confidence: confidenceToPercent(alert.confidence),
    status: alert.status === 'pending' ? 'queued' : 'resolved',
    feedback: mapFeedbackFromBackend(alert.status),
    location: formatLocation(lat, lng),
    boxId: parentIncident?.device_id != null ? String(parentIncident.device_id) : 'unknown',
    frameUrl: alert.frame_url ?? undefined,
    geminiNarration: alert.gemini_narration ?? undefined,
    backendAlertId: alert.id,
    backendIncidentId: alert.incident_id,
    latitude: lat,
    longitude: lng,
    threatScore: alert.threat_score,
  };
}

// ── WS alert.created → Incident ──

export function wsAlertToIncident(payload: WsAlertCreated): Incident {
  return {
    id: `ALT-${String(payload.alert_id).padStart(3, '0')}`,
    type: mapLabel(payload.label),
    timestamp: payload.timestamp,
    threatLevel: (payload.threat_level as ThreatLevel) ?? 'medium',
    confidence: confidenceToPercent(payload.confidence),
    status: 'queued',
    feedback: 'pending',
    location: formatLocation(payload.latitude, payload.longitude),
    boxId: payload.device_id != null ? String(payload.device_id) : 'unknown',
    frameUrl: payload.frame_url ?? undefined,
    geminiNarration: payload.gemini_narration ?? undefined,
    backendAlertId: payload.alert_id,
    backendIncidentId: payload.incident_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    threatScore: payload.threat_score,
  };
}
