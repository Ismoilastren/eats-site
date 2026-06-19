import { collection, getDocs, db } from '@repo/firebase-config';
import { DeliveryGeozone, isPointInPolygon, type GeoPoint } from '@repo/shared-types';

const GEOZONES_COLLECTION = 'geozones';

let cachedZones: DeliveryGeozone[] | null = null;

export async function getActiveGeozones() {
  if (cachedZones) return cachedZones;
  const snapshot = await getDocs(collection(db, GEOZONES_COLLECTION));
  cachedZones = snapshot.docs
    .map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }) as DeliveryGeozone)
    .filter((zone) => zone.status === 'active' && Array.isArray(zone.polygon) && zone.polygon.length >= 3);
  return cachedZones;
}

export async function findMatchingGeozone(point: GeoPoint) {
  const zones = await getActiveGeozones();
  if (!zones.length) return null;
  return zones.find((zone) => isPointInPolygon(point, zone.polygon)) || null;
}
