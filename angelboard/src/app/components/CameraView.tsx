import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import { Activity, PlayCircle, Wifi, WifiOff, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { mockAngelBoxes } from '../data/mockAngelBoxes';
import { WebRTCPlayer } from './WebRTCPlayer';

interface CameraViewProps {
  cameraId: string;
}

export function CameraView({ cameraId }: CameraViewProps) {
  const [isLive, setIsLive] = useState(true);
  const [timelinePosition, setTimelinePosition] = useState(100); // 100 = live, 0 = start
  
  // Get the AngelBox info
  const angelBox = mockAngelBoxes.find(box => box.id === cameraId);
  
  if (!angelBox) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>Camera not found</p>
      </div>
    );
  }
  
  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Offline' },
    maintenance: { icon: Wrench, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Maintenance' },
  };
  
  const statusInfo = statusConfig[angelBox.status];
  const StatusIcon = statusInfo.icon;

  const handleTimelineChange = (value: number[]) => {
    const newPosition = value[0];
    setTimelinePosition(newPosition);
    setIsLive(newPosition === 100);
  };

  const getCurrentTimestamp = () => {
    if (isLive) {
      return new Date();
    }
    // Calculate timestamp based on slider position (last 5 minutes of footage)
    const currentTime = new Date().getTime();
    const startTime = currentTime - 5 * 60000; // 5 minutes ago
    const calculatedTime = startTime + (timelinePosition / 100) * (5 * 60000);
    return new Date(calculatedTime);
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Video Feed */}
      <ResizablePanel defaultSize={70} minSize={50}>
        <div className="flex flex-col h-full pr-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Camera View</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">AngelBox {angelBox.id}</p>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${statusInfo.bg}`}>
                  <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                  <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
              </div>
            </div>
          </div>
          
          <Card className="flex-1 bg-black relative overflow-hidden flex flex-col">
            {/* WebRTC Video Feed */}
            <div className="flex-1 relative">
              <WebRTCPlayer 
                streamUrl={`wss://angelbox-${angelBox.id}.stream`}
                cameraId={angelBox.id}
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
              </div>
            </div>
          </Card>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Camera Information */}
      <ResizablePanel defaultSize={30} minSize={20}>
        <div className="flex flex-col h-full pl-3">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Camera Information</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">AngelBox {angelBox.id}</p>
          </div>

          <Card className="flex-1 p-6 overflow-auto">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Location</p>
                <p className="text-sm font-medium">{angelBox.location}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Status</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusInfo.bg}`}>
                  <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                  <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Coordinates</p>
                <p className="text-sm font-mono">{angelBox.coordinates.lat.toFixed(6)}, {angelBox.coordinates.lng.toFixed(6)}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Coverage Area</p>
                <p className="text-sm">360° surveillance</p>
              </div>

              {angelBox.status === 'offline' && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Camera is currently offline. Please check connection or contact maintenance.
                  </p>
                </div>
              )}

              {angelBox.status === 'maintenance' && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Camera is under scheduled maintenance. Service will resume shortly.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}