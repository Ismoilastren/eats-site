import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAfOH4SZAnd_3QNUsCExOa1VNCqY_AtjOw",
  authDomain: "project-2044813493052894984.firebaseapp.com",
  projectId: "project-2044813493052894984",
  storageBucket: "project-2044813493052894984.firebasestorage.app",
  messagingSenderId: "772538400522",
  appId: "1:772538400522:web:90b510468867b8984844f3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  try {
    // 1. Rename mainadmin@demo.com so it stops confusing the user
    const q1 = query(collection(db, 'users'), where('email', '==', 'mainadmin@demo.com'));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      await setDoc(doc(db, 'users', snap1.docs[0].id), {
        displayName: 'Demo Main Admin'
      }, { merge: true });
      console.log('Renamed mainadmin@demo.com');
    }

    // 2. We need to create the doc for admin@2321eats.com
    // We don't have their UID natively unless we query Firebase Auth.
    // Let's just create a new admin or assume they will be synced via AuthContext.
    // Since we don't have their UID, let's use the Admin SDK if possible, but we don't have it.
    console.log('Done script.');

  } catch (e) {
    console.log(`Error:`, e.message);
  }
  process.exit(0);
}

fix();
