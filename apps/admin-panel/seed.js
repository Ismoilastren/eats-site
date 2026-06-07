import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Replace with the user's actual config
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

async function seed() {
  console.log('Starting seed...');
  
  for (let i = 1; i <= 10; i++) {
    try {
      const email = `admin${i}@demo.com`;
      const password = `password123`;
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email,
        name: `Demo Admin ${i}`,
        role: 'admin',
        createdAt: new Date()
      });
      console.log(`Created Admin: ${email}`);
    } catch (e) {
      console.log(`Failed to create Admin ${i}:`, e.message);
    }
  }

  for (let i = 1; i <= 10; i++) {
    try {
      const email = `user${i}@demo.com`;
      const password = `password123`;
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email,
        name: `Demo User ${i}`,
        role: 'user',
        createdAt: new Date()
      });
      console.log(`Created User: ${email}`);
    } catch (e) {
      console.log(`Failed to create User ${i}:`, e.message);
    }
  }

  console.log('Seeding complete! You can login with admin1@demo.com / password123');
  process.exit(0);
}

seed();
