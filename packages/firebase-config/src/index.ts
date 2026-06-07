// =============================================
// @repo/firebase-config — Central Export
// =============================================
// All 5 apps import Firebase services from this single package:
//   import { db, auth, collection, onSnapshot } from '@repo/firebase-config';

export { app } from './app';
export { db } from './firestore';
export { auth } from './auth';
export { storage } from './storage';

// Re-export all Firestore utilities
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
} from './firestore';

export type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  QueryDocumentSnapshot,
  CollectionReference,
  Query,
  Unsubscribe,
} from './firestore';

// Re-export Auth utilities
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  getAdditionalUserInfo,
} from './auth';

export type { FirebaseUser, UserCredential } from './auth';

// Re-export Storage utilities
export {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from './storage';

export type { StorageReference, UploadResult, UploadTask } from './storage';
