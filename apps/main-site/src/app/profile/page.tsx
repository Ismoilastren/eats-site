'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  auth, db, doc, getDoc, updateDoc, setDoc, addDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, signOut, onAuthStateChanged, onSnapshot, updateProfile, writeBatch
} from "@repo/firebase-config";
import { COLLECTIONS, formatCurrencyUZS, formatFirestoreDate, normalizeOrderStatus, Order } from "@repo/shared-types";
import { LogOut, User as UserIcon, Mail, Phone, Package, Clock, ChevronRight, Edit2, Check, X, Loader2, CreditCard, Plus, Trash2, MapPin } from "lucide-react";
import toast from 'react-hot-toast';
import Link from 'next/link';

const getCardBrand = (number: string) => {
  if (!number) return 'Unknown';
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  if (/^8600/.test(number)) return 'Uzcard'; // Uzbek local
  if (/^9860/.test(number)) return 'Humo';   // Uzbek local
  return 'Other';
};

const getBrandColor = (brand: string) => {
  switch (brand) {
    case 'Visa': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Mastercard': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Amex': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Uzcard': return 'bg-green-50 text-green-700 border-green-200';
    case 'Humo': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export default function ProfilePage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: ""
  });

  // Payment Method States
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', holder: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  // Address States
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthLoading(false);
      } else {
        router.push("/auth/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Real-time listener for addresses
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'addresses'), (snapshot) => {
      const fetchedAddresses: any[] = [];
      snapshot.forEach(doc => fetchedAddresses.push({ id: doc.id, ...doc.data() }));
      setAddresses(fetchedAddresses);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Fetch User Profile & Orders
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfileData(data);
          setEditForm({
            fullName: data.fullName || user.displayName || "",
            phone: data.phone || ""
          });
        }

        const ordersQuery = query(
          collection(db, COLLECTIONS.ORDERS), 
          where('userId', '==', user.uid), 
          limit(50)
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        const fetchedOrders: Order[] = [];
        ordersSnapshot.forEach((doc) => {
          fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
        });
        
        // Sort in JavaScript to avoid Firestore Composite Index requirements
        fetchedOrders.sort((a, b) => {
          const timeA = a.createdAt ? (a.createdAt as any).seconds || 0 : 0;
          const timeB = b.createdAt ? (b.createdAt as any).seconds || 0 : 0;
          return timeB - timeA;
        });
        
        setOrders(fetchedOrders.slice(0, 21));

        const pmQuery = query(collection(db, COLLECTIONS.USERS, user.uid, 'paymentMethods'));
        const pmSnapshot = await getDocs(pmQuery);
        const fetchedPMs: any[] = [];
        pmSnapshot.forEach(doc => fetchedPMs.push({ id: doc.id, ...doc.data() }));
        setPaymentMethods(fetchedPMs);
      } catch (error: any) {
        console.error("Failed to fetch profile or orders:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    if (!isAuthLoading && user) {
      fetchData();
    }
  }, [user, isAuthLoading]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out.");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'addresses', id));
      toast.success("Address deleted");
    } catch (e) {
      toast.error("Failed to delete address");
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newAddress.address.trim()) return toast.error("Address is required");
    setIsAddingAddress(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'addresses'), {
        label: newAddress.label || 'Saved Location',
        address: newAddress.address,
        createdAt: new Date()
      });
      toast.success("Address added");
      setIsAddressModalOpen(false);
      setNewAddress({ label: '', address: '' });
    } catch (e) {
      toast.error("Failed to add address");
    } finally {
      setIsAddingAddress(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          
          if (data && data.address) {
            const road = data.address.road || data.address.pedestrian || '';
            const area = data.address.neighbourhood || data.address.suburb || data.address.city || '';
            
            let cleanAddress = [road, area].filter(Boolean).join(', ');
            
            if (!cleanAddress && data.display_name) {
              cleanAddress = data.display_name.split(',').slice(0, 2).join(',');
            }
            
            if (cleanAddress) {
              setNewAddress(prev => ({ ...prev, address: cleanAddress }));
              toast.success("Location found!");
            } else {
              setNewAddress(prev => ({ ...prev, address: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}` }));
            }
          } else if (data && data.display_name) {
            setNewAddress(prev => ({ ...prev, address: data.display_name.split(',').slice(0, 2).join(',') }));
            toast.success("Location found!");
          } else {
            setNewAddress(prev => ({ ...prev, address: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}` }));
          }
        } catch (error) {
          setNewAddress(prev => ({ ...prev, address: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}` }));
          toast.error("Could not fetch street name, using coordinates.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        toast.error("Location access denied.");
      }
    );
  };

  const handleSaveProfile = async () => {
    console.log("DEBUG: Save button clicked!");

    const newNickname = editForm.fullName.trim();
    if (!newNickname) return toast.error("Name cannot be empty");

    const phoneRegex = /^\+?[1-9]\d{8,12}$/;
    const cleanPhone = editForm.phone.replace(/\s+/g, '');

    if (!phoneRegex.test(cleanPhone) || cleanPhone.includes("000000")) {
        toast.error("Invalid phone format. Enter a real number (e.g., +998901234567).");
        return; // BLOCK DATABASE UPDATE
    }

    setIsSaving(true);
    
    try {
        console.log("DEBUG: Attempting Firebase updateDoc & Batch Fan-Out...");
        
        if (!user || !user.uid) {
            console.error("DEBUG: No User UID found!");
            toast.error('Authentication error. Please re-login.');
            return;
        }

        // 1. Update Standard Auth & User Document
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: newNickname });
        }
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
            fullName: newNickname,
            phone: cleanPhone,
            role: profileData?.role || 'client'
        }, { merge: true });
        
        // 2. LOGIC LEVEL MAX: Data Fan-Out to all associated Orders
        const batch = writeBatch(db);
        const ordersRef = collection(db, 'orders');
        
        // Find all orders belonging to this exact user
        const q = query(ordersRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        // Queue up the name change for every single order they've ever made
        querySnapshot.forEach((orderDoc) => {
            batch.update(orderDoc.ref, { 
                customerName: newNickname,
                "customer.name": newNickname
            });
        });

        // Commit the batch to the database instantly
        await batch.commit();
        
        console.log("DEBUG: Firebase Batch Fan-Out SUCCESS!");
        
        setProfileData((prev: any) => ({
          ...prev,
          fullName: newNickname,
          phone: cleanPhone
        }));
        
        setIsEditing(false);
        toast.success("Profile and Order History synced successfully!");
    } catch (error) {
        console.error("DEBUG: Firebase Batch FAILED!", error);
        toast.error("Failed to sync profile updates.");
    } finally {
        console.log("DEBUG: Saving process finished.");
        setIsSaving(false);
    }
  };

  const validateExpiry = (expiry: string) => {
    // Regex: MM/YY
    if (!/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(expiry)) return false;
    
    const [month, year] = expiry.split('/').map(n => parseInt(n, 10));
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = parseInt(now.getFullYear().toString().slice(-2), 10);
    
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    return true;
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.uid) return toast.error('Authentication error.');

    const cleanNumber = cardForm.number.replace(/\s+/g, '');
    if (!/^\d{16}$/.test(cleanNumber)) {
      setErrors({ number: 'Invalid number' });
      return toast.error('Card number must be 16 digits');
    }
    if (!validateExpiry(cardForm.expiry)) {
      setErrors({ expiry: 'Invalid expiry date' });
      toast.error('Invalid expiry date. Please check the format (MM/YY).');
      return;
    }
    if (!/^\d{3}$/.test(cardForm.cvv)) {
      setErrors({ cvv: 'Invalid CVV' });
      return toast.error('CVV must be 3 digits');
    }
    if (!cardForm.holder.trim()) {
      setErrors({ holder: 'Name is required' });
      return toast.error('Holder name is required');
    }

    setErrors({});
    setIsAddingCard(true);
    try {
      const brand = getCardBrand(cleanNumber);
      
      const newCard = {
        brand,
        last4: cleanNumber.slice(-4),
        holderName: cardForm.holder.trim(),
        token: `tok_${Math.random().toString(36).substring(2, 10)}`,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.USERS, user.uid, 'paymentMethods'), newCard);
      
      setPaymentMethods(prev => [...prev, { id: docRef.id, ...newCard }]);
      setCardForm({ number: '', expiry: '', cvv: '', holder: '' });
      setIsCardModalOpen(false);
      toast.success('Payment method added successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add card');
    } finally {
      setIsAddingCard(false);
    }
  };

  const handleDeleteCard = (id: string) => {
    setCardToDelete(id);
  };

  const confirmDeleteCard = async () => {
    if (!user || !user.uid || !cardToDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, user.uid, 'paymentMethods', cardToDelete));
      setPaymentMethods(prev => prev.filter(c => c.id !== cardToDelete));
      toast.success('Card removed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove card');
    } finally {
      setCardToDelete(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (normalizeOrderStatus(status)) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-indigo-100 text-indigo-800';
      case 'picked_up': return 'bg-blue-100 text-blue-800';
      case 'on_the_way': return 'bg-emerald-100 text-emerald-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-28 pb-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-28 pb-20">
      <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SECTION A: My Data */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              
              {/* Header: Edit / Save Controls */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 text-lg">Details</h3>
                {!isEditing ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-primary hover:text-primary/80 transition-colors p-2 rounded-lg hover:bg-primary/5 flex items-center gap-1 text-sm font-bold bg-transparent border-none cursor-pointer"
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          fullName: profileData?.fullName || user?.displayName || "",
                          phone: profileData?.phone || ""
                        });
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100 bg-transparent border-none cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="text-white bg-primary hover:bg-primary/90 transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm font-bold border-none cursor-pointer disabled:opacity-70"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
                    </button>
                  </div>
                )}
              </div>

              {/* Avatar & Info Section */}
              <div className="flex flex-col items-center gap-4 mb-8 text-center">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border-4 border-white shadow-sm">
                  <UserIcon size={40} />
                </div>
                <div className="w-full break-words whitespace-normal px-2">
                  {!isEditing ? (
                    <h2 className="text-xl font-bold text-gray-900 break-words whitespace-normal">
                      {profileData?.fullName || user?.displayName || "User"}
                    </h2>
                  ) : (
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center font-bold text-gray-900 outline-none"
                      placeholder="Your Full Name"
                    />
                  )}
                  <div className="mt-2">
                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {profileData?.role === 'client' ? 'Customer' : profileData?.role || 'Customer'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-5 mb-8">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-gray-500" />
                  </div>
                  <div className="flex flex-col w-full overflow-hidden">
                    <span className="text-xs text-gray-400 font-medium uppercase">Email (Unchangeable)</span>
                    <span className="font-medium break-all whitespace-normal block w-full" title={profileData?.email || user?.email}>{profileData?.email || user?.email || "No email provided"}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-gray-500" />
                  </div>
                  <div className="flex flex-col w-full break-words whitespace-normal">
                    <span className="text-xs text-gray-400 font-medium uppercase">Phone Number</span>
                    {!isEditing ? (
                      <span className="font-medium break-words whitespace-normal">{profileData?.phone || "Not provided"}</span>
                    ) : (
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9+]/g, '');
                          setEditForm(prev => ({ ...prev, phone: val }));
                        }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-gray-900 outline-none mt-1"
                        placeholder="+998901234567"
                      />
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors border border-red-100 border-none cursor-pointer"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>

            {/* Payment Methods Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <CreditCard size={20} className="text-primary" />
                  Payment Methods
                </h3>
                <button 
                  onClick={() => setIsCardModalOpen(true)}
                  className="text-primary hover:text-primary/80 transition-colors p-1.5 rounded-lg hover:bg-primary/5 bg-transparent border-none cursor-pointer"
                >
                  <Plus size={20} />
                </button>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No cards added yet.<br/>Add a card for faster checkout.
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map(card => (
                    <div key={card.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-8 rounded-md flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getBrandColor(card.brand)}`}>
                          {card.brand}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">•••• {card.last4}</span>
                          <span className="text-xs text-gray-400">{card.holderName}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteCard(card.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-transparent border-none cursor-pointer p-1"
                        title="Delete Card"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Locations Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <MapPin size={20} className="text-primary" />
                  Saved Locations
                </h3>
                <button 
                  onClick={() => setIsAddressModalOpen(true)}
                  className="text-primary hover:text-primary/80 transition-colors p-1.5 rounded-lg hover:bg-primary/5 bg-transparent border-none cursor-pointer"
                >
                  <Plus size={20} />
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Saved Locations: 0<br/>Add a delivery address.
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(addr => (
                    <div key={addr.id} className="flex items-start justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors group">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-0.5 shrink-0`}>
                          <MapPin size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{addr.label || 'Home'}</span>
                          <span className="text-xs text-gray-500 line-clamp-2">{addr.address}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-transparent border-none cursor-pointer p-1"
                        title="Delete Address"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          
          {/* SECTION B: Order History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Package className="text-primary" />
                  Order History
                </h2>
              </div>
              
              {isDataLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-50 h-24 rounded-xl border border-gray-100 w-full"></div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Package size={32} className="text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">No orders yet</h3>
                  <p className="text-gray-500 max-w-sm">Looks like you haven't placed any orders. Let's find some delicious food for you!</p>
                  <button 
                    onClick={() => router.push('/')}
                    className="mt-6 px-6 py-2.5 bg-primary text-white font-medium rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors border-none cursor-pointer"
                  >
                    Explore Restaurants
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-gray-100 rounded-xl p-4 hover:border-primary/30 transition-colors group cursor-pointer">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm text-gray-500 mb-1 font-medium flex items-center gap-1.5">
                            <Clock size={14} />
                            {formatFirestoreDate(order.createdAt)}
                          </p>
                          <h4 className="font-bold text-gray-900">Order #{order.id.substring(0, 8).toUpperCase()}</h4>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                          {normalizeOrderStatus(order.status).replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                        <p className="font-medium text-gray-700">
                          {formatCurrencyUZS(order.totalAmount)}
                        </p>
                        <Link href={`/orders/${order.id}`} className="flex items-center gap-1 text-primary text-sm font-bold group-hover:translate-x-1 transition-transform no-underline">
                          View Details <ChevronRight size={16} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Card Modal */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsCardModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <CreditCard className="text-primary" /> Add New Card
            </h3>
            
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Card Number</label>
                <input 
                  type="text" 
                  maxLength={19}
                  value={cardForm.number}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const formatted = val.replace(/(.{4})/g, '$1 ').trim();
                    setCardForm({...cardForm, number: formatted});
                    if (errors.number) setErrors({...errors, number: ''});
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none ${errors.number ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                  placeholder="0000 0000 0000 0000"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expiry</label>
                  <input 
                    type="text" 
                    maxLength={5}
                    value={cardForm.expiry}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 2) val = `${val.slice(0,2)}/${val.slice(2,4)}`;
                      setCardForm({...cardForm, expiry: val});
                      if (errors.expiry) setErrors({...errors, expiry: ''});
                    }}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-center ${errors.expiry ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">CVV</label>
                  <input 
                    type="password" 
                    maxLength={3}
                    value={cardForm.cvv}
                    onChange={(e) => {
                      setCardForm({...cardForm, cvv: e.target.value.replace(/\D/g, '')});
                      if (errors.cvv) setErrors({...errors, cvv: ''});
                    }}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-center ${errors.cvv ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                    placeholder="123"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cardholder Name</label>
                <input 
                  type="text" 
                  value={cardForm.holder}
                  onChange={(e) => {
                    setCardForm({...cardForm, holder: e.target.value});
                    if (errors.holder) setErrors({...errors, holder: ''});
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none uppercase ${errors.holder ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                  placeholder="JOHN DOE"
                />
              </div>
              <button 
                type="submit"
                disabled={isAddingCard}
                className="w-full mt-6 bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                {isAddingCard ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Save Card
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Card Confirmation Modal */}
      {cardToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Card?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to remove this payment method? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border-none cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteCard}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors border-none cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <MapPin className="text-primary" /> Add Location
            </h3>
            
            <form onSubmit={handleAddAddress} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Label (e.g. Home, Work)</label>
                <input 
                  type="text" 
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none border-gray-300 focus:border-primary"
                  placeholder="Home"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Address Details</label>
                  <button 
                    type="button" 
                    onClick={handleDetectLocation} 
                    disabled={isLocating}
                    className="text-xs font-bold text-blue-500 hover:text-blue-600 bg-transparent border-none cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    📍 {isLocating ? 'Detecting...' : 'Detect My Location'}
                  </button>
                </div>
                <textarea 
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none border-gray-300 focus:border-primary resize-none h-24"
                  placeholder="Street, Building, Apartment..."
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isAddingAddress}
                className="w-full mt-6 bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                {isAddingAddress ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Save Address
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
