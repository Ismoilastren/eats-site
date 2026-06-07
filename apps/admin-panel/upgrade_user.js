import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function upgrade() {
  try {
    const q = query(collection(db, 'users'), where('email', '==', 'admin@2321eats.com'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log('User not found in Firestore.');
    } else {
      const userDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        role: 'superadmin'
      });
      console.log('Upgraded admin@2321eats.com to superadmin!');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}

upgrade();
