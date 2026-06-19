'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { db, collection, doc, getDocs, setDoc, updateDoc, serverTimestamp } from '@repo/firebase-config';
import { DeliveryGeozone, GeoPoint, formatCurrencyUZS, validatePolygon } from '@repo/shared-types';
import { isAdminYandexMapsKeyConfigured, loadAdminYandexMaps, TASHKENT_CENTER, type YandexMaps3, type YMapInstance } from '@/lib/yandexMaps';
import { writeAdminAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/context/AuthContext';

const GEOZONES_COLLECTION = 'geozones';
const DEFAULT_COLOR = '#f97316';

type GeozoneForm = {
  id?: string;
  name: string;
  status: 'active' | 'inactive';
  color: string;
  deliveryFee: string;
  minOrder: string;
  freeDeliveryThreshold: string;
  branchIds: string;
  polygon: GeoPoint[];
};

const initialForm: GeozoneForm = {
  name: '',
  status: 'active',
  color: DEFAULT_COLOR,
  deliveryFee: '8000',
  minOrder: '40000',
  freeDeliveryThreshold: '',
  branchIds: '',
  polygon: [
    { lat: 41.33, lng: 69.20 },
    { lat: 41.33, lng: 69.30 },
    { lat: 41.25, lng: 69.30 },
    { lat: 41.25, lng: 69.20 },
  ],
};

function createInitialForm(): GeozoneForm {
  return {
    ...initialForm,
    polygon: initialForm.polygon.map((point) => ({ ...point })),
  };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `zone-${Date.now()}`;
}

function parseLocalizedNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMoney(value: string, label: string, options: { required?: boolean } = {}) {
  const parsed = parseLocalizedNumber(value);
  if (parsed === null) {
    return options.required ? { ok: false as const, error: `${label} is required.` } : { ok: true as const, value: null };
  }
  if (parsed < 0) {
    return { ok: false as const, error: `${label} cannot be negative.` };
  }
  return { ok: true as const, value: Math.round(parsed) };
}

function parseBranchIds(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function markerElement(index: number, color: string) {
  const element = document.createElement('div');
  element.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: ${color};
    border: 3px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font: 800 12px system-ui;
    transform: translate(-50%, -50%);
    box-shadow: 0 10px 24px rgba(15, 23, 42, .35);
  `;
  element.textContent = String(index + 1);
  return element;
}

function GeozoneMapEditor({
  polygon,
  color,
  onAddPoint,
}: {
  polygon: GeoPoint[];
  color: string;
  onAddPoint: (point: GeoPoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const apiRef = useRef<YandexMaps3 | null>(null);
  const childrenRef = useRef<unknown[]>([]);
  const [status, setStatus] = useState<'fallback' | 'loading' | 'loaded' | 'error'>(() => isAdminYandexMapsKeyConfigured() ? 'loading' : 'fallback');
  const [error, setError] = useState('');
  const signature = JSON.stringify({ polygon, color });

  useEffect(() => {
    if (!isAdminYandexMapsKeyConfigured()) {
      setStatus('fallback');
      return;
    }

    let cancelled = false;
    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setError('');
      try {
        const ymaps3 = await loadAdminYandexMaps();
        if (cancelled || !containerRef.current) return;
        const center = polygon[0] || TASHKENT_CENTER;
        const map = new ymaps3.YMap(containerRef.current, {
          location: { center: [center.lng, center.lat], zoom: 11 },
          theme: 'light',
          behaviors: ['drag', 'scrollZoom', 'pinchZoom', 'dblClick'],
        });
        map.addChild(new ymaps3.YMapDefaultSchemeLayer());
        map.addChild(new ymaps3.YMapDefaultFeaturesLayer());
        const listener = new ymaps3.YMapListener({
          onClick: (_object: unknown, event: { coordinates?: [number, number] }) => {
            if (event.coordinates) onAddPoint({ lat: event.coordinates[1], lng: event.coordinates[0] });
          },
        });
        map.addChild(listener);
        mapRef.current = map;
        apiRef.current = ymaps3;
        setStatus('loaded');
      } catch (caught) {
        if (!cancelled) {
          setStatus('error');
          setError(caught instanceof Error ? caught.message : 'Could not load Yandex Maps.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      apiRef.current = null;
      childrenRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps3 = apiRef.current;
    if (!map || !ymaps3 || status !== 'loaded') return;

    childrenRef.current.forEach((child) => map.removeChild?.(child));
    const children: unknown[] = [];
    if (polygon.length >= 3) {
      const feature = new ymaps3.YMapFeature({
        geometry: {
          type: 'Polygon',
          coordinates: [polygon.map((point) => [point.lng, point.lat])],
        },
        style: {
          fill: `${color}33`,
          stroke: [{ color, width: 3 }],
        },
      });
      map.addChild(feature);
      children.push(feature);
    }
    polygon.forEach((point, index) => {
      const marker = new ymaps3.YMapMarker({ coordinates: [point.lng, point.lat] }, markerElement(index, color));
      map.addChild(marker);
      children.push(marker);
    });
    childrenRef.current = children;
    if (polygon.length) {
      const lats = polygon.map((point) => point.lat);
      const lngs = polygon.map((point) => point.lng);
      map.update({
        location: {
          bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          margin: [50, 50, 50, 50],
          duration: 200,
        },
      });
    }
  }, [signature, status]);

  const fallbackPoints = polygon.map((point) => `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`).join(' → ');

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-gray-700 bg-gray-950">
      <div ref={containerRef} className="h-[360px] w-full" />
      {status === 'fallback' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-lg font-black text-white">Yandex map key is not configured locally.</p>
            <p className="mt-2 text-sm font-semibold text-gray-400">Polygon editing remains available through the point table. Set NEXT_PUBLIC_YANDEX_MAPS_API_KEY to draw by clicking on the map.</p>
            <p className="mt-4 rounded-xl bg-white/10 p-3 text-xs font-semibold text-gray-300">{fallbackPoints || 'No points yet.'}</p>
          </div>
        </div>
      )}
      {status === 'loading' && <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 font-bold text-white">Loading map...</div>}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 p-6 text-center">
          <div>
            <p className="text-lg font-black text-white">Map rejected this key or host.</p>
            <p className="mt-2 text-sm font-semibold text-gray-400">{error}</p>
            <p className="mt-3 text-xs font-bold text-orange-200">Allowed host must include eats-adminn.vercel.app for production.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GeozonesPage() {
  const { user } = useAuth();
  const [zones, setZones] = useState<DeliveryGeozone[]>([]);
  const [form, setForm] = useState<GeozoneForm>(() => createInitialForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const activeZones = useMemo(() => zones.filter((zone) => zone.status !== 'archived'), [zones]);

  const loadZones = async () => {
    setIsLoading(true);
    try {
      setLoadError('');
      const snapshot = await getDocs(collection(db, GEOZONES_COLLECTION));
      const nextZones = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      })) as DeliveryGeozone[];
      setZones(nextZones.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load geozones.');
      toast.error('Failed to load geozones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, []);

  const patchPoint = (index: number, key: keyof GeoPoint, value: string) => {
    const parsed = parseLocalizedNumber(value);
    if (parsed === null) return;
    setForm((current) => ({
      ...current,
      polygon: current.polygon.map((point, pointIndex) => pointIndex === index ? { ...point, [key]: parsed } : point),
    }));
  };

  const addPoint = (point: GeoPoint = TASHKENT_CENTER) => {
    setForm((current) => ({ ...current, polygon: [...current.polygon, point] }));
  };

  const removePoint = (index: number) => {
    setForm((current) => ({ ...current, polygon: current.polygon.filter((_, pointIndex) => pointIndex !== index) }));
  };

  const editZone = (zone: DeliveryGeozone) => {
    setForm({
      id: zone.id,
      name: zone.name,
      status: zone.status === 'inactive' ? 'inactive' : 'active',
      color: zone.color || DEFAULT_COLOR,
      deliveryFee: String(zone.deliveryFee || ''),
      minOrder: String(zone.minOrder || ''),
      freeDeliveryThreshold: String(zone.freeDeliveryThreshold || ''),
      branchIds: (zone.branchIds || []).join(', '),
      polygon: Array.isArray(zone.polygon) ? zone.polygon : [],
    });
  };

  const resetForm = () => setForm(createInitialForm());

  const saveZone = async () => {
    const validation = validatePolygon(form.polygon);
    const deliveryFee = parseMoney(form.deliveryFee, 'Delivery fee', { required: true });
    const minOrder = parseMoney(form.minOrder, 'Minimum order', { required: true });
    const freeDeliveryThreshold = parseMoney(form.freeDeliveryThreshold, 'Free delivery threshold');
    if (!form.name.trim()) {
      toast.error('Zone name is required');
      return;
    }
    if (!isValidHexColor(form.color || DEFAULT_COLOR)) {
      toast.error('Color must be a hex value like #f97316');
      return;
    }
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    if (!deliveryFee.ok) {
      toast.error(deliveryFee.error);
      return;
    }
    if (!minOrder.ok) {
      toast.error(minOrder.error);
      return;
    }
    if (!freeDeliveryThreshold.ok) {
      toast.error(freeDeliveryThreshold.error);
      return;
    }

    setIsSaving(true);
    const zoneId = form.id || slugify(form.name);
    const before = zones.find((zone) => zone.id === zoneId);
    const payload = {
      name: form.name.trim(),
      status: form.status,
      color: form.color || DEFAULT_COLOR,
      polygon: validation.polygon,
      branchIds: parseBranchIds(form.branchIds),
      deliveryFee: deliveryFee.value,
      minOrder: minOrder.value,
      freeDeliveryThreshold: freeDeliveryThreshold.value,
      updatedAt: serverTimestamp(),
      ...(before ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      await setDoc(doc(db, GEOZONES_COLLECTION, zoneId), payload, { merge: true });
      await writeAdminAuditLog({
        action: before ? 'geozone.changed' : 'geozone.created',
        entityType: 'geozone',
        entityId: zoneId,
        entityName: payload.name,
        actorEmail: user?.email,
        before: before ? { ...before } as Record<string, unknown> : undefined,
        after: payload as Record<string, unknown>,
      });
      toast.success(before ? 'Geozone updated' : 'Geozone created');
      resetForm();
      await loadZones();
    } catch (error) {
      console.error('Failed to save geozone:', error);
      toast.error('Failed to save geozone');
    } finally {
      setIsSaving(false);
    }
  };

  const archiveZone = async (zone: DeliveryGeozone) => {
    if (!confirm(`Archive ${zone.name}? Customer delivery matching will ignore archived zones.`)) return;
    try {
      await updateDoc(doc(db, GEOZONES_COLLECTION, zone.id), {
        status: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAdminAuditLog({
        action: 'geozone.archived',
        entityType: 'geozone',
        entityId: zone.id,
        entityName: zone.name,
        actorEmail: user?.email,
        before: { ...zone } as Record<string, unknown>,
        after: { status: 'archived' },
      });
      toast.success('Geozone archived');
      await loadZones();
    } catch (error) {
      console.error('Failed to archive geozone:', error);
      toast.error('Failed to archive geozone');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Operations</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Geozones</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real Firestore-backed delivery polygons. Customer pricing can consume these zones after deployment rules/env are in place.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{form.id ? 'Edit delivery zone' : 'Create delivery zone'}</h2>
            {form.id ? (
              <button type="button" onClick={resetForm} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                Cancel edit
              </button>
            ) : null}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Zone name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Color
              <input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Delivery fee
              <input inputMode="numeric" value={form.deliveryFee} onChange={(event) => setForm({ ...form, deliveryFee: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Min order
              <input inputMode="numeric" value={form.minOrder} onChange={(event) => setForm({ ...form, minOrder: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Free delivery threshold
              <input inputMode="numeric" value={form.freeDeliveryThreshold} onChange={(event) => setForm({ ...form, freeDeliveryThreshold: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 md:col-span-2">
              Branch IDs
              <input value={form.branchIds} onChange={(event) => setForm({ ...form, branchIds: event.target.value })} placeholder="bellissimo-pizza, maxway" className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none dark:border-gray-700 dark:bg-gray-900" />
              <span className="mt-1 block text-xs font-semibold text-gray-500">Comma or new-line separated branch IDs.</span>
            </label>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Polygon points</h3>
              <button type="button" onClick={() => addPoint()} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-black text-white">+ Add point</button>
            </div>
            <div className="mt-3 space-y-2">
              {form.polygon.map((point, index) => (
                <div key={`${index}-${point.lat}-${point.lng}`} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
                  <span className="text-xs font-black text-gray-400">#{index + 1}</span>
                  <input inputMode="decimal" value={point.lat} onChange={(event) => patchPoint(index, 'lat', event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                  <input inputMode="decimal" value={point.lng} onChange={(event) => patchPoint(index, 'lng', event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                  <button type="button" onClick={() => removePoint(index)} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700 dark:bg-red-900/30 dark:text-red-200">Remove</button>
                </div>
              ))}
            </div>
          </div>

          <button type="button" disabled={isSaving} onClick={saveZone} className="mt-6 w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-60">
            {isSaving ? 'Saving...' : form.id ? 'Save geozone' : 'Create geozone'}
          </button>
        </section>

        <section className="space-y-6">
          <GeozoneMapEditor polygon={form.polygon} color={form.color || DEFAULT_COLOR} onAddPoint={addPoint} />

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 p-5 dark:border-gray-700">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Delivery zones</h2>
              <p className="text-sm font-semibold text-gray-500">{activeZones.length} active/inactive zones, {zones.length - activeZones.length} archived hidden from operations.</p>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading geozones...</div>
            ) : loadError ? (
              <div className="p-8 text-center">
                <p className="font-black text-gray-900 dark:text-white">Geozones are not readable yet.</p>
                <p className="mt-2 text-sm text-gray-500">Deploy the latest Firestore rules before using delivery zone management in production.</p>
              </div>
            ) : activeZones.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No geozones yet. Create one with at least 3 polygon points.</div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeZones.map((zone) => (
                  <div key={zone.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: zone.color || DEFAULT_COLOR }} />
                        <p className="font-black text-gray-900 dark:text-white">{zone.name}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-black uppercase ${zone.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{zone.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {zone.polygon?.length || 0} points · fee {formatCurrencyUZS(zone.deliveryFee || 0)} · min {formatCurrencyUZS(zone.minOrder || 0)}
                      </p>
                      {zone.branchIds?.length ? <p className="mt-1 text-xs font-semibold text-gray-400">Branches: {zone.branchIds.join(', ')}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => editZone(zone)} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">Edit</button>
                      <button type="button" onClick={() => archiveZone(zone)} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700 dark:bg-red-900/30 dark:text-red-200">Archive</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
