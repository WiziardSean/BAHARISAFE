export interface LandingSite {
  id: string;
  name: string;
  county: string;
  region: 'Coast' | 'Lake Victoria' | 'Rift Valley' | 'Inland Dams/Rivers';
  lat: number;
  lon: number;
  isOcean: boolean;
}

export const LANDING_SITES: LandingSite[] = [
  // --- COASTAL MARINE (Indian Ocean) ---
  { id: 'mombasa-old-port', name: 'Mombasa Old Port', county: 'Mombasa', region: 'Coast', lat: -4.0583, lon: 39.6783, isOcean: true },
  { id: 'kilifi-creek', name: 'Kilifi Creek', county: 'Kilifi', region: 'Coast', lat: -3.6333, lon: 39.8500, isOcean: true },
  { id: 'malindi-jetty', name: 'Malindi Jetty', county: 'Kilifi', region: 'Coast', lat: -3.2167, lon: 40.1167, isOcean: true },
  { id: 'watamu-beach', name: 'Watamu Beach', county: 'Kilifi', region: 'Coast', lat: -3.3500, lon: 39.9833, isOcean: true },
  { id: 'lamu-waterfront', name: 'Lamu Waterfront', county: 'Lamu', region: 'Coast', lat: -2.2686, lon: 40.9006, isOcean: true },
  { id: 'kiwayu-island', name: 'Kiwayu Island', county: 'Lamu', region: 'Coast', lat: -2.0167, lon: 41.1500, isOcean: true },
  { id: 'vanga-pier', name: 'Vanga Border Pier', county: 'Kwale', region: 'Coast', lat: -4.6567, lon: 39.2217, isOcean: true },
  { id: 'shimoni-port', name: 'Shimoni Port', county: 'Kwale', region: 'Coast', lat: -4.6461, lon: 39.3817, isOcean: true },
  { id: 'kipini-tana', name: 'Kipini / Tana Delta', county: 'Tana River', region: 'Coast', lat: -2.5278, lon: 40.5233, isOcean: true },

  // --- LAKE VICTORIA ---
  { id: 'kisumu-bay', name: 'Kisumu Main Bay', county: 'Kisumu', region: 'Lake Victoria', lat: -0.1022, lon: 34.7517, isOcean: false },
  { id: 'dunga-beach', name: 'Dunga Beach', county: 'Kisumu', region: 'Lake Victoria', lat: -0.1419, lon: 34.7388, isOcean: false },
  { id: 'homa-bay-pier', name: 'Homa Bay Pier', county: 'Homa Bay', region: 'Lake Victoria', lat: -0.5271, lon: 34.4533, isOcean: false },
  { id: 'mbita-point', name: 'Mbita Point', county: 'Homa Bay', region: 'Lake Victoria', lat: -0.4328, lon: 34.2081, isOcean: false },
  { id: 'luanda-kotieno', name: 'Luanda Kotieno', county: 'Siaya', region: 'Lake Victoria', lat: -0.2194, lon: 34.2583, isOcean: false },
  { id: 'wichlum-beach', name: 'Wichlum Beach', county: 'Siaya', region: 'Lake Victoria', lat: -0.1667, lon: 34.1333, isOcean: false },
  { id: 'port-victoria', name: 'Port Victoria', county: 'Busia', region: 'Lake Victoria', lat: 0.1000, lon: 33.9833, isOcean: false },
  { id: 'usenge-beach', name: 'Usenge Beach', county: 'Siaya', region: 'Lake Victoria', lat: -0.0667, lon: 34.0500, isOcean: false },

  // --- RIFT VALLEY LAKES ---
  { id: 'kalokol-port', name: 'Kalokol Port (Lake Turkana)', county: 'Turkana', region: 'Rift Valley', lat: 3.5167, lon: 35.8833, isOcean: false },
  { id: 'ferguson-gulf', name: 'Ferguson Gulf (Lake Turkana)', county: 'Turkana', region: 'Rift Valley', lat: 3.5000, lon: 35.8333, isOcean: false },
  { id: 'loyangalani', name: 'Loyangalani (Lake Turkana)', county: 'Marsabit', region: 'Rift Valley', lat: 2.7542, lon: 36.7161, isOcean: false },
  { id: 'lake-naivasha', name: 'Lake Naivasha Crescent', county: 'Nakuru', region: 'Rift Valley', lat: -0.7667, lon: 36.3500, isOcean: false },
  { id: 'lake-baringo', name: 'Kampi ya Samaki (Lake Baringo)', county: 'Baringo', region: 'Rift Valley', lat: 0.6167, lon: 36.0167, isOcean: false },

  // --- INLAND DAMS & RIVERS ---
  { id: 'masinga-dam', name: 'Masinga Dam', county: 'Embu/Machakos', region: 'Inland Dams/Rivers', lat: -0.8872, lon: 37.5947, isOcean: false },
  { id: 'kiambere-dam', name: 'Kiambere Dam', county: 'Embu/Kitui', region: 'Inland Dams/Rivers', lat: -0.8333, lon: 37.8167, isOcean: false },
  { id: 'garissa-tana', name: 'Garissa Tana River Bank', county: 'Garissa', region: 'Inland Dams/Rivers', lat: -0.4569, lon: 39.6583, isOcean: false },
];