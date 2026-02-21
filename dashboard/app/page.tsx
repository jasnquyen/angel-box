"use client";

import { useEffect, useState } from "react";
import { FaCamera, FaShieldAlt, FaCog } from "react-icons/fa";
import dynamic from "next/dynamic";

const MapClientWrapper = dynamic(() => import("./components/Map"), { ssr: false });

export default function Home() {
  const [showRoutes, setShowRoutes] = useState(false);

  useEffect(() => {
    function onOpen() {
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
        <div className="absolute inset-0" />

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
            <button className="w-full bg-[#1769e0] text-white rounded-md py-2 mb-2">Camera View</button>
            <button className="w-full text-left py-2">Risk Heatmap</button>
            <button className="w-full text-left py-2">Safe Route Mode</button>
            <div className="flex gap-2 mt-3">
              <button className="bg-white border rounded p-1">+</button>
              <button className="bg-white border rounded p-1">-</button>
            </div>
          </div>
        </div>
      </div>

      {/* bottom route panel (example) */}
      {showRoutes && (
        <div className="px-8 py-6 bg-white mt-6 rounded-t-2xl shadow-lg max-w-[980px] mx-auto -translate-y-8">
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowRoutes(false)} className="text-sm text-slate-500">Close ✕</button>
          </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">Available Routes</h3>
            <p className="text-sm text-slate-500">Sorted by safety score</p>
          </div>
          <div className="text-green-600 font-semibold bg-green-50 px-3 py-2 rounded">92/100</div>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="border rounded-xl p-4 bg-yellow-50 border-amber-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-amber-700 font-semibold">AI RECOMMENDED SAFEST ROUTE</div>
                <div className="text-lg font-bold">Via Peachtree St NE</div>
              </div>
              <div className="text-green-700 font-bold bg-white px-3 py-2 rounded">92/100</div>
            </div>
            <div className="mt-4 flex gap-6 text-sm text-slate-600">
              <div>
                <div className="text-xs text-slate-400">Distance</div>
                <div className="font-semibold">5.2 mi</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Time</div>
                <div className="font-semibold">14 min</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Cameras</div>
                <div className="font-semibold text-blue-600">24</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-3 bg-green-500 rounded-full w-[92%]" />
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">Via North Ave NE</div>
              </div>
              <div className="text-amber-700 font-semibold bg-amber-50 px-3 py-2 rounded">75/100</div>
            </div>
            <div className="mt-4 flex gap-6 text-sm text-slate-600">
              <div>
                <div className="text-xs text-slate-400">Distance</div>
                <div className="font-semibold">4.8 mi</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Time</div>
                <div className="font-semibold">12 min</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Cameras</div>
                <div className="font-semibold text-blue-600">18</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
