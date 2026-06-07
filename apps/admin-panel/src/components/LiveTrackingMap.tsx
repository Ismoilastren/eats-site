'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { normalizeCoordinate } from '@repo/shared-types';

if (typeof window !== 'undefined') {
  const iconDefault = L.Icon.Default.prototype as any;
  if (!iconDefault._isPatched) {
    delete iconDefault._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
    iconDefault._isPatched = true;
  }
}

// Custom Icons logic moved inside the component to prevent SSR crashes

interface LiveTrackingMapProps {
  restaurantLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  customerLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  courierLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
}

const FitBounds = ({ coordinates, signature }: { coordinates: Array<{ lat: number; lng: number }>; signature: string }) => {
    const map = useMap();

    useEffect(() => {
        if (coordinates.length > 0) {
            const validCoords = coordinates.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
            if (validCoords.length > 0) {
                const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
            }
        }
    }, [signature, map]);
    return null;
};

// Module-level key to force complete unmount/remount on Next.js HMR
const HMR_KEY = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'static';

export default function LiveTrackingMap({ 
  restaurantLocation, 
  customerLocation, 
  courierLocation 
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);

  // Safely create icons on the client side only using useMemo to prevent render loop crashes
  const { restaurantIcon, customerIcon, courierIcon } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { restaurantIcon: null as any, customerIcon: null as any, courierIcon: null as any };
    }
    return {
      restaurantIcon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #f79009; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      customerIcon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #465fff; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      courierIcon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #12b76a; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (typeof window !== 'undefined') {
        const container = L.DomUtil.get('order-tracking-map');
        if (container) {
          (container as any)._leaflet_id = null;
        }
      }
    };
  }, []);

  if (!mounted) return null;

  const defRest: [number, number] = [41.3110, 69.2405];

  const restaurant = normalizeCoordinate(restaurantLocation);
  const customer = normalizeCoordinate(customerLocation);
  const courier = normalizeCoordinate(courierLocation);
  const restPos: [number, number] = restaurant ? [restaurant.latitude, restaurant.longitude] : defRest;
  const custPos: [number, number] | null = customer ? [customer.latitude, customer.longitude] : null;
  const courPos: [number, number] | null = courier ? [courier.latitude, courier.longitude] : null;

  const validCoords = [
    { lat: restPos[0], lng: restPos[1] },
    ...(custPos ? [{ lat: custPos[0], lng: custPos[1] }] : []),
    ...(courPos ? [{ lat: courPos[0], lng: courPos[1] }] : []),
  ];
  const boundsSignature = [
    `r:${restPos[0].toFixed(5)},${restPos[1].toFixed(5)}`,
    custPos ? `d:${custPos[0].toFixed(5)},${custPos[1].toFixed(5)}` : 'd:none',
    courPos ? 'c:assigned' : 'c:none',
  ].join('|');

  return (
    <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-gray-200 shadow-inner mt-6 z-0 relative">
        <MapContainer id="order-tracking-map" key={HMR_KEY} center={[41.2995, 69.2401]} className="w-full h-full z-0" zoom={13} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"/>
            
            <FitBounds coordinates={validCoords} signature={boundsSignature} />

            <Marker position={restPos} icon={restaurantIcon}>
                <Popup className="font-bold text-gray-800">Restaurant</Popup>
            </Marker>

            {courPos && (
                <Marker position={courPos} icon={courierIcon}>
                    <Popup className="font-bold text-orange-500">Courier</Popup>
                </Marker>
            )}

            {custPos && (
                <Marker position={custPos} icon={customerIcon}>
                    <Popup className="font-bold text-blue-600">Delivery Address</Popup>
                </Marker>
            )}
        </MapContainer>
    </div>
  );
}
