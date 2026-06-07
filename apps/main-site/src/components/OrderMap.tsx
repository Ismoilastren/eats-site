'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { getCourierVehicleType, hasAssignedCourier, normalizeCoordinate } from '@repo/shared-types';

// Flawless, bundle-safe custom icons
const createIcon = (color: string, label: string) => L.divIcon({
    html: `<div style="display:flex; flex-direction:column; align-items:center;">
             <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
             <span style="font-size:10px; font-weight:bold; color:${color}; margin-top:2px; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">${label}</span>
           </div>`,
    className: 'custom-flawless-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 7] // Center of the dot
});

// Auto-Bounds Manager for Triple Points
const FitBounds = ({ points, signature }: { points: [number, number][]; signature: string }) => {
    const map = useMap();
    
    useEffect(() => {
        if (points.length > 0) {
            map.fitBounds(L.latLngBounds(points), { padding: [50, 50], animate: false, maxZoom: 15 });
        }
    }, [map, signature]);

    return null;
};

// Module-level HMR key for safety
const HMR_KEY = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'static';

export default function OrderMap({ order }: { order: any }) {
    if (!order) return <div className="h-[400px] w-full bg-gray-100 rounded-2xl animate-pulse"></div>;

    const restLoc = normalizeCoordinate(order.restaurantLocation) || { latitude: 41.311081, longitude: 69.240562 };
    const delLoc = normalizeCoordinate(order.deliveryLocation) || normalizeCoordinate(order.customerLocation);
    const courierSource = hasAssignedCourier(order)
        ? order.courierLocation || order.courier?.location || order.courier?.currentLocation || null
        : null;
    const courLoc = normalizeCoordinate(courierSource);
    const vehicleType = getCourierVehicleType(null, order.assignedCourier || null);
    const courierLabel = vehicleType === 'car' ? 'Car' : vehicleType === 'foot' ? 'Walk' : vehicleType === 'motorcycle' ? 'Moto' : 'Bike';

    const restPos: [number, number] | null = restLoc ? [restLoc.latitude, restLoc.longitude] : null;
    const courPos: [number, number] | null = courLoc ? [courLoc.latitude, courLoc.longitude] : null;
    const delPos: [number, number] | null = delLoc ? [delLoc.latitude, delLoc.longitude] : null;

    const boundsPoints = [restPos, delPos, courPos].filter(Boolean) as [number, number][];
    const boundsSignature = [
        restPos ? `r:${restPos[0].toFixed(5)},${restPos[1].toFixed(5)}` : 'r:none',
        delPos ? `d:${delPos[0].toFixed(5)},${delPos[1].toFixed(5)}` : 'd:none',
        courPos ? 'c:assigned' : 'c:none',
    ].join('|');

    // Strict UI boundary enforcement
    return (
        <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm mt-6 relative z-0">
            <MapContainer key={HMR_KEY} center={[41.2995, 69.2401]} className="w-full h-full z-0" zoom={12} scrollWheelZoom={false}>
                {/* Modern clean tile layer */}
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"/>
                
                {/* Viewport Manager */}
                <FitBounds points={boundsPoints} signature={boundsSignature} />
                
                {/* RESTAURANT NODE */}
                {restPos && (
                    <Marker 
                        icon={createIcon('#3b82f6', 'Resto')}
                        position={restPos}
                    >
                        <Popup>Restaurant Location</Popup>
                    </Marker>
                )}

                {restPos && delPos && (
                    <Polyline
                        positions={[restPos, delPos]}
                        pathOptions={{ color: '#f97316', weight: 5, opacity: 0.8, dashArray: '10 8' }}
                    />
                )}

                {/* COURIER NODE */}
                {courPos && (
                    <Marker 
                        icon={createIcon('#f97316', courierLabel)}
                        position={courPos}
                    >
                        <Popup>Courier is here</Popup>
                    </Marker>
                )}

                {/* DELIVERY NODE */}
                {delPos && (
                    <Marker 
                        icon={createIcon('#22c55e', 'You')}
                        position={delPos}
                    >
                        <Popup>Delivery Destination</Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}
