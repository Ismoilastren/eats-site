import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  const email = 'maxway@restaurant.com';
  const password = 'password123';
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log("Created maxway@restaurant.com:", uid);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
      console.log("Logged into maxway@restaurant.com:", uid);
    } else {
      console.error(e);
      process.exit(1);
    }
  }

  await setDoc(doc(db, 'users', uid), {
    email: email,
    name: 'MaxWay Admin',
    role: 'restaurant',
    createdAt: new Date()
  });

  // Check if restaurant document exists, or create a dummy one
  // We'll create a new restaurant for MaxWay to guarantee it works.
  const restId = 'maxway_demo_1';
  await setDoc(doc(db, 'restaurants', restId), {
    name: 'MaxWay',
    cuisine: 'Fast Food',
    ownerId: uid,
    isActive: true,
    rating: 4.8,
    reviewCount: 150
  });

  console.log("SUCCESS");
  process.exit(0);
}
run();
