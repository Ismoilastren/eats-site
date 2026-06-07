import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';

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
  const email = 'manager@testeats.com';
  const password = 'password123';
  const restId = 'ncFpOrW29r9qnxGXYAr8';
  
  try {
     console.log('Creating manager account...');
     let uid;
     try {
       const userCred = await createUserWithEmailAndPassword(auth, email, password);
       uid = userCred.user.uid;
     } catch (e) {
       if (e.code === 'auth/email-already-in-use') {
          // just use manager2
          const userCred2 = await createUserWithEmailAndPassword(auth, 'manager2@testeats.com', password);
          uid = userCred2.user.uid;
       } else {
          throw e;
       }
     }
     
     console.log(`Setting up user document for uid: ${uid}`);
     await setDoc(doc(db, 'users', uid), {
       email: 'manager@testeats.com',
       name: 'Test Eats Manager',
       role: 'restaurant',
       createdAt: new Date()
     });
     
     console.log(`Linking to restaurant ${restId}...`);
     await updateDoc(doc(db, 'restaurants', restId), {
       ownerId: uid
     });
     
     console.log('\n--- SUCCESS ---');
     console.log(`Email: manager@testeats.com (or manager2@testeats.com)`);
     console.log(`Password: ${password}`);
     console.log('----------------\n');
  } catch(e) {
     console.log('Error', e);
  }
  process.exit();
}

seed();
