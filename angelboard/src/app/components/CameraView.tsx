import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import { Activity, PlayCircle, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { WebSocketPlayer } from './WebSocketPlayer';
import type { LiveFrame } from '../hooks/useBackend';

interface CameraViewProps {
  cameraId: string;
  liveFrame?: LiveFrame | null;
}

export function CameraView({ cameraId, liveFrame }: CameraViewProps) {
  const [isLive, setIsLive] = useState(true);
  const [timelinePosition, setTimelinePosition] = useState(100);

  const statusInfo = { icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Online' };
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
    const currentTime = new Date().getTime();
    const startTime = currentTime - 5 * 60000;
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
                <p className="text-sm text-slate-600 dark:text-slate-400">AngelBox {cameraId}</p>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${statusInfo.bg}`}>
                  <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                  <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
              </div>
            </div>
          </div>

          <Card className="flex-1 bg-black relative overflow-hidden flex flex-col">
            {/* WebSocket Video Feed */}
            <div className="flex-1 relative">
              <WebSocketPlayer
                streamUrl={`wss://angelbox-${cameraId}.stream`}
                cameraId={cameraId}
                liveFrame={liveFrame}
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
            <p className="text-sm text-slate-600 dark:text-slate-400">AngelBox {cameraId}</p>
          </div>

          <Card className="flex-1 p-6 overflow-auto">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Device ID</p>
                <p className="text-sm font-medium font-mono">{cameraId}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Status</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusInfo.bg}`}>
                  <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                  <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Coverage Area</p>
                <p className="text-sm">360° surveillance</p>
              </div>
            </div>
          </Card>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
