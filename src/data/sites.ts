export interface LandingSite {
  id: string;
  name: string;
  region: 'Lake Victoria' | 'Lake Turkana' | 'Coast';
  lat: number;
  lon: number;
  isOcean: boolean;
}

export const LANDING_SITES: LandingSite[] = [
  // Coast (Oceanic - Uses Marine API)
  { id: 'mombasa', name: 'Mombasa Old Port', region: 'Coast', lat: -4.0583, lon: 39.6718, isOcean: true },
  { id: 'kilifi', name: 'Kilifi Creek', region: 'Coast', lat: -3.6307, lon: 39.8499, isOcean: true },
  { id: 'malindi', name: 'Malindi Jetty', region: 'Coast', lat: -3.2185, lon: 40.1169, isOcean: true },
  { id: 'lamu', name: 'Lamu Waterfront', region: 'Coast', lat: -2.2717, lon: 40.9020, isOcean: true },
  { id: 'vanga', name: 'Vanga Border Pier', region: 'Coast', lat: -4.6756, lon: 39.2239, isOcean: true },

  // Inland Lakes (Uses Wind-to-Wave Estimation)
  { id: 'kisumu', name: 'Kisumu Main Bay', region: 'Lake Victoria', lat: -0.1022, lon: 34.7617, isOcean: false },
  { id: 'homa_bay', name: 'Homa Bay Pier', region: 'Lake Victoria', lat: -0.5273, lon: 34.4571, isOcean: false },
  { id: 'mbita', name: 'Mbita Point', region: 'Lake Victoria', lat: -0.4286, lon: 34.2063, isOcean: false },
  { id: 'kalokol', name: 'Kalokol Port (Turkana)', region: 'Lake Turkana', lat: 3.5269, lon: 35.8402, isOcean: false },
];