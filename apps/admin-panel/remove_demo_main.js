import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';

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

async function remove() {
  try {
    const q1 = query(collection(db, 'users'), where('email', '==', 'mainadmin@demo.com'));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      for (const d of snap1.docs) {
        await deleteDoc(doc(db, 'users', d.id));
        console.log('Deleted mainadmin@demo.com');
      }
    } else {
      console.log('mainadmin@demo.com not found.');
    }
  } catch (e) {
    console.log(`Error:`, e.message);
  }
  process.exit(0);
}

remove();
