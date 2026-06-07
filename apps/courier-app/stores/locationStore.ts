// =============================================
// LOCATION STORE — Courier location state
// =============================================
import { create } from 'zustand';
import {
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
} from '../services/locationService';

interface LocationCoords {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
}

interface LocationState {
  currentLocation: LocationCoords | null;
  isTracking: boolean;
  hasPermission: boolean;
  error: string | null;

  // Actions
  startTracking: (courierId: string) => Promise<void>;
  stopTracking: () => void;
  updateLocation: (location: LocationCoords) => void;
  fetchCurrentLocation: () => Promise<void>;
  setPermission: (hasPermission: boolean) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  currentLocation: null,
  isTracking: false,
  hasPermission: false,
  error: null,

  startTracking: async (courierId: string) => {
    try {
      const success = await startLocationTracking(courierId, (location) => {
        set({
          currentLocation: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading ?? 0,
            speed: location.coords.speed ?? 0,
          },
        });
      });

      if (success) {
        set({ isTracking: true, hasPermission: true, error: null });
      } else {
        set({
          isTracking: false,
          hasPermission: false,
          error: 'Location permission denied',
        });
      }
    } catch (error) {
      console.error('Failed to start tracking:', error);
      set({
        isTracking: false,
        error: 'Failed to start location tracking',
      });
    }
  },

  stopTracking: () => {
    stopLocationTracking();
    set({ isTracking: false });
  },

  updateLocation: (location: LocationCoords) => {
    set({ currentLocation: location });
  },

  fetchCurrentLocation: async () => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        set({
          currentLocation: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading ?? 0,
            speed: location.coords.speed ?? 0,
          },
          hasPermission: true,
        });
      }
    } catch (error) {
      console.error('Failed to get current location:', error);
      set({ error: 'Failed to get current location' });
    }
  },

  setPermission: (hasPermission: boolean) => set({ hasPermission }),
}));
