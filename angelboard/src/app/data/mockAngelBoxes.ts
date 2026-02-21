export interface AngelBox {
  id: string;
  location: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline' | 'maintenance';
  lastPing?: string;
}

// Georgia Tech campus area coordinates
// TODO: Replace with actual Google Maps API integration
// Coordinates are around Georgia Tech campus in Atlanta, GA
export const mockAngelBoxes: AngelBox[] = [
  {
    id: 'AB-1047',
    location: 'Tech Tower Plaza',
    lat: 33.7756,
    lng: -84.3963,
    status: 'online',
    lastPing: new Date().toISOString(),
  },
  {
    id: 'AB-2051',
    location: 'Student Center',
    lat: 33.7736,
    lng: -84.3983,
    status: 'online',
    lastPing: new Date().toISOString(),
  },
  {
    id: 'AB-3012',
    location: 'Campus Recreation Center',
    lat: 33.7746,
    lng: -84.3923,
    status: 'online',
    lastPing: new Date().toISOString(),
  },
  {
    id: 'AB-4098',
    location: 'Library (East)',
    lat: 33.7746,
    lng: -84.3963,
    status: 'online',
    lastPing: new Date().toISOString(),
  },
  {
    id: 'AB-5023',
    location: 'Klaus Advanced Computing',
    lat: 33.7776,
    lng: -84.3963,
    status: 'online',
    lastPing: new Date().toISOString(),
  },
  {
    id: 'AB-6034',
    location: 'Bobby Dodd Stadium',
    lat: 33.7726,
    lng: -84.3933,
    status: 'maintenance',
    lastPing: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'AB-7056',
    location: 'North Avenue Apartments',
    lat: 33.7796,
    lng: -84.4003,
    status: 'online',
    lastPing: new Date().toISOString(),
  },
];