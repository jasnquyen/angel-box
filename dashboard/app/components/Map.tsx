"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon paths for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function MapEffects() {
  const map = useMap();

  useEffect(() => {
    function onOpen(e: any) {
      const detail = e?.detail || {};
      const lat = detail.lat ?? 33.749;
      const lng = detail.lng ?? -84.388;
      map.flyTo([lat, lng], 14, { duration: 1.2 });

      // add a temporary focus circle
      const circle = L.circle([lat, lng], { radius: 200, color: "#38c172", weight: 2, opacity: 0.9 });
      circle.addTo(map);
      setTimeout(() => circle.remove(), 2200);
    }

    window.addEventListener("open-route-panel", onOpen as EventListener);
    return () => window.removeEventListener("open-route-panel", onOpen as EventListener);
  }, [map]);

  return null;
}

export default function Map({ cameras }: { cameras?: Array<[number, number]> }) {
  const center: [number, number] = [33.749, -84.388];
  const mockCameras = cameras ?? [
    [33.757, -84.392],
    [33.748, -84.380],
    [33.742, -84.395],
    [33.760, -84.370],
    [33.735, -84.385],
  ];

  return (
    <MapContainer center={center} zoom={12} className="w-full h-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {mockCameras.map((c, i) => (
        <Marker key={i} position={c}>
          <Popup>Camera #{i + 1}</Popup>
        </Marker>
      ))}
      <MapEffects />
    </MapContainer>
  );
}
