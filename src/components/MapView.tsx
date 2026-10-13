import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, LocateFixed, Loader2 } from 'lucide-react';
import type { LandingSite } from '../data/sites';

interface MapViewProps {
  sites: LandingSite[];
}

// Green Dot Icon for Fishing Grounds
const greenDotIcon = L.divIcon({
  className: 'custom-green-dot',
  html: `<div style="
    background-color: #2ecc71;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10]
});

// Blue Dot Icon for User's Current Location
const userLocationIcon = L.divIcon({
  className: 'custom-user-dot',
  html: `<div style="
    background-color: #38bdf8;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 10px #38bdf8;
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10]
});

// Helper component to center map on locate click
function LocationController({ userPos }: { userPos: [number, number] | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (userPos) {
      map.flyTo(userPos, 12, { animate: true });
    }
  }, [userPos, map]);
  return null;
}

export const MapView: React.FC<MapViewProps> = ({ sites }) => {
  const defaultCenter: [number, number] = [-4.0435, 39.6682];
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserPos([latitude, longitude]);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        setLocationError('Could not get your location. Please check GPS permissions.');
        console.error(error);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* GPS Location Button */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end space-y-2">
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-slate-700 px-4 py-2.5 rounded-xl shadow-lg backdrop-blur font-medium text-xs transition"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          ) : (
            <LocateFixed className="w-4 h-4 text-cyan-400" />
          )}
          <span>{isLocating ? 'Finding location...' : 'Find My Location'}</span>
        </button>

        {locationError && (
          <div className="bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs px-3 py-1.5 rounded-lg backdrop-blur">
            {locationError}
          </div>
        )}
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        scrollWheelZoom={true} 
        style={{ width: '100%', height: '100%', background: '#0b0f19' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationController userPos={userPos} />

        {/* User Location Marker */}
        {userPos && (
          <Marker position={userPos} icon={userLocationIcon}>
            <Popup>
              <div className="p-1 text-slate-900 font-sans">
                <p className="font-bold text-xs m-0 flex items-center space-x-1">
                  <Navigation className="w-3 h-3 text-cyan-600 inline" />
                  <span>You Are Here</span>
                </p>
                <p className="text-[10px] text-slate-500 m-0 mt-0.5">
                  {userPos[0].toFixed(4)}, {userPos[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Landing Sites Green Markers */}
        {sites.map((site) => (
          <Marker 
            key={site.id} 
            position={[site.lat, site.lon]} 
            icon={greenDotIcon}
          >
            <Popup>
              <div className="p-2 text-slate-900 font-sans">
                <h3 className="font-bold text-base m-0 text-slate-950">{site.name}</h3>
                <p className="text-xs m-0 mt-1"><strong>Region:</strong> {site.region}</p>
                <p className="text-xs m-0 mt-1 text-slate-600">Type: {site.isOcean ? 'Ocean Marine 🌊' : 'Inland Lake 🏞️'}</p>
                <p className="text-xs text-slate-400 m-0 mt-1 font-mono">Coords: {site.lat}, {site.lon}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};