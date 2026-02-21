"use client";
import React from "react";

export default function RoutePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-8 py-6 bg-white mt-6 rounded-t-2xl shadow-lg max-w-[980px] mx-auto -translate-y-8">
      <div className="flex justify-end mb-2">
        <button onClick={onClose} className="text-sm text-slate-500">Close ✕</button>
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
  );
}
