import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

interface WebSocketPlayerProps {
  streamUrl: string;
  cameraId: string;
  onConnectionStateChange?: (state: string) => void;
}

export function WebSocketPlayer({ streamUrl, cameraId, onConnectionStateChange }: WebSocketPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let animationFrameId: number;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        setConnectionState('connecting');
        setError(null);

        // In production, this would connect to actual WebSocket server
        // ws = new WebSocket(streamUrl);
        
        // For demo, we'll simulate WebSocket connection
        const simulateConnection = () => {
          setConnectionState('connected');
          onConnectionStateChange?.('connected');
          startMockStream();
        };

        setTimeout(simulateConnection, 1000);

        // Production WebSocket handlers (commented out for demo)
        /*
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          console.log('WebSocket connected to', streamUrl);
          setConnectionState('connected');
          setError(null);
          onConnectionStateChange?.('connected');
        };

        ws.onmessage = (event) => {
          // Handle incoming video frames
          if (event.data instanceof ArrayBuffer) {
            renderFrame(event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error occurred');
          setConnectionState('error');
          onConnectionStateChange?.('error');
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          setConnectionState('disconnected');
          onConnectionStateChange?.('disconnected');
          
          // Attempt reconnection after 3 seconds
          reconnectTimeout = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        };

        wsRef.current = ws;
        */
      } catch (err) {
        console.error('WebSocket connection error:', err);
        setError('Failed to connect to stream');
        setConnectionState('error');
        onConnectionStateChange?.('error');
      }
    };

    // Mock streaming for demonstration
    const startMockStream = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frame = 0;

      const renderMockFrame = () => {
        // Create animated video frame
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `hsl(${(frame + 200) % 360}, 20%, 15%)`);
        gradient.addColorStop(1, `hsl(${(frame + 250) % 360}, 20%, 25%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add animated elements to simulate camera feed
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = 0; i < 5; i++) {
          const x = (Math.sin(frame * 0.01 + i) * 200) + canvas.width / 2;
          const y = (Math.cos(frame * 0.015 + i) * 150) + canvas.height / 2;
          ctx.beginPath();
          ctx.arc(x, y, 50, 0, Math.PI * 2);
          ctx.fill();
        }

        // Add camera info overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '24px monospace';
        ctx.fillText(`Camera ${cameraId} - ${new Date().toLocaleTimeString()}`, 20, 40);
        
        // Add WebSocket indicator
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.fillRect(20, 60, 12, 12);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '16px monospace';
        ctx.fillText('LIVE • WebSocket Stream', 40, 71);

        // Add scanline effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 2;
        for (let y = 0; y < canvas.height; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        frame++;
        animationFrameId = requestAnimationFrame(renderMockFrame);
      };

      renderMockFrame();
    };

    // Production frame rendering function
    /*
    const renderFrame = (frameData: ArrayBuffer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Convert ArrayBuffer to image and render
      const blob = new Blob([frameData], { type: 'image/jpeg' });
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    };
    */

    connectWebSocket();

    // Cleanup
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [streamUrl, cameraId, onConnectionStateChange]);

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

      {/* Loading State */}
      {connectionState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
            <p className="text-white text-sm">Establishing WebSocket connection...</p>
            <p className="text-white/60 text-xs mt-1 font-mono">{streamUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}
