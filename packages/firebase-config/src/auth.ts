// =============================================
// Firebase Auth Instance & Re-exports
// =============================================

import { getAuth, type Auth } from 'firebase/auth';
import { app } from './app';

export const auth: Auth = getAuth(app);

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
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
