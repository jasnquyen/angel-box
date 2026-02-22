export type IncidentStatus = 'queued' | 'in-progress' | 'resolved';
export type IncidentType = 'suspicious-activity' | 'assault' | 'vandalism' | 'medical-emergency' | 'fire' | 'theft';
export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackType = 'pending' | 'confirmed-threat' | 'false-alarm';

export interface Incident {
  id: string;
  type: IncidentType;
  timestamp: string;
  threatLevel: ThreatLevel;
  confidence: number; // 0-100
  status: IncidentStatus;
  feedback?: FeedbackType;
  location: string;
  boxId: string;
  videoFeedUrl?: string;
  notes?: string;
  // Optional backend fields
  backendAlertId?: number;
  backendIncidentId?: number;
  latitude?: number;
  longitude?: number;
  frameUrl?: string;
  geminiNarration?: string;
  threatScore?: number;
  clipUrls?: string[];
}
