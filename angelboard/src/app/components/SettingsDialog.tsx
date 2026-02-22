import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preIncidentBuffer: number;
  onPreIncidentBufferChange: (minutes: number) => void;
}

export function SettingsDialog({ open, onOpenChange, preIncidentBuffer, onPreIncidentBufferChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account settings and preferences.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Appearance Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Appearance</h3>
            
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    theme === 'light' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  <span className="text-xs font-medium">Light</span>
                </button>

                <button
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    theme === 'dark' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-xs font-medium">Dark</span>
                </button>

                <button
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    theme === 'system' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                  <span className="text-xs font-medium">System</span>
                </button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Pre-Incident Buffer Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Video Playback</h3>
            
            <div className="space-y-2">
              <Label htmlFor="pre-incident-buffer">Pre-Incident Buffer (minutes)</Label>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Start video playback X minutes before incident detection
              </p>
              <Input
                id="pre-incident-buffer"
                type="number"
                min="1"
                max="30"
                value={preIncidentBuffer}
                onChange={(e) => onPreIncidentBufferChange(Number(e.target.value) || 5)}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}