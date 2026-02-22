import type { Incident } from '../types/incident';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { AlertCircle, Activity, Flame, Wrench, Heart, ShoppingBag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface IncidentCardProps {
  incident: Incident;
  onClick?: () => void;
}

const incidentIcons = {
  'suspicious-activity': Activity,
  'assault': AlertCircle,
  'vandalism': Wrench,
  'medical-emergency': Heart,
  'fire': Flame,
  'theft': ShoppingBag,
};

const threatColors = {
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export function IncidentCard({ incident, onClick }: IncidentCardProps) {
  const Icon = incidentIcons[incident.type];
  
  return (
    <Card 
      className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border ${onClick ? '' : 'cursor-default'}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${threatColors[incident.threatLevel]}`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-medium text-sm">
                {incident.type.split('-').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {incident.location} • {incident.boxId}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {incident.id}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span>{formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true })}</span>
            <span>•</span>
            <span>Confidence: {incident.confidence}%</span>
            <span>•</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${threatColors[incident.threatLevel]}`}
            >
              {incident.threatLevel.toUpperCase()}
            </Badge>
          </div>
          
          {incident.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-1">
              {incident.notes}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
