// =============================================
// LOCATION SERVICE — GPS Tracking for Courier
// =============================================
import * as Location from 'expo-location';
import {
  db,
  doc,
  updateDoc,
  serverTimestamp,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';

let locationSubscription: Location.LocationSubscription | null = null;
let locationInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Request foreground location permissions.
 * Returns true if permission is granted.
 */
export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Request background location permissions.
 * Returns true if permission is granted.
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Get the current location once.
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  const hasPermission = await requestForegroundPermission();
  if (!hasPermission) return null;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return location;
}

/**
 * Start tracking courier location and updating Firestore every 5 seconds.
 */
export async function startLocationTracking(
  courierId: string,
  onLocationUpdate?: (location: Location.LocationObject) => void
): Promise<boolean> {
  const hasForeground = await requestForegroundPermission();
  if (!hasForeground) return false;

  // Stop existing tracking if any
  stopLocationTracking();

  // Use watchPositionAsync for continuous updates
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10, // Update if moved at least 10 meters
      timeInterval: 5000, // Update every 5 seconds
    },
    async (location) => {
      // Notify callback
      onLocationUpdate?.(location);

      // Update Firestore with current location
      try {
        const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);
        await updateDoc(courierRef, {
          currentLocation: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading ?? 0,
            speed: location.coords.speed ?? 0,
            timestamp: new Date(),
          },
          lastLocationUpdate: serverTimestamp(),
        });
      } catch (error) {
        console.error('Failed to update courier location in Firestore:', error);
      }
    }
  );

  return true;
}

/**
 * Start periodic Firestore location updates using a timer.
 * This is used as a fallback when watch doesn't fire frequently enough.
 */
export async function startPeriodicLocationUpdates(
  courierId: string,
  onLocationUpdate?: (location: Location.LocationObject) => void
): Promise<boolean> {
  const hasForeground = await requestForegroundPermission();
  if (!hasForeground) return false;

  stopLocationTracking();

  // Get initial location
  const initialLocation = await getCurrentLocation();
  if (initialLocation) {
    onLocationUpdate?.(initialLocation);
  }

  // Set up interval to get and push location every 5 seconds
  locationInterval = setInterval(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      onLocationUpdate?.(location);

      const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);
      await updateDoc(courierRef, {
        currentLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading ?? 0,
          speed: location.coords.speed ?? 0,
          timestamp: new Date(),
        },
        lastLocationUpdate: serverTimestamp(),
      });
    } catch (error) {
      console.error('Periodic location update failed:', error);
    }
  }, 5000);

  return true;
}

/**
 * Stop all location tracking.
 */
export function stopLocationTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }

  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

/**
 * Check if location services are enabled on the device.
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
}

/**
 * Calculate distance between two coordinates in km (Haversine formula).
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Estimate delivery time based on distance (rough: 3 min/km by vehicle).
 */
export function estimateDeliveryTime(distanceKm: number): number {
  return Math.max(5, Math.round(distanceKm * 3));
}

/**
 * Estimate earnings based on distance and base fee.
 */
export function estimateEarnings(distanceKm: number): number {
  const baseFee = 15000;
  const perKmRate = 2500;
  return Math.round((baseFee + distanceKm * perKmRate) / 500) * 500;
}
