import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import type { LiveFrame } from '../hooks/useBackend';

interface WebSocketPlayerProps {
  streamUrl: string;
  cameraId: string;
  liveFrame?: LiveFrame | null;
  onConnectionStateChange?: (state: string) => void;
}

export function WebSocketPlayer({ streamUrl, cameraId, liveFrame, onConnectionStateChange }: WebSocketPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Update connection state based on whether we're receiving frames
  useEffect(() => {
    if (liveFrame) {
      setConnectionState('connected');
      setError(null);
      onConnectionStateChange?.('connected');
    } else {
      setConnectionState('connecting');
      onConnectionStateChange?.('connecting');
    }
  }, [liveFrame, onConnectionStateChange]);

  // Render incoming base64 frames to canvas
  useEffect(() => {
    if (!liveFrame) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      setError('Failed to decode frame');
    };
    img.src = liveFrame.dataUrl;
  }, [liveFrame]);

  const getConnectionStateDisplay = () => {
    switch (connectionState) {
      case 'connecting':
        return {
          icon: Loader2,
          label: 'Connecting...',
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10',
          animate: true,
        };
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connected',
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          animate: false,
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          label: 'Disconnected',
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          animate: false,
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Error',
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          animate: false,
        };
      default:
        return {
          icon: WifiOff,
          label: 'Unknown',
          color: 'text-slate-500',
          bg: 'bg-slate-500/10',
          animate: false,
        };
    }
  };

  const stateDisplay = getConnectionStateDisplay();
  const StateIcon = stateDisplay.icon;

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Canvas for video rendering */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
      />

      {/* Waiting placeholder when no frame available */}
      {!liveFrame && connectionState !== 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
            <p className="text-white text-sm">Waiting for frames...</p>
            <p className="text-white/60 text-xs mt-1 font-mono">{streamUrl || cameraId}</p>
          </div>
        </div>
      )}

      {/* Connection State Overlay */}
      <div className="absolute top-4 right-4 z-10">
        <Badge className={`${stateDisplay.bg} border-0`}>
          <StateIcon
            className={`w-3 h-3 mr-1.5 ${stateDisplay.color} ${stateDisplay.animate ? 'animate-spin' : ''}`}
          />
          <span className={stateDisplay.color}>{stateDisplay.label}</span>
        </Badge>
      </div>

      {/* Protocol Badge */}
      <div className="absolute top-4 left-4 z-10">
        <Badge variant="secondary" className="bg-slate-900/80 text-white border-0 font-mono text-xs">
          WebSocket
        </Badge>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="p-3 bg-red-500/10 border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
