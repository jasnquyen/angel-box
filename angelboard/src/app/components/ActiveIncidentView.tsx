import { useState } from 'react';
import type { Incident, FeedbackType } from '../types/incident';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { Slider } from './ui/slider';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import { AlertCircle, Activity, Flame, Wrench, Heart, ShoppingBag, CheckCircle, Clock, PlayCircle, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { mockAngelBoxes } from '../data/mockAngelBoxes';
import { WebRTCPlayer } from './WebRTCPlayer';

interface ActiveIncidentViewProps {
  incident: Incident;
  onFeedback: (incidentId: string, feedback: FeedbackType) => void;
  onResolve: (incidentId: string, notes: string) => void;
  preIncidentBuffer: number;
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

export function ActiveIncidentView({ incident, onFeedback, onResolve, preIncidentBuffer }: ActiveIncidentViewProps) {
  const [localFeedback, setLocalFeedback] = useState<FeedbackType>(incident.feedback || 'pending');
  const [notes, setNotes] = useState(incident.notes || '');
  const [isLive, setIsLive] = useState(true);
  const [timelinePosition, setTimelinePosition] = useState(100); // 100 = live, 0 = start
  const Icon = incidentIcons[incident.type];
  
  // Get the AngelBox status
  const angelBox = mockAngelBoxes.find(box => box.id === incident.boxId);
  const boxStatus = angelBox?.status || 'offline';
  
  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Offline' },
    maintenance: { icon: Wrench, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Maintenance' },
  };
  
  const statusInfo = statusConfig[boxStatus];
  const StatusIcon = statusInfo.icon;

  // Generate notable timestamps (mock data - would come from actual video analysis)
  const notableTimestamps = [
    { position: 25, label: 'Motion detected', time: new Date(new Date(incident.timestamp).getTime() - 3 * 60000) },
    { position: 50, label: 'Subject approached', time: new Date(new Date(incident.timestamp).getTime() - 2 * 60000) },
    { position: 75, label: 'Incident occurred', time: new Date(incident.timestamp) },
  ];

  const handleTimelineChange = (value: number[]) => {
    const newPosition = value[0];
    setTimelinePosition(newPosition);
    setIsLive(newPosition === 100);
  };

  const getCurrentTimestamp = () => {
    if (isLive) {
      return new Date();
    }
    // Calculate timestamp based on slider position
    const incidentTime = new Date(incident.timestamp).getTime();
    const startTime = incidentTime - preIncidentBuffer * 60000; // preIncidentBuffer minutes before incident
    const currentTime = startTime + (timelinePosition / 100) * (preIncidentBuffer * 60000);
    return new Date(currentTime);
  };

  const handleFeedback = (feedback: FeedbackType) => {
    setLocalFeedback(feedback);
    onFeedback(incident.id, feedback);
  };

  const handleResolve = () => {
    onResolve(incident.id, notes);
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Video Feed */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex flex-col h-full pr-3">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Video Feed</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">AngelBox {incident.boxId}</p>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${statusInfo.bg}`}>
                <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
            </div>
          </div>
          
          <Card className="flex-1 bg-black relative overflow-hidden flex flex-col">
            {/* WebRTC Video Feed */}
            <div className="flex-1 relative">
              <WebRTCPlayer 
                streamUrl={`wss://angelbox-${incident.boxId}.stream`}
                cameraId={incident.boxId}
              />
              
              {/* Video overlay elements */}
              <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-20 pointer-events-none">
                {isLive && (
                  <div className="bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2 text-white text-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="font-mono">LIVE</span>
                    </div>
                  </div>
                )}
                <div className={`bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg ${!isLive ? 'ml-auto' : ''}`}>
                  <p className="text-white text-sm font-mono">
                    {format(getCurrentTimestamp(), 'PPpp')}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline Slider */}
            <div className="p-4 bg-black/80 backdrop-blur-sm border-t border-white/10">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <PlayCircle className="w-4 h-4 text-white shrink-0" />
                  <Slider
                    value={[timelinePosition]}
                    onValueChange={handleTimelineChange}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTimelineChange([100])}
                    className="text-white hover:text-white hover:bg-white/10 shrink-0"
                  >
                    Go Live
                  </Button>
                </div>
                
                {/* Notable Timestamps */}
                <div className="flex items-center justify-between text-xs text-white/60">
                  {notableTimestamps.map((timestamp, index) => (
                    <button
                      key={index}
                      onClick={() => handleTimelineChange([timestamp.position])}
                      className="flex flex-col items-center hover:text-white/90 transition-colors"
                    >
                      <span className="font-mono">{format(timestamp.time, 'HH:mm:ss')}</span>
                      <span className="text-[10px] mt-0.5">{timestamp.label}</span>
                    </button>
                  ))}
                  <div className="flex flex-col items-center">
                    <span className="font-mono">{isLive ? format(new Date(), 'HH:mm:ss') : 'LIVE'}</span>
                    <span className="text-[10px] mt-0.5">Current</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Incident Information */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex flex-col h-full pl-3">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Incident Information</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Case {incident.id}</p>
          </div>

          <Card className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              {/* Incident Type & Icon */}
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-xl ${threatColors[incident.threatLevel]}`}>
                  <Icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {incident.type.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {incident.location}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">First Detected</p>
                  <p className="text-sm font-medium">{format(new Date(incident.timestamp), 'PPpp')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true })}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">AngelBox ID</p>
                  <p className="text-sm font-medium font-mono">{incident.boxId}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Threat Level</p>
                  <Badge className={`${threatColors[incident.threatLevel]} mt-1`}>
                    {incident.threatLevel.toUpperCase()}
                  </Badge>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Confidence Level</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full transition-all"
                        style={{ width: `${incident.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{incident.confidence}%</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Feedback Selector */}
              <div>
                <p className="text-sm font-medium mb-3">Dispatcher Feedback</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={localFeedback === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFeedback('pending')}
                    className="flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Pending
                  </Button>
                  <Button
                    variant={localFeedback === 'confirmed-threat' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFeedback('confirmed-threat')}
                    className="flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Confirm Threat
                  </Button>
                  <Button
                    variant={localFeedback === 'false-alarm' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFeedback('false-alarm')}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    False Alarm
                  </Button>
                </div>

                {localFeedback !== 'pending' && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    localFeedback === 'confirmed-threat' 
                      ? 'bg-red-500/10 border border-red-500/20' 
                      : 'bg-green-500/10 border border-green-500/20'
                  }`}>
                    <div className="flex items-center gap-2">
                      {localFeedback === 'confirmed-threat' ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      <p className="text-sm font-medium">
                        {localFeedback === 'confirmed-threat' 
                          ? 'Threat confirmed - Dispatching units' 
                          : 'Marked as false alarm'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {incident.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Notes</p>
                    <p className="text-sm">{incident.notes}</p>
                  </div>
                </>
              )}

              <Separator />

              {/* Resolve Incident */}
              <div>
                <p className="text-sm font-medium mb-3">Resolve Incident</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes for resolution..."
                  className="w-full"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleResolve}
                  className="mt-2"
                >
                  Resolve
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}