import { db, doc, getDoc, serverTimestamp, setDoc } from '@repo/firebase-config';
import { MOCK_CUSTOMER_ID, isFirestoreDataSource } from './config';

export type MarketplaceUserProfile = {
  id: string;
  name: string;
  phone: string;
  addresses: string[];
  favorites: string[];
};

export async function getUserProfile(userId = MOCK_CUSTOMER_ID): Promise<MarketplaceUserProfile | null> {
  if (!isFirestoreDataSource()) return null;

  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return {
    id: String(data.id || userDoc.id),
    name: String(data.name || ''),
    phone: String(data.phone || ''),
    addresses: Array.isArray(data.addresses) ? data.addresses.map(String) : [],
    favorites: Array.isArray(data.favorites) ? data.favorites.map(String) : [],
  };
}

export async function upsertUserProfile(profile: MarketplaceUserProfile): Promise<void> {
  if (!isFirestoreDataSource()) return;

  await setDoc(doc(db, 'users', profile.id || MOCK_CUSTOMER_ID), {
    id: profile.id || MOCK_CUSTOMER_ID,
    name: profile.name,
    phone: profile.phone,
    addresses: profile.addresses,
    favorites: profile.favorites,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}
