import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { mockAngelBoxes } from '../data/mockAngelBoxes';
import { Badge } from './ui/badge';
import { MapPin, Wifi, WifiOff, Wrench, Video, Map as MapIcon, List } from 'lucide-react';
import { useState } from 'react';

interface MapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBoxId?: string;
  onBoxClick?: (boxId: string) => void;
}

const statusConfig = {
  online: {
    color: 'bg-green-500',
    icon: Wifi,
    label: 'Online',
    badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  offline: {
    color: 'bg-red-500',
    icon: WifiOff,
    label: 'Offline',
    badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  maintenance: {
    color: 'bg-yellow-500',
    icon: Wrench,
    label: 'Maintenance',
    badgeClass: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
};

export function MapDialog({ open, onOpenChange, activeBoxId, onBoxClick }: MapDialogProps) {
  const [radiusMiles, setRadiusMiles] = useState(1.0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  
  const onlineCount = mockAngelBoxes.filter(box => box.status === 'online').length;
  const offlineCount = mockAngelBoxes.filter(box => box.status === 'offline').length;
  const maintenanceCount = mockAngelBoxes.filter(box => box.status === 'maintenance').length;
  
  const activeBox = mockAngelBoxes.find(box => box.id === activeBoxId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-5xl h-[85vh] max-h-[85vh] resize overflow-auto">
        <DialogHeader>
          <DialogTitle>AngelBox Locations</DialogTitle>
          <DialogDescription>Manage and view the status of AngelBoxes in your area.</DialogDescription>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>{onlineCount} Online</span>
              </div>
              {maintenanceCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>{maintenanceCount} Maintenance</span>
                </div>
              )}
              {offlineCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>{offlineCount} Offline</span>
                </div>
              )}
              {activeBox && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Active: {activeBox.id}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === 'map' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('map')}
                  className="h-7 px-2"
                >
                  <MapIcon className="w-3 h-3 mr-1" />
                  Map
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 px-2"
                >
                  <List className="w-3 h-3 mr-1" />
                  List
                </Button>
              </div>
              
              {/* Radius control - only show in map mode */}
              {viewMode === 'map' && activeBoxId && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="radius" className="text-sm whitespace-nowrap">Radius:</Label>
                  <Input
                    id="radius"
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={radiusMiles}
                    onChange={(e) => setRadiusMiles(parseFloat(e.target.value) || 0.5)}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">mi</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Map View */}
          {viewMode === 'map' && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg h-96 relative overflow-hidden">
              {/* Simple grid background to simulate map */}
              <div className="absolute inset-0 opacity-20">
                <div className="w-full h-full" style={{
                  backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }} />
              </div>

              {/* AngelBox Markers */}
              {mockAngelBoxes.map((box, index) => {
                const isActive = box.id === activeBoxId;
                const config = statusConfig[box.status];
                const Icon = config.icon;
                
                // Position boxes in a spread across the map
                const positions = [
                  { top: '20%', left: '25%' },
                  { top: '30%', left: '65%' },
                  { top: '45%', left: '35%' },
                  { top: '60%', left: '70%' },
                  { top: '70%', left: '20%' },
                  { top: '55%', left: '80%' },
                  { top: '35%', left: '50%' },
                ];
                
                return (
                  <div
                    key={box.id}
                    className="absolute group cursor-pointer"
                    style={positions[index] || { top: '50%', left: '50%' }}
                    onClick={() => {
                      if (onBoxClick) {
                        onBoxClick(box.id);
                        onOpenChange(false);
                      }
                    }}
                  >
                    {/* Radius circle for active box */}
                    {isActive && (
                      <div 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-blue-500/40 bg-blue-500/10 rounded-full pointer-events-none"
                        style={{
                          width: `${radiusMiles * 100}px`,
                          height: `${radiusMiles * 100}px`,
                        }}
                      />
                    )}
                    
                    <div className="relative z-10 transition-transform group-hover:scale-110">
                      <MapPin 
                        className={`w-8 h-8 drop-shadow-lg transition-all ${
                          isActive 
                            ? 'text-blue-500' 
                            : config.color === 'bg-green-500' 
                              ? 'text-green-500' 
                              : config.color === 'bg-red-500' 
                                ? 'text-red-500' 
                                : 'text-yellow-500'
                        }`} 
                        fill="currentColor" 
                      />
                      <div className={`absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${
                        isActive ? 'bg-blue-500' : config.color
                      }`} />
                      
                      {/* Video icon for online boxes */}
                      {box.status === 'online' && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5 border-2 border-white dark:border-slate-900">
                          <Video className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                        </div>
                      )}
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="bg-black/90 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                          <div className="font-semibold flex items-center gap-1">
                            {box.id} {isActive && '(Active)'}
                            {box.status === 'online' && <Video className="w-3 h-3" />}
                          </div>
                          <div className="text-white/80">{box.location}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <Icon className="w-3 h-3" />
                            <span>{config.label}</span>
                          </div>
                          {box.status === 'online' && (
                            <div className="text-white/70 mt-1 text-[10px]">Click to view feed</div>
                          )}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-black/90" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
              {mockAngelBoxes.map(box => {
                const isActive = box.id === activeBoxId;
                const config = statusConfig[box.status];
                const Icon = config.icon;
                
                return (
                  <button
                    key={box.id}
                    onClick={() => {
                      if (onBoxClick && box.status === 'online') {
                        onBoxClick(box.id);
                        onOpenChange(false);
                      }
                    }}
                    disabled={box.status !== 'online'}
                    className={`flex items-center gap-3 p-3 border rounded-lg transition-all text-left ${
                      box.status === 'online' ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-60'
                    } ${
                      isActive 
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-500' 
                        : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : config.badgeClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {box.id}
                        {isActive && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {box.location}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${isActive ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : config.badgeClass}`}>
                        {config.label}
                      </Badge>
                      {box.status === 'online' && (
                        <Video className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}