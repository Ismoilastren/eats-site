import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Need to use the explicit API key from the environment.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    const email = 'admin@expressets.com';
    const password = 'password123';
    
    console.log('Creating user...');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      console.log('User created:', cred.user.uid);
      
      console.log('Setting admin role in Firestore...');
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        role: 'admin',
        displayName: 'Administrator',
        createdAt: new Date()
      });
      console.log('Success! Admin user seeded.');
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('User already exists. Skipping creation.');
        
        // Ensure they have the admin role
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          email,
          role: 'admin',
          displayName: 'Administrator',
          createdAt: new Date()
        });
        console.log('Updated existing user with admin role.');
      } else {
        throw e;
      }
    }
  } catch (err) {
    console.error('Failed to create admin:', err);
  } finally {
    process.exit(0);
  }
}

run();
