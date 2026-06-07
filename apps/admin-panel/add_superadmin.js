import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAfOH4SZAnd_3QNUsCExOa1VNCqY_AtjOw",
  authDomain: "project-2044813493052894984.firebaseapp.com",
  projectId: "project-2044813493052894984",
  storageBucket: "project-2044813493052894984.firebasestorage.app",
  messagingSenderId: "772538400522",
  appId: "1:772538400522:web:90b510468867b8984844f3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function addUsers() {
  try {
    const email1 = 'mainadmin@demo.com';
    const cred1 = await createUserWithEmailAndPassword(auth, email1, 'password123');
    await setDoc(doc(db, 'users', cred1.user.uid), {
      email: email1,
      displayName: 'Main Admin (Siz)',
      role: 'superadmin',
      createdAt: new Date()
    });
    console.log(`Created Superadmin: ${email1}`);
  } catch (e) {
    console.log(`Superadmin error:`, e.message);
  }

  try {
    const email2 = 'brother@demo.com';
    const cred2 = await createUserWithEmailAndPassword(auth, email2, 'password123');
    await setDoc(doc(db, 'users', cred2.user.uid), {
      email: email2,
      displayName: 'Brother Admin',
      role: 'admin',
      createdAt: new Date()
    });
    console.log(`Created Brother Admin: ${email2}`);
  } catch (e) {
    console.log(`Brother error:`, e.message);
  }

  process.exit(0);
}

addUsers();
