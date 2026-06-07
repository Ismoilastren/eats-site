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

async function seed() {
  console.log('Starting seed...');
  try {
    const email = `manager@restaurant.com`;
    const password = `password123`;
    const userCred = await createUserWithEmailAndPassword(auth, email, password).catch(async (e) => {
      if (e.code === 'auth/email-already-in-use') {
        console.log('User already exists, updating restaurant...');
        // We need to fetch the existing user ID, but we can't easily without admin SDK.
        // Let's just create manager2@restaurant.com
        return createUserWithEmailAndPassword(auth, `manager2@restaurant.com`, password);
      }
      throw e;
    });
    
    const actualEmail = userCred.user.email;
    const uid = userCred.user.uid;

    await setDoc(doc(db, 'users', uid), {
      email: actualEmail,
      name: `Demo Manager`,
      role: 'restaurant',
      createdAt: new Date()
    });

    const restaurantId = `rest-${uid}`;
    await setDoc(doc(db, 'restaurants', restaurantId), {
      ownerId: uid,
      name: 'Express Premium Eats',
      description: 'The best premium food in town.',
      isActive: true,
      menu: [
        {
          id: 'm-1',
          name: 'Premium Burger',
          price: 15.99,
          description: 'A very premium burger',
          category: 'Main Course',
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
        }
      ],
      createdAt: new Date()
    });

    console.log(`Created Manager: ${actualEmail}`);
    console.log(`Created Restaurant: ${restaurantId}`);
    console.log(`\nLOGIN WITH:\nEmail: ${actualEmail}\nPassword: ${password}`);
  } catch (e) {
    console.error('Seed failed:', e);
  }
  process.exit(0);
}

seed();
