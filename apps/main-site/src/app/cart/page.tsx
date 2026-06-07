'use client';

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ArrowLeft, MapPin, CreditCard, ChevronRight, X, Crosshair } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { auth, db, collection, getDocs, addDoc, onAuthStateChanged, query, serverTimestamp, doc, getDoc } from "@repo/firebase-config";
import { COLLECTIONS, formatCurrencyUZS, normalizeCoordinate, Restaurant } from "@repo/shared-types";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";

const TASHKENT_LOCATION = { latitude: 41.311081, longitude: 69.240562 };

function extractDeliveryFee(data: any): number | null {
  const value = data?.baseDeliveryFee ?? data?.deliveryFee ?? data?.defaultDeliveryFee;
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}

export default function CartPage() {
  const router = useRouter();
  const { cart, cartTotal, clearCart, removeFromCart } = useCart();
  
  const [user, setUser] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'card'>('card');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Address & Geolocation States
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("123 Delivery Street, Apt 4B");
  const [selectedLocation, setSelectedLocation] = useState({ latitude: 41.311081, longitude: 69.240562 });
  const [manualAddressInput, setManualAddressInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [fetchedDeliveryFee, setFetchedDeliveryFee] = useState(0);
  const [isFeeLoading, setIsFeeLoading] = useState(false);
  const { settings: globalSettings } = useSettings();

  const fetchCurrentDeliveryFee = async () => {
    const settingsSnap = await getDoc(doc(db, "settings", "global"));
    const settingsFee = settingsSnap.exists() ? extractDeliveryFee(settingsSnap.data()) : null;
    if (settingsFee !== null) return settingsFee;

    const systemSnap = await getDoc(doc(db, "system_settings", "global"));
    const systemFee = systemSnap.exists() ? extractDeliveryFee(systemSnap.data()) : null;
    if (systemFee !== null) return systemFee;

    const cartRestaurantFee = extractDeliveryFee({ deliveryFee: cart[0]?.restaurantDeliveryFee });
    return cartRestaurantFee ?? 0;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch saved cards
        const pmQuery = query(collection(db, COLLECTIONS.USERS, currentUser.uid, 'paymentMethods'));
        const pmSnapshot = await getDocs(pmQuery);
        const fetchedPMs: any[] = [];
        pmSnapshot.forEach(d => fetchedPMs.push({ id: d.id, ...d.data() }));
        setPaymentMethods(fetchedPMs);
        if (fetchedPMs.length > 0) setSelectedCardId(fetchedPMs[0].id);

        // Fetch saved addresses
        const addrQuery = query(collection(db, COLLECTIONS.USERS, currentUser.uid, 'addresses'));
        const addrSnapshot = await getDocs(addrQuery);
        const fetchedAddrs: any[] = [];
        addrSnapshot.forEach(d => fetchedAddrs.push({ id: d.id, ...d.data() }));
        setSavedAddresses(fetchedAddrs);
        if (fetchedAddrs.length > 0) {
          setSelectedAddress(fetchedAddrs[0].address);
          if (fetchedAddrs[0].latitude && fetchedAddrs[0].longitude) {
            setSelectedLocation({ latitude: fetchedAddrs[0].latitude, longitude: fetchedAddrs[0].longitude });
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDeliveryFee = async () => {
      if (cart.length === 0) {
        setFetchedDeliveryFee(0);
        return;
      }

      setIsFeeLoading(true);
      try {
        const fee = await fetchCurrentDeliveryFee();
        if (!cancelled) setFetchedDeliveryFee(fee);
      } catch (error) {
        console.error("Failed to fetch delivery fee:", error);
        if (!cancelled) setFetchedDeliveryFee(extractDeliveryFee({ deliveryFee: cart[0]?.restaurantDeliveryFee }) ?? 0);
      } finally {
        if (!cancelled) setIsFeeLoading(false);
      }
    };

    loadDeliveryFee();
    return () => {
      cancelled = true;
    };
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurantDeliveryFee]);

  const deliveryFee = cartTotal > 0 ? fetchedDeliveryFee : 0;
  const tax = cartTotal > 0 ? (cartTotal * globalSettings.taxRate) / 100 : 0;
  const total = cartTotal + deliveryFee + tax;

  const handlePlaceOrder = async () => {
    if (!user) return toast.error("Please log in to place an order");
    if (cart.length === 0) return toast.error("Your cart is empty");
    if (paymentType === 'card' && !selectedCardId) return toast.error("Please select a card or use cash");

    setIsSubmitting(true);
    try {
      const restaurantId = cart[0]?.restaurantId || 'unknown'; // Grouping assumes items from same restaurant
      const selectedCard = paymentType === 'card' ? paymentMethods.find((p: any) => p.id === selectedCardId) : null;
      const latestDeliveryFee = await fetchCurrentDeliveryFee();
      const restaurantSnap = restaurantId !== 'unknown'
        ? await getDoc(doc(db, COLLECTIONS.RESTAURANTS, restaurantId))
        : null;
      const restaurant = restaurantSnap?.exists()
        ? ({ id: restaurantSnap.id, ...restaurantSnap.data() } as Restaurant)
        : null;
      const restaurantLocation =
        normalizeCoordinate(restaurant?.location) ||
        normalizeCoordinate(cart[0]?.restaurantLocation) ||
        TASHKENT_LOCATION;
      const subtotal = cartTotal;
      const orderTotal = subtotal + latestDeliveryFee + tax;
      const customerName = user.displayName || user.email?.split('@')[0] || 'Unknown User';
      const customerPhone = user.phoneNumber || '';
      
      const newOrder = {
        userId: user.uid,
        restaurantId,
        restaurantName: restaurant?.name || cart[0]?.restaurantName || 'Restaurant',
        restaurantImage: restaurant?.imageUrl || cart[0]?.restaurantImage || '',
        courierId: null,
        assignedCourier: null,
        courierLocation: null,
        status: 'pending',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl || '',
          notes: deliveryInstructions
        })),
        subtotal,
        deliveryFee: latestDeliveryFee,
        totalAmount: orderTotal,
        total: orderTotal,
        paymentMethod: paymentType === 'card' ? {
          type: 'CARD',
          brand: selectedCard?.brand || 'Unknown',
          last4: selectedCard?.last4 || '0000'
        } : {
          type: 'CASH'
        },
        deliveryAddress: selectedAddress,
        customerAddress: selectedAddress,
        deliveryLocation: selectedLocation,
        customerLocation: { lat: selectedLocation.latitude, lng: selectedLocation.longitude },
        restaurantLocation,
        deliveryInstructions,
        customer: {
          name: customerName,
          phone: customerPhone,
          email: user.email || ''
        },
        customerName,
        customerPhone,
        estimatedDelivery: null,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.ORDERS), newOrder);
      toast.success("Order placed successfully!");
      clearCart();
      router.push(`/orders/${docRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            let addressName = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
            if (data && data.address) {
              const road = data.address.road || data.address.pedestrian || '';
              const area = data.address.neighbourhood || data.address.suburb || data.address.city || '';
              const cleanAddress = [road, area].filter(Boolean).join(', ');
              if (cleanAddress) {
                addressName = cleanAddress;
              } else if (data.display_name) {
                addressName = data.display_name.split(',').slice(0, 2).join(',');
              }
            } else if (data && data.display_name) {
              addressName = data.display_name.split(',').slice(0, 2).join(',');
            }
            
            setSelectedAddress(addressName);
            setSelectedLocation({ latitude, longitude });
            setIsAddressModalOpen(false);
            toast.success("Location found!");
          } catch (error) {
            setSelectedAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
            setSelectedLocation({ latitude, longitude });
            setIsAddressModalOpen(false);
            toast.success("Coordinates set, but reverse geocoding failed.");
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          setIsLocating(false);
          toast.error("Location access denied or failed.");
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser");
    }
  };

  const handleManualAddressSubmit = () => {
    if (!manualAddressInput.trim()) return toast.error("Enter an address");
    setSelectedAddress(manualAddressInput);
    // Dummy coordinates if manual address doesn't geocode (Tashkent default)
    setSelectedLocation({ latitude: 41.311081, longitude: 69.240562 });
    setManualAddressInput("");
    setIsAddressModalOpen(false);
  };


  return (
    <div className="pt-28 pb-20 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-8">
          <button onClick={() => router.back()} className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft size={20} />
            <span>Back to menu</span>
          </button>
        </div>

        <h1 className="text-3xl font-bold text-secondary mb-8">Your Cart</h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items List */}
          <div className="flex-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
                Order from {cart[0]?.restaurantName || 'selected restaurant'}
              </h2>
              
              <div className="space-y-6">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
                      <p className="text-gray-500 mb-6 text-lg">Your cart is empty.</p>
                      <Link className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg" href="/">
                          Go to all restaurants
                      </Link>
                  </div>
                ) : cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-4">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                            <Image src={item.imageUrl || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"} alt={item.name} fill className="object-cover" />
                          </div>
                          <div className="flex flex-col">
                              <span className="font-bold text-gray-900 dark:text-white">{item.name}</span>
                          </div>
                      </div>

                      <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                              <span className="font-bold text-gray-900 dark:text-white">
                                  {formatCurrencyUZS(item.price * item.quantity)}
                              </span>
                              <span className="text-sm font-medium text-gray-500">
                                  Qty: {item.quantity}
                              </span>
                          </div>
                          
                          <button
                              onClick={() => removeFromCart(item.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-100 hover:border-red-500 shadow-sm"
                              title="Remove item"
                          >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                          </button>
                      </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Details */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Details</h2>
              
              <div 
                onClick={() => setIsAddressModalOpen(true)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-primary shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Delivery Address</div>
                    <div className="text-sm text-gray-500 line-clamp-2 leading-tight">{selectedAddress}</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400 shrink-0 ml-2" />
              </div>
              
              <textarea 
                placeholder="Add delivery instructions (e.g., ring doorbell, leave at door...)" 
                value={deliveryInstructions}
                onChange={e => setDeliveryInstructions(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm h-24 resize-none"
              ></textarea>
            </div>
            
            {/* Payment Details */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Method</h2>
              
              <div className="space-y-4 mb-4">
                <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${paymentType === 'cash' ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                  <input type="radio" name="payment" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="w-5 h-5 text-primary accent-primary" />
                  <div className="font-bold text-gray-900">Cash on Delivery</div>
                </label>

                <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${paymentType === 'card' ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                  <input type="radio" name="payment" checked={paymentType === 'card'} onChange={() => setPaymentType('card')} className="w-5 h-5 text-primary accent-primary" />
                  <div className="flex items-center gap-3">
                    <CreditCard size={20} className={paymentType === 'card' ? 'text-primary' : 'text-gray-500'} />
                    <div className="font-bold text-gray-900">Saved Card</div>
                  </div>
                </label>
              </div>

              {paymentType === 'card' && (
                <div className="pl-10 space-y-3">
                  {paymentMethods.length === 0 ? (
                    <p className="text-sm text-gray-500">No saved cards. Please add one in your Profile.</p>
                  ) : (
                    <select 
                      value={selectedCardId} 
                      onChange={e => setSelectedCardId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {paymentMethods.map((card: any) => (
                        <option key={card.id} value={card.id}>
                          {card.brand} •••• {card.last4}
                        </option>
                      ))}
                    </select>
                  )}
                  <Link href="/profile" className="text-primary font-medium hover:underline text-sm flex items-center gap-1 mt-2">
                    <Plus size={16} /> Manage payment methods
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-28 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h3>
              
              <div className="space-y-4 text-sm text-gray-600 mb-6">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrencyUZS(cartTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-medium">{isFeeLoading ? 'Loading...' : formatCurrencyUZS(deliveryFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span className="font-medium">{formatCurrencyUZS(tax)}</span>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4 mb-8">
                <div className="flex justify-between items-end">
                  <span className="font-bold text-gray-900 text-lg">Total</span>
                  <span className="font-extrabold text-2xl text-secondary">{formatCurrencyUZS(total)}</span>
                </div>
              </div>
              
              <button 
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-1 flex items-center justify-center border-none cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Address Selection Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 flex justify-between items-center border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Select Delivery Address</h3>
              <button 
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Geolocation Button */}
              <button 
                onClick={handleGetLocation}
                disabled={isLocating}
                className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 px-4 rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <Crosshair size={18} />
                {isLocating ? 'Locating...' : 'Use My Current Location'}
              </button>

              {/* Saved Addresses */}
              {savedAddresses.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Saved Addresses</h4>
                  <div className="space-y-2">
                    {savedAddresses.map((addr) => (
                      <div 
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddress(addr.address);
                          if (addr.latitude && addr.longitude) {
                            setSelectedLocation({ latitude: addr.latitude, longitude: addr.longitude });
                          }
                          setIsAddressModalOpen(false);
                        }}
                        className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary/40 cursor-pointer bg-gray-50 transition-colors"
                      >
                        <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{addr.label || 'Saved Location'}</div>
                          <div className="text-xs text-gray-500 mt-1">{addr.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Entry */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Enter Manually</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="E.g. Tashkent, Amir Temur 14" 
                    value={manualAddressInput}
                    onChange={(e) => setManualAddressInput(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button 
                    onClick={handleManualAddressSubmit}
                    className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
