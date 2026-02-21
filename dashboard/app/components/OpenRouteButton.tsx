"use client";
import React from "react";

export default function OpenRouteButton() {
  function openPanel() {
    // dispatch a global event the page can listen for
    // include Atlanta coords so the map can focus there
    window.dispatchEvent(
      new CustomEvent("open-route-panel", { detail: { lat: 33.749, lng: -84.388 } })
    );
  }

  return (
    <button
      onClick={openPanel}
      className="ml-4 bg-[#1769e0] hover:bg-[#155bb5] text-white rounded-full px-4 py-2 font-semibold"
    >
      Find Safest Routes
    </button>
  );
}
