// =============================================
// Firestore Instance & Re-exports
// =============================================

import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { app } from './app';

export const db: Firestore = initializeFirestore(app, {});

// Re-export all commonly used Firestore functions
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  runTransaction,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type CollectionReference,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
