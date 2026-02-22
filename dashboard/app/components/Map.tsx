"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleF,
  DirectionsRenderer,
  GoogleMap,
  InfoWindowF,
  LoadScript,
  MarkerF,
} from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const ATLANTA_CENTER = {
  lat: 33.7501,
  lng: -84.3885,
};

type EmergencyCallBox = {
  id: string;
  lat: number;
  lng: number;
  routeLeg: string;
};
type ViewMode = "camera" | "risk" | "safeRoute";
type CameraMarker = { lat: number; lng: number; id: string };

const LOCATION_ALIASES: Record<string, string> = {
  klaus: "Klaus Advanced Computing Building, Georgia Tech, Atlanta, GA",
  "north ave": "North Avenue Apartments, 120 North Ave NW, Atlanta, GA",
  "north avenue": "North Avenue Apartments, 120 North Ave NW, Atlanta, GA",
};

function getLocationCandidates(rawInput: string) {
  const trimmed = rawInput.trim();
  const normalized = trimmed.toLowerCase();
  const candidates: string[] = [];

  if (!trimmed) return candidates;
  candidates.push(trimmed);

  if (LOCATION_ALIASES[normalized]) {
    candidates.push(LOCATION_ALIASES[normalized]);
  }

  if (normalized.includes("north ave") || normalized.includes("north avenue")) {
    candidates.push("North Ave NW, Atlanta, GA");
  }

  if (!normalized.includes("atlanta") && !normalized.includes("ga")) {
    candidates.push(`${trimmed}, Atlanta, GA`);
  }

  return [...new Set(candidates)];
}

function buildEmergencyCallBoxes(result: google.maps.DirectionsResult): EmergencyCallBox[] {
  const path = result.routes[0]?.overview_path ?? [];
  if (path.length === 0) return [];

  const totalBoxes = Math.min(6, Math.max(3, Math.floor(path.length / 18)));
  const stride = Math.max(1, Math.floor(path.length / (totalBoxes + 1)));
  const legSummary = result.routes[0]?.legs?.[0];
  const routeLeg = `${legSummary?.start_address ?? "Start"} -> ${legSummary?.end_address ?? "End"}`;

  const boxes: EmergencyCallBox[] = [];
  for (let i = 1; i <= totalBoxes; i++) {
    const pointIndex = Math.min(path.length - 1, i * stride);
    const point = path[pointIndex];
    boxes.push({
      id: `ECB-${String(i).padStart(3, "0")}`,
      lat: point.lat(),
      lng: point.lng(),
      routeLeg,
    });
  }

  return boxes;
}

function getCameraPinIcon(zoom: number): string | google.maps.Icon {
  if (!window.google?.maps) {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Ccircle cx='17' cy='17' r='16' fill='%2308c84d' stroke='%2300461a' stroke-width='2'/%3E%3Crect x='9' y='12' width='16' height='10' rx='2' fill='white'/%3E%3Ccircle cx='17' cy='17' r='3.2' fill='%2308c84d'/%3E%3Crect x='22.5' y='14' width='3' height='3.8' rx='0.7' fill='white'/%3E%3C/svg%3E";
  }

  const size = Math.max(16, Math.min(40, Math.round(zoom * 2.1)));
  return {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Ccircle cx='17' cy='17' r='16' fill='%2308c84d' stroke='%2300461a' stroke-width='2'/%3E%3Crect x='9' y='12' width='16' height='10' rx='2' fill='white'/%3E%3Ccircle cx='17' cy='17' r='3.2' fill='%2308c84d'/%3E%3Crect x='22.5' y='14' width='3' height='3.8' rx='0.7' fill='white'/%3E%3C/svg%3E",
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
}

function buildRiskHeatCircles(cameras: CameraMarker[]) {
  if (!cameras.length) return [];

  const neighborhoodDistance = 0.012;
  const densities = cameras.map((camera) => {
    let nearbyCount = 0;
    for (const other of cameras) {
      const latDelta = camera.lat - other.lat;
      const lngDelta = camera.lng - other.lng;
      const distance = Math.sqrt(latDelta * latDelta + lngDelta * lngDelta);
      if (distance <= neighborhoodDistance) nearbyCount += 1;
    }
    return nearbyCount;
  });

  const maxDensity = Math.max(...densities);
  const minDensity = Math.min(...densities);
  const densitySpread = Math.max(1, maxDensity - minDensity);

  return cameras.map((camera, index) => {
    const normalizedSafety = (densities[index] - minDensity) / densitySpread;
    return {
      id: `${camera.id}-risk`,
      lat: camera.lat,
      lng: camera.lng,
      safetyScore: normalizedSafety,
      fillColor: "#e5e7eb",
      radius: 240,
    };
  });
}

export default function Map({
  cameras: propCameras,
  viewMode = "camera",
}: {
  cameras?: Array<{ lat: number; lng: number }>;
  viewMode?: ViewMode;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState(ATLANTA_CENTER);
  const [mapZoom, setMapZoom] = useState(12);
  const [currentZoom, setCurrentZoom] = useState(12);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [selectedCallBoxId, setSelectedCallBoxId] = useState<string | null>(null);
  const [focusCircle, setFocusCircle] = useState<{ lat: number; lng: number } | null>(null);
  const [hasDirections, setHasDirections] = useState(false);
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [pendingRoute, setPendingRoute] = useState<{ from: string; to: string } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dynamicCameras, setDynamicCameras] = useState<Array<{ lat: number; lng: number; id: string }>>([
    { lat: 33.757, lng: -84.392, id: "camera-1" },
    { lat: 33.748, lng: -84.38, id: "camera-2" },
    { lat: 33.742, lng: -84.395, id: "camera-3" },
    { lat: 33.76, lng: -84.37, id: "camera-4" },
    { lat: 33.735, lng: -84.385, id: "camera-5" },
  ]);
  const [emergencyCallBoxes, setEmergencyCallBoxes] = useState<EmergencyCallBox[]>([]);

  const cameraMarkers: CameraMarker[] = propCameras
    ? propCameras.map((camera, index) => ({ ...camera, id: `camera-prop-${index + 1}` }))
    : dynamicCameras;
  const riskHeatCircles = useMemo(() => buildRiskHeatCircles(cameraMarkers), [cameraMarkers]);

  const requestRoute = (directionsService: google.maps.DirectionsService, origin: string, destination: string) =>
    new Promise<google.maps.DirectionsResult | null>((resolve) => {
      if (!origin.trim() || !destination.trim()) {
        resolve(null);
        return;
      }

      try {
        directionsService.route(
          {
            origin,
            destination,
            travelMode: window.google.maps.TravelMode.WALKING,
            provideRouteAlternatives: true,
            region: "us",
          },
          (result, status) => {
            if (status === "OK" && result) {
              resolve(result);
              return;
            }
            resolve(null);
          },
        );
      } catch (routeError) {
        console.error("Directions request error:", routeError);
        resolve(null);
      }
    });

  const buildWalkingRoute = async (from: string, to: string) => {
    if (!window.google?.maps || !mapRef.current) {
      setPendingRoute({ from, to });
      return;
    }

    setRouteError(null);
    const directionsService = new window.google.maps.DirectionsService();
    const origins = getLocationCandidates(from);
    const destinations = getLocationCandidates(to);

    try {
      for (const origin of origins) {
        for (const destination of destinations) {
          const result = await requestRoute(directionsService, origin, destination);
          if (result) {
            setDirectionsResult(result);
            setEmergencyCallBoxes(buildEmergencyCallBoxes(result));
            setSelectedCallBoxId(null);
            const routeBounds = result.routes[0]?.bounds;
            if (routeBounds) {
              mapRef.current?.fitBounds(routeBounds);
            }
            return;
          }
        }
      }

      setDirectionsResult(null);
      setEmergencyCallBoxes([]);
      setSelectedCallBoxId(null);
      setRouteError(`Could not find a walking route from "${from}" to "${to}".`);
    } catch (buildError) {
      console.error("Route builder error:", buildError);
      setDirectionsResult(null);
      setEmergencyCallBoxes([]);
      setSelectedCallBoxId(null);
      setRouteError("Route lookup failed. Please try a more specific location.");
    }
  };

  useEffect(() => {
    if (!loading) return;

    const timeout = setTimeout(() => {
      setLoading(false);
      setError((currentError) => currentError ?? "Map is taking too long to load. Please refresh.");
    }, 12000);

    return () => clearTimeout(timeout);
  }, [loading]);

  const handleZoomChanged = () => {
    if (!mapRef.current) return;
    const zoom = mapRef.current.getZoom() ?? 12;
    setCurrentZoom(zoom);
    setMapZoom(zoom);
  };

  useEffect(() => {
    function onOpen(e: any) {
      const detail = e?.detail || {};
      const query = typeof detail.query === "string" ? detail.query.trim() : "";
      const from = typeof detail.from === "string" ? detail.from.trim() : "";
      const to = typeof detail.to === "string" ? detail.to.trim() : "";
      if (!query) return;

      const lat = detail.lat ?? 33.749;
      const lng = detail.lng ?? -84.388;
      setHasDirections(true);
      setMapCenter({ lat, lng });
      setMapZoom(14);
      setCurrentZoom(14);

      // Fly to location using map methods directly
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(14);
      }

      // Show temporary focus circle
      setFocusCircle({ lat, lng });
      setTimeout(() => setFocusCircle(null), 2200);

      if (from && to) {
        buildWalkingRoute(from, to);
      }
    }

    window.addEventListener("open-route-panel", onOpen as EventListener);
    return () => {
      window.removeEventListener("open-route-panel", onOpen as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!pendingRoute || !mapReady || !window.google?.maps || !mapRef.current) return;
    const { from, to } = pendingRoute;
    setPendingRoute(null);
    buildWalkingRoute(from, to);
  }, [pendingRoute, mapReady]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">Google Maps API key not configured</div>;
  }

  if (error) {
    return <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white text-center">
      <div>
        <p className="text-red-400 mb-2">Error loading map:</p>
        <p>{error}</p>
      </div>
    </div>;
  }

  return (
    <LoadScript 
      googleMapsApiKey={apiKey}
      onLoad={() => setLoading(false)}
      onError={(error) => {
        console.error("LoadScript error:", error);
        setError("Failed to load Google Maps API");
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading map...</p>
          </div>
        </div>
      )}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={(map) => {
          mapRef.current = map;
          setMapReady(true);
          setCurrentZoom(map.getZoom() ?? 12);
          setLoading(false);
        }}
        onUnmount={() => {
          mapRef.current = null;
          setMapReady(false);
        }}
        onDragStart={() => setSelectedMarker(null)}
        onZoomChanged={handleZoomChanged}
        options={{
          // Navigation controls
          draggable: true,
          scrollwheel: true,
          gestureHandling: "auto",
          zoomControl: true,
          zoomControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_CENTER,
          },
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_TOP,
          },
          streetViewControl: false,
          mapTypeControl: false,
          // Keyboard shortcuts
          keyboardShortcuts: true,
          styles: [
            {
              elementType: "geometry",
              stylers: [{ color: "#212121" }],
            },
            {
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }],
            },
            {
              elementType: "labels.text.fill",
              stylers: [{ color: "#757575" }],
            },
            {
              featureType: "administrative",
              elementType: "geometry",
              stylers: [{ color: "#424242" }],
            },
            {
              featureType: "administrative.country",
              elementType: "labels.text.fill",
              stylers: [{ color: "#9e9e9e" }],
            },
            {
              featureType: "administrative.land_parcel",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#bdbdbd" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#757575" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#181818" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#616161" }],
            },
            {
              featureType: "road",
              elementType: "geometry.fill",
              stylers: [{ color: "#2c2c2c" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#8a8a8a" }],
            },
            {
              featureType: "road.arterial",
              elementType: "geometry",
              stylers: [{ color: "#373737" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#3c3c3c" }],
            },
            {
              featureType: "road.highway.controlled_access",
              elementType: "geometry",
              stylers: [{ color: "#4e4e4e" }],
            },
            {
              featureType: "road.local",
              elementType: "labels.text.fill",
              stylers: [{ color: "#616161" }],
            },
            {
              featureType: "transit",
              elementType: "labels.text.fill",
              stylers: [{ color: "#757575" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#000000" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#3d3d3d" }],
            },
          ],
        }}
      >
        {directionsResult && (
          <DirectionsRenderer
            directions={directionsResult}
            options={{
              suppressMarkers: false,
              preserveViewport: true,
              polylineOptions: {
                strokeColor: viewMode === "safeRoute" ? "#00d48a" : "#33c46b",
                strokeOpacity: 0.95,
                strokeWeight: viewMode === "safeRoute" ? 8 : 6,
              },
            }}
          />
        )}

        {viewMode === "risk" &&
          riskHeatCircles.map((circle) => (
            <CircleF
              key={circle.id}
              center={{ lat: circle.lat, lng: circle.lng }}
              radius={circle.radius}
              options={{
                fillColor: circle.fillColor,
                fillOpacity: 0.45,
                strokeColor: circle.fillColor,
                strokeOpacity: 0.6,
                strokeWeight: 1,
              }}
            />
          ))}

        {cameraMarkers.map((camera, i) => (
          <MarkerF
            key={camera.id}
            position={{ lat: camera.lat, lng: camera.lng }}
            onClick={() => setSelectedMarker(i)}
            icon={getCameraPinIcon(currentZoom)}
            opacity={viewMode === "safeRoute" ? 0.65 : 1}
          >
            {selectedMarker === i && (
              <InfoWindowF onCloseClick={() => setSelectedMarker(null)}>
                <div className="text-black">
                  <p className="font-semibold">{camera.id}</p>
                  <p className="text-sm">Lat: {camera.lat.toFixed(4)}</p>
                  <p className="text-sm">Lng: {camera.lng.toFixed(4)}</p>
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        ))}

        {emergencyCallBoxes.map((callBox) => (
          <MarkerF
            key={callBox.id}
            position={{ lat: callBox.lat, lng: callBox.lng }}
            onClick={() => setSelectedCallBoxId(callBox.id)}
            icon="https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
            label={{ text: callBox.id.replace("ECB-", ""), color: "#111827", fontWeight: "700" }}
          >
            {selectedCallBoxId === callBox.id && (
              <InfoWindowF onCloseClick={() => setSelectedCallBoxId(null)}>
                <div className="text-black">
                  <p className="font-semibold">Emergency Call Box</p>
                  <p className="text-sm">Identifier: {callBox.id}</p>
                  <p className="text-sm">Route: {callBox.routeLeg}</p>
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        ))}

        {focusCircle && (
          <CircleF
            center={focusCircle}
            radius={200}
            options={{
              fillColor: "#38c172",
              fillOpacity: 0.3,
              strokeColor: "#38c172",
              strokeOpacity: 0.9,
              strokeWeight: 2,
            }}
          />
        )}
      </GoogleMap>

      {routeError && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {routeError}
        </div>
      )}

      <div className="absolute left-4 top-4 z-40 rounded-md bg-black/70 px-3 py-2 text-sm text-white shadow-lg">
        Emergency Call Boxes Active: {emergencyCallBoxes.length}
      </div>

      {viewMode === "risk" && (
        <div className="absolute left-4 top-16 z-40 rounded-md bg-black/70 px-3 py-2 text-xs text-white shadow-lg">
          Risk Heatmap active
        </div>
      )}
    </LoadScript>
  );
}
