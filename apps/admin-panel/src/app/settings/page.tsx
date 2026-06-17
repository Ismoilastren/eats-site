'use client';

import React, { useEffect, useState } from 'react';
import { db, doc, getDoc, serverTimestamp, setDoc } from '@repo/firebase-config';
import toast from 'react-hot-toast';

type SettingsState = {
  companyName: string;
  supportPhone: string;
  supportEmail: string;
  defaultCity: string;
  baseDeliveryFee: number;
  feePerKm: number;
  taxRate: number;
  minOrderAmount: number;
  autoAcceptOrders: boolean;
  allowCashPayment: boolean;
  allowCardPayment: boolean;
  yandexMapsEnabled: boolean;
  firebaseEnabled: boolean;
};

const DEFAULT_SETTINGS: SettingsState = {
  companyName: '2(13) Delivery',
  supportPhone: '+998',
  supportEmail: '',
  defaultCity: 'Tashkent',
  baseDeliveryFee: 10000,
  feePerKm: 1500,
  taxRate: 12,
  minOrderAmount: 0,
  autoAcceptOrders: false,
  allowCashPayment: true,
  allowCardPayment: true,
  yandexMapsEnabled: true,
  firebaseEnabled: true,
};

const SETTINGS_SECTIONS = [
  'Company',
  'Orders',
  'Delivery',
  'Geozones',
  'Catalog',
  'Integrations',
  'Users & Roles',
  'Change History',
] as const;

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof SETTINGS_SECTIONS)[number]>('Company');
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'global'));
        if (docSnap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(docSnap.data() as Partial<SettingsState>) });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const patchSettings = (patch: Partial<SettingsState>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success('System settings saved to Firestore.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage company, order, delivery and integration configuration stored in Firestore.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-bold transition-colors ${
                activeSection === section
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
              }`}
            >
              {section}
              {['Geozones', 'Catalog', 'Users & Roles', 'Change History'].includes(section) && (
                <span aria-hidden="true" className="text-[10px] opacity-70">view</span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {activeSection === 'Company' && (
            <section className="space-y-5">
              <h2 className="border-b border-gray-200 pb-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">Company</h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextInput label="Company Name" value={settings.companyName} onChange={(value) => patchSettings({ companyName: value })} />
                <TextInput label="Default City" value={settings.defaultCity} onChange={(value) => patchSettings({ defaultCity: value })} />
                <TextInput label="Support Phone" value={settings.supportPhone} onChange={(value) => patchSettings({ supportPhone: value })} />
                <TextInput label="Support Email" value={settings.supportEmail} onChange={(value) => patchSettings({ supportEmail: value })} />
              </div>
            </section>
          )}

          {activeSection === 'Orders' && (
            <section className="space-y-5">
              <h2 className="border-b border-gray-200 pb-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">Orders</h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <NumberInput label="Minimum Order Amount (UZS)" value={settings.minOrderAmount} onChange={(value) => patchSettings({ minOrderAmount: value })} />
                <NumberInput label="Tax Rate (%)" value={settings.taxRate} onChange={(value) => patchSettings({ taxRate: value })} />
              </div>
              <ToggleRow label="Auto-accept new orders" enabled={settings.autoAcceptOrders} onChange={(value) => patchSettings({ autoAcceptOrders: value })} />
              <ToggleRow label="Cash payment enabled" enabled={settings.allowCashPayment} onChange={(value) => patchSettings({ allowCashPayment: value })} />
              <ToggleRow label="Card payment enabled" enabled={settings.allowCardPayment} onChange={(value) => patchSettings({ allowCardPayment: value })} />
            </section>
          )}

          {activeSection === 'Delivery' && (
            <section className="space-y-5">
              <h2 className="border-b border-gray-200 pb-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">Delivery Rules</h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <NumberInput label="Base Delivery Fee (UZS)" value={settings.baseDeliveryFee} onChange={(value) => patchSettings({ baseDeliveryFee: value })} />
                <NumberInput label="Fee per Kilometer (UZS)" value={settings.feePerKm} onChange={(value) => patchSettings({ feePerKm: value })} />
              </div>
            </section>
          )}

          {activeSection === 'Integrations' && (
            <section className="space-y-5">
              <h2 className="border-b border-gray-200 pb-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">Integrations</h2>
              <ToggleRow label="Yandex Maps integration enabled" enabled={settings.yandexMapsEnabled} onChange={(value) => patchSettings({ yandexMapsEnabled: value })} />
              <ToggleRow label="Firebase integration enabled" enabled={settings.firebaseEnabled} onChange={(value) => patchSettings({ firebaseEnabled: value })} />
              <p className="rounded-lg bg-yellow-50 p-4 text-sm font-semibold text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                API key values are managed in Vercel environment variables, not stored in this Firestore settings document.
              </p>
            </section>
          )}

          {activeSection === 'Geozones' && <ReadOnlySection title="Geozones" body="Delivery geozones are not yet implemented as editable polygons in this admin. Current production delivery uses address coordinates and global delivery fee settings." />}
          {activeSection === 'Catalog' && <ReadOnlySection title="Catalog" body="Product catalog is managed from Restaurants -> Edit Restaurant -> Menu Items and the new Catalog page. Category names are managed from Restaurants -> Categories." />}
          {activeSection === 'Users & Roles' && <ReadOnlySection title="Users & Roles" body="Admin accounts and roles are managed from the Admins page. Restaurant manager linking is managed inside each restaurant edit page." />}
          {activeSection === 'Change History' && <ReadOnlySection title="Change History" body="A full audit log is not implemented yet. This page stores updatedAt for the global settings document so changes can still be traced at document level." />}

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-brand-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving to Firestore...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        step="100"
        className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
    </label>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <span className="font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-brand-500"
      />
    </label>
  );
}

function ReadOnlySection({ title, body }: { title: string; body: string }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-gray-200 pb-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">{title}</h2>
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {body}
      </div>
    </section>
  );
}
