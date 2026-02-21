"use client";

import { useEffect, useState } from "react";
import { FaCamera } from "react-icons/fa";
import dynamic from "next/dynamic";
import RoutePanel from "./components/RoutePanel";

const MapClientWrapper = dynamic(() => import("./components/Map"), { ssr: false });

export default function Home() {
  const [showRoutes, setShowRoutes] = useState(false);
  const [routeQuery, setRouteQuery] = useState("");

  useEffect(() => {
    function onOpen(event: Event) {
      const customEvent = event as CustomEvent<{ query?: string }>;
      const query = typeof customEvent.detail?.query === "string" ? customEvent.detail.query.trim() : "";
      setRouteQuery(query);
      setShowRoutes(true);
    }
    window.addEventListener("open-route-panel", onOpen as EventListener);
    return () => window.removeEventListener("open-route-panel", onOpen as EventListener);
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] relative">
      {/* Map canvas */}
      <div className="h-[78vh] bg-[#e9f0f7] relative overflow-hidden">
        {/* interactive map (Leaflet) */}
        <div className="absolute inset-0 z-0">
          {/* Map component */}
          <div className="w-full h-full">
            {/* dynamically imported client component */}
            <MapClientWrapper />
          </div>
        </div>

        {/* camera icons overlay (removed diagonal layout) */}
        <div className="absolute inset-0 pointer-events-none" />

        {/* left info card */}
        <div className="absolute left-8 bottom-8 z-30 w-[320px]">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="bg-[#e8f1ff] p-3 rounded-lg">
                <FaCamera className="text-[#1769e0]" />
              </div>
              <div>
                <div className="text-lg font-semibold">Camera Network Coverage</div>
                <div className="text-sm text-slate-400">Active Cameras</div>
              </div>
              <div className="ml-auto text-2xl font-bold">1,247</div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-slate-500">City Coverage</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-3 rounded-full bg-green-500 w-full" />
                <div className="text-green-600 font-semibold">89%</div>
              </div>
            </div>
          </div>
        </div>

        {/* right controls */}
        <div className="absolute top-16 right-8 z-40">
          <div className="bg-white rounded-xl shadow p-3">
            <div className="text-sm font-semibold mb-2">View Mode</div>
            <button type="button" className="w-full bg-[#1769e0] text-white rounded-md py-2 mb-2">Camera View</button>
            <button type="button" className="w-full text-left py-2">Risk Heatmap</button>
            <button type="button" className="w-full text-left py-2">Safe Route Mode</button>
            <div className="flex gap-2 mt-3">
              <button type="button" className="bg-white border rounded p-1">+</button>
              <button type="button" className="bg-white border rounded p-1">-</button>
            </div>
          </div>
        </div>
      </div>

      {showRoutes && <RoutePanel onClose={() => setShowRoutes(false)} query={routeQuery} />}
    </div>
  );
}
