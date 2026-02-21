"use client";

import { useState } from "react";

const ATLANTA_CENTER = { lat: 33.749, lng: -84.388 };

export default function RouteSearchControls() {
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");

  function openPanel() {
    const from = fromQuery.trim();
    const to = toQuery.trim();
    if (!from || !to) return;

    const routeQuery = `${from} to ${to}`;

    window.dispatchEvent(
      new CustomEvent("open-route-panel", {
        detail: { ...ATLANTA_CENTER, query: routeQuery, from, to },
      }),
    );
  }

  return (
    <div className="flex-1 flex items-center gap-4">
      <div className="w-full rounded-full bg-[#0b314f] px-3 py-2 flex items-center gap-2">
        <input
          value={fromQuery}
          onChange={(e) => setFromQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") openPanel();
          }}
          placeholder="From..."
          className="w-full bg-transparent px-2 py-1 text-white placeholder:text-slate-300 focus:outline-none"
        />
        <span className="text-slate-300 text-sm whitespace-nowrap">to</span>
        <input
          value={toQuery}
          onChange={(e) => setToQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") openPanel();
          }}
          placeholder="To..."
          className="w-full bg-transparent px-2 py-1 text-white placeholder:text-slate-300 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={openPanel}
        disabled={!fromQuery.trim() || !toQuery.trim()}
        className="ml-4 bg-[#1769e0] hover:bg-[#155bb5] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-full px-4 py-2 font-semibold"
      >
        Find Safest Routes
      </button>
    </div>
  );
}
