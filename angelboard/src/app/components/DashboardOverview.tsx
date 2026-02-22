import { Card } from './ui/card';
import { Button } from './ui/button';
import { Shield, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardOverviewProps {
  totalResolved: number;
  onViewResolved: () => void;
  wsConnected?: boolean;
}

export function DashboardOverview({ totalResolved, onViewResolved, wsConnected }: DashboardOverviewProps) {
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
          {format(new Date(), 'PPPP')} &bull; {format(new Date(), 'pp')}
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
              <p className="text-2xl font-bold">AngelBox</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Monitoring System</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${wsConnected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {wsConnected ? (
                <Wifi className="w-6 h-6 text-green-500" />
              ) : (
                <WifiOff className="w-6 h-6 text-red-500" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">{wsConnected ? 'Connected' : 'Disconnected'}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">WebSocket Status</p>
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

      {/* System Connection Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">System Connection</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Real-time connection to backend services
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${wsConnected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {wsConnected ? (
              <Wifi className={`w-4 h-4 text-green-500`} />
            ) : (
              <WifiOff className={`w-4 h-4 text-red-500`} />
            )}
            <span className={`text-sm font-medium ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
              {wsConnected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {wsConnected
              ? 'Dashboard is receiving real-time alerts and video frames.'
              : 'Connection lost. Attempting to reconnect automatically...'}
          </p>
        </div>
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
