import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

interface WebRTCPlayerProps {
  streamUrl: string;
  cameraId: string;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export function WebRTCPlayer({ streamUrl, cameraId, onConnectionStateChange }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pc: RTCPeerConnection | null = null;

    const initializeWebRTC = async () => {
      try {
        // Create peer connection
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        peerConnectionRef.current = pc;

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          const state = pc?.connectionState || 'failed';
          setConnectionState(state);
          onConnectionStateChange?.(state);

          if (state === 'failed') {
            setError('Connection failed. Retrying...');
            // In production, implement retry logic here
          } else if (state === 'connected') {
            setError(null);
          }
        };

        // Handle ICE connection state changes
        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc?.iceConnectionState);
        };

        // Handle incoming tracks
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            // In production, send candidate to signaling server
            console.log('ICE candidate:', event.candidate);
          }
        };

        // Mock: Create offer (in production, this would involve signaling server)
        // For demo purposes, we'll simulate a successful connection
        setConnectionState('connecting');
        
        // Simulate connection establishment
        setTimeout(() => {
          setConnectionState('connected');
          
          // Create a mock video stream for demonstration
          // In production, this would come from the actual WebRTC stream
          createMockVideoStream();
        }, 1500);

      } catch (err) {
        console.error('WebRTC initialization error:', err);
        setError('Failed to initialize video stream');
        setConnectionState('failed');
      }
    };

    // Create a mock video stream for demonstration purposes
    const createMockVideoStream = async () => {
      try {
        // Create a canvas element to generate mock video
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        // Animation frame for mock video
        let frame = 0;
        const animate = () => {
          if (!ctx) return;

          // Create a gradient background that changes over time
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          gradient.addColorStop(0, `hsl(${(frame + 200) % 360}, 20%, 15%)`);
          gradient.addColorStop(1, `hsl(${(frame + 250) % 360}, 20%, 25%)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Add some visual elements to simulate camera feed
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          for (let i = 0; i < 5; i++) {
            const x = (Math.sin(frame * 0.01 + i) * 200) + canvas.width / 2;
            const y = (Math.cos(frame * 0.015 + i) * 150) + canvas.height / 2;
            ctx.beginPath();
            ctx.arc(x, y, 50, 0, Math.PI * 2);
            ctx.fill();
          }

          // Add timestamp overlay
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '24px monospace';
          ctx.fillText(`Camera ${cameraId} - ${new Date().toLocaleTimeString()}`, 20, 40);
          
          // Add WebRTC indicator
          ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
          ctx.fillRect(20, 60, 12, 12);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '16px monospace';
          ctx.fillText('LIVE • WebRTC Stream', 40, 71);

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
          requestAnimationFrame(animate);
        };

        animate();

        // Capture the canvas as a media stream
        const stream = canvas.captureStream(30); // 30 FPS
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error creating mock video stream:', err);
      }
    };

    initializeWebRTC();

    // Cleanup
    return () => {
      if (pc) {
        pc.close();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [streamUrl, cameraId, onConnectionStateChange]);

  const getConnectionStateDisplay = () => {
    switch (connectionState) {
      case 'new':
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
      case 'failed':
        return {
          icon: WifiOff,
          label: 'Disconnected',
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          animate: false,
        };
      case 'closed':
        return {
          icon: WifiOff,
          label: 'Closed',
          color: 'text-slate-500',
          bg: 'bg-slate-500/10',
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
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
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
          WebRTC
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
      {(connectionState === 'new' || connectionState === 'connecting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
            <p className="text-white text-sm">Establishing WebRTC connection...</p>
          </div>
        </div>
      )}
    </div>
  );
}
