import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { IncidentCard } from './components/IncidentCard';
import { ActiveIncidentView } from './components/ActiveIncidentView';
import { CameraView } from './components/CameraView';
import { DashboardOverview } from './components/DashboardOverview';
import { SettingsDialog } from './components/SettingsDialog';
import { ThemeProvider } from './providers/ThemeProvider';
import { mockIncidents } from './data/mockIncidents';
import type { Incident, FeedbackType } from './types/incident';
import { Shield, Clock, CheckCircle2, AlertTriangle, Settings } from 'lucide-react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(
    mockIncidents.find(i => i.status === 'in-progress')?.id || null
  );
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preIncidentBuffer, setPreIncidentBuffer] = useState(5); // minutes before incident
  const [currentTab, setCurrentTab] = useState<string>(
    mockIncidents.find(i => i.status === 'in-progress') ? 'in-progress' : 'queued'
  );

  const queuedIncidents = incidents.filter(i => i.status === 'queued');
  const inProgressIncidents = incidents.filter(i => i.status === 'in-progress');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
  
  // Show overview when there are no queued or in-progress incidents
  const showOverview = queuedIncidents.length === 0 && inProgressIncidents.length === 0;

  const handleIncidentClick = (incident: Incident) => {
    // Move all in-progress incidents back to queued
    setIncidents(prev => prev.map(i => 
      i.status === 'in-progress' 
        ? { ...i, status: 'queued' as const } 
        : i.id === incident.id 
          ? { ...i, status: 'in-progress' as const } 
          : i
    ));
    setActiveIncidentId(incident.id);
  };

  const handleFeedback = (incidentId: string, feedback: FeedbackType) => {
    setIncidents(prev => prev.map(i => 
      i.id === incidentId ? { ...i, feedback } : i
    ));
  };

  const handleResolve = (incidentId: string, notes: string) => {
    setIncidents(prev => prev.map(i => 
      i.id === incidentId ? { ...i, status: 'resolved' as const, notes } : i
    ));
    // Clear active incident if this was it
    if (activeIncidentId === incidentId) {
      setActiveIncidentId(null);
    }
  };

  const handleBoxClick = (boxId: string) => {
    // Just set the selected camera to view its feed
    setSelectedCameraId(boxId);
    // Don't change tab if already on in-progress
    if (currentTab !== 'in-progress') {
      setCurrentTab('in-progress');
    }
  };

  const activeIncident = incidents.find(i => i.id === activeIncidentId);

  return (
    <>
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full h-screen flex flex-col">
          {/* Header */}
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">AngelBoard</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Georgia Tech Police Department
                    </p>
                  </div>
                </div>

                {/* Tabs moved to header */}
                <div className="flex items-center gap-3">
                  <TabsList>
                    <TabsTrigger value="queued" className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      Queued
                      {queuedIncidents.length > 0 && (
                        <Badge variant="secondary" className="ml-1">{queuedIncidents.length}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="in-progress" className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      In Progress
                      {inProgressIncidents.length > 0 && (
                        <Badge variant="secondary" className="ml-1">{inProgressIncidents.length}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="resolved" className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Resolved
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-6 flex-1 overflow-auto">
            {/* Show overview when no incidents */}
            {showOverview ? (
              <TabsContent value="queued" className="mt-0 h-full">
                <DashboardOverview 
                  totalResolved={resolvedIncidents.length}
                  onViewResolved={() => setCurrentTab('resolved')}
                />
              </TabsContent>
            ) : (
              <>
                {/* Queued Incidents */}
                <TabsContent value="queued" className="space-y-4 mt-0">
                  {queuedIncidents.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No incidents in queue</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {queuedIncidents.map(incident => (
                        <IncidentCard 
                          key={incident.id} 
                          incident={incident} 
                          onClick={() => handleIncidentClick(incident)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* In-Progress Incidents */}
                <TabsContent value="in-progress" className="mt-0 h-full">
                  {activeIncident ? (
                    <ActiveIncidentView 
                      incident={activeIncident} 
                      onFeedback={handleFeedback}
                      onResolve={handleResolve}
                      preIncidentBuffer={preIncidentBuffer}
                    />
                  ) : selectedCameraId ? (
                    <CameraView 
                      cameraId={selectedCameraId}
                    />
                  ) : inProgressIncidents.length > 0 ? (
                    <div className="grid gap-3">
                      {inProgressIncidents.map(incident => (
                        <IncidentCard 
                          key={incident.id} 
                          incident={incident}
                          onClick={() => setActiveIncidentId(incident.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No active incidents</p>
                    </div>
                  )}
                </TabsContent>
              </>
            )}

            {/* Resolved Incidents */}
            <TabsContent value="resolved" className="space-y-4 mt-0">
              {resolvedIncidents.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No resolved incidents</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {resolvedIncidents.map(incident => (
                    <IncidentCard key={incident.id} incident={incident} />
                  ))}
                </div>
              )}
            </TabsContent>
          </main>
        </Tabs>

        {/* Settings Dialog */}
        <SettingsDialog 
          open={settingsOpen} 
          onOpenChange={setSettingsOpen}
          preIncidentBuffer={preIncidentBuffer}
          onPreIncidentBufferChange={setPreIncidentBuffer}
        />
      </div>
    </ThemeProvider>
    </>
  );
}