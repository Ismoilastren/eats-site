import {
  db,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type FirebaseUser,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';

type ClientIdentity = {
  uid?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  photoURL?: string;
};

export function clientUserDocumentPatch(firebaseUser: FirebaseUser | null | undefined, profile?: ClientIdentity | null) {
  const uid = firebaseUser?.uid || profile?.uid || '';
  const email = String(profile?.email || firebaseUser?.email || '').trim().toLowerCase();
  const displayName = String(
    profile?.displayName || firebaseUser?.displayName || email.split('@')[0] || 'Customer'
  ).trim();
  const phone = String(profile?.phone || profile?.phoneNumber || firebaseUser?.phoneNumber || '').trim();

  return {
    uid,
    displayName,
    fullName: displayName,
    email,
    phone,
    photoURL: String(profile?.photoURL || firebaseUser?.photoURL || ''),
    role: 'client',
    source: 'client-app',
    platform: 'expo',
    updatedAt: serverTimestamp(),
  };
}

export async function ensureClientUserDocument(firebaseUser: FirebaseUser, profile?: ClientIdentity | null) {
  const patch = clientUserDocumentPatch(firebaseUser, profile);
  if (!patch.uid) return;

  const userRef = doc(db, COLLECTIONS.USERS, patch.uid);
  const userSnap = await getDoc(userRef);

  await setDoc(
    userRef,
    {
      ...patch,
      ...(userSnap.exists() ? {} : { savedAddresses: [], paymentMethods: [], createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}
