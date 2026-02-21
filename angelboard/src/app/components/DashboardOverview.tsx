import { Card } from './ui/card';
import { Button } from './ui/button';
import { Shield, CheckCircle2, Wifi, WifiOff, Wrench, Activity } from 'lucide-react';
import { mockAngelBoxes } from '../data/mockAngelBoxes';
import { format } from 'date-fns';

interface DashboardOverviewProps {
  totalResolved: number;
  onViewResolved: () => void;
}

export function DashboardOverview({ totalResolved, onViewResolved }: DashboardOverviewProps) {
  const onlineBoxes = mockAngelBoxes.filter(box => box.status === 'online').length;
  const offlineBoxes = mockAngelBoxes.filter(box => box.status === 'offline').length;
  const maintenanceBoxes = mockAngelBoxes.filter(box => box.status === 'maintenance').length;
  const totalBoxes = mockAngelBoxes.length;

  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Offline' },
    maintenance: { icon: Wrench, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Maintenance' },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Status */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold mb-2">All Clear</h2>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          No active incidents at this time
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
          {format(new Date(), 'PPPP')} • {format(new Date(), 'pp')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBoxes}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total AngelBoxes</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Wifi className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineBoxes}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Online</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalResolved}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Resolved Today</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AngelBox Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">AngelBox Network Status</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Real-time status of all monitoring units
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {mockAngelBoxes.map(box => {
            const statusInfo = statusConfig[box.status];
            const StatusIcon = statusInfo.icon;
            
            return (
              <div
                key={box.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium font-mono text-sm">AngelBox {box.id}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {box.location}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusInfo.bg}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                  <span className={`text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {(offlineBoxes > 0 || maintenanceBoxes > 0) && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                  System Status Alert
                </p>
                <p className="text-sm text-yellow-600/80 dark:text-yellow-500/80 mt-1">
                  {offlineBoxes > 0 && `${offlineBoxes} unit${offlineBoxes > 1 ? 's' : ''} offline`}
                  {offlineBoxes > 0 && maintenanceBoxes > 0 && ' • '}
                  {maintenanceBoxes > 0 && `${maintenanceBoxes} unit${maintenanceBoxes > 1 ? 's' : ''} in maintenance`}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3">
          <Button variant="outline" className="justify-start h-auto py-4" onClick={onViewResolved}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">Review Resolved Incidents</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  View {totalResolved} incident{totalResolved !== 1 ? 's' : ''} resolved today
                </p>
              </div>
            </div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
