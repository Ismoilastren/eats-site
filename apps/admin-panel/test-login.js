import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInWithEmailAndPassword(auth, 'maxway@restaurant.com', 'password123');
    console.log("LOGIN SUCCESS! UID:", cred.user.uid);
  } catch (e) {
    console.error("LOGIN FAILED:", e.code, e.message);
  }
  process.exit(0);
}
run();
