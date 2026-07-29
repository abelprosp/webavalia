import { useEffect } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { MarketCity } from '../data/cities'

const markerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: oklch(0.92 0.19 120);
    border: 3px solid oklch(0.15 0.02 280);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

function MapCenterUpdater({ city }: { city: MarketCity }) {
  const map = useMap()

  useEffect(() => {
    map.setView([city.lat, city.lng], city.zoom, { animate: true })
  }, [city, map])

  return null
}

function MapClickHandler({
  onMapClick,
  disabled,
}: {
  onMapClick: (lat: number, lng: number) => void
  disabled?: boolean
}) {
  useMapEvents({
    click(event) {
      if (disabled) return
      onMapClick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

type MarketMapViewProps = {
  city: MarketCity
  clickPosition: { lat: number; lng: number } | null
  onMapClick: (lat: number, lng: number) => void
  loading?: boolean
}

export function MarketMapView({
  city,
  clickPosition,
  onMapClick,
  loading,
}: MarketMapViewProps) {
  return (
    <div className='relative h-full min-h-[320px] w-full overflow-hidden rounded-[1.75rem] border border-black/[0.04] shadow-[0_2px_24px_-4px_rgba(0,0,0,0.06)]'>
      <MapContainer
        key={`${city.lat}-${city.lng}-${city.zoom}`}
        center={[city.lat, city.lng]}
        zoom={city.zoom}
        className='h-full w-full min-h-[320px] z-0'
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <MapCenterUpdater city={city} />
        <MapClickHandler onMapClick={onMapClick} disabled={loading} />
        {clickPosition && (
          <Marker
            position={[clickPosition.lat, clickPosition.lng]}
            icon={markerIcon}
          />
        )}
      </MapContainer>

      {loading && (
        <div className='pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-background/40 backdrop-blur-[1px]'>
          <div className='rounded-full bg-flux-lime px-4 py-2 text-sm font-semibold text-flux-dark shadow-md'>
            Consultando mercado...
          </div>
        </div>
      )}

      <div className='pointer-events-none absolute bottom-3 left-3 z-[400] rounded-full bg-flux-dark/85 px-3 py-1.5 text-[11px] font-medium text-white'>
        Clique no mapa para ver o preço/m²
      </div>
    </div>
  )
}
