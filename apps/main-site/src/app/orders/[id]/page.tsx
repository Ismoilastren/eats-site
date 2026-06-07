'use client';

import { use, useEffect, useState } from "react";
import { db, doc, onSnapshot, runTransaction, serverTimestamp } from "@repo/firebase-config";
import toast from "react-hot-toast";
import {
  canClientCancelOrder,
  COLLECTIONS,
  Courier,
  formatCurrencyUZS,
  getCourierVehicleType,
  getVehicleLabel,
  Order,
  normalizeOrderStatus,
} from "@repo/shared-types";
import { Bike, Car, CheckCircle, Clock, Footprints, MapPin, Package, Truck } from "lucide-react";
import dynamic from "next/dynamic";

const OrderMap = dynamic(() => import("@/components/OrderMap"), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] mt-6 bg-gray-100 animate-pulse rounded-2xl"></div>
});

// Haversine distance formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
}

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const tipOptions = [0, 5000, 10000, 15000];
  const isCardPayment = (order as any)?.paymentMethod?.type !== 'Cash' && (order as any)?.paymentMethod?.type !== 'CASH';
  const assignedCourier = (order as any)?.assignedCourier || null;
  const assignedCourierId = assignedCourier?.id || null;
  const vehicleType = getCourierVehicleType(courier, assignedCourier);
  const VehicleIcon = vehicleType === 'car' ? Car : vehicleType === 'foot' ? Footprints : Bike;

  const handleCancelOrder = async () => {
    if (!order || isCancelling) return;
    if (!canClientCancelOrder(order.status)) {
      toast.error('Only pending orders can be cancelled.');
      return;
    }

    setIsCancelling(true);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order no longer exists.');

        const current = orderSnap.data() as Order;
        if (!canClientCancelOrder(current.status)) {
          throw new Error('This order is already being prepared and cannot be cancelled.');
        }
        if ((current as any).assignedCourier || current.courierId) {
          throw new Error('A courier is already assigned. Please contact support.');
        }

        transaction.update(orderRef, {
          status: 'cancelled',
          cancelReason: 'Cancelled by customer',
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      toast.success('Order cancelled successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel order.';
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const submitReview = async () => {
      if (rating === 0) return toast.error("Please select a star rating!");
      if (!order) return;
      setIsSubmittingReview(true);
      
      try {
          await runTransaction(db, async (transaction) => {
              const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
              const orderSnap = await transaction.get(orderRef);
              if (!orderSnap.exists()) throw new Error("Order no longer exists.");

              const current = orderSnap.data() as Order;
              if (normalizeOrderStatus(current.status) !== 'delivered') {
                throw new Error("Feedback is only available after delivery.");
              }

              transaction.update(orderRef, {
                  review: { rating, comment, createdAt: new Date().toISOString() },
                  ...(tipAmount > 0 && { tipAmount }),
                  updatedAt: serverTimestamp(),
              });
          });

          toast.success("Feedback submitted. Thank you!");
      } catch (error) {
          console.error("Transaction failed: ", error);
          toast.error("Failed to submit feedback.");
      } finally {
          setIsSubmittingReview(false);
      }
  };

  useEffect(() => {
    if (!orderId) return; // Ensure you have the ID from URL params

    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
        if (docSnap.exists()) {
            setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        } else {
            console.error("Order not found");
        }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    // Listen to Courier Document if order has courierId and is in transit
    if (assignedCourierId && !['cancelled'].includes(normalizeOrderStatus(order?.status))) {
      const unsubscribeCourier = onSnapshot(doc(db, COLLECTIONS.COURIERS, assignedCourierId), (docSnap) => {
        if (docSnap.exists()) {
          const courierData = { id: docSnap.id, ...docSnap.data() } as Courier;
          setCourier(courierData);
        }
      });
      return () => unsubscribeCourier();
    }
    setCourier(null);
  }, [assignedCourierId, order?.status]);

  useEffect(() => {
    const loc = order?.courierLocation || (order as any)?.courier?.location || courier?.currentLocation;
    if (loc && order?.deliveryLocation && normalizeOrderStatus(order.status) === 'courier_picked_up') {
      const distance = getDistanceFromLatLonInKm(
        loc.latitude || loc.lat,
        loc.longitude || loc.lng,
        order.deliveryLocation.latitude,
        order.deliveryLocation.longitude
      );
      
      // ETA (mins) = (distance / speed) * 60 + bufferTime
      const averageSpeed = 40; // km/h
      const bufferTime = 3; // minutes
      const estimatedMinutes = Math.ceil((distance / averageSpeed) * 60 + bufferTime);
      setEta(estimatedMinutes);
    }
  }, [order, courier]);

  if (!order) {
    return (
      <div className="bg-gray-50 min-h-screen pt-28 pb-20 flex justify-center items-center">
        <div className="animate-pulse w-12 h-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const steps = [
    { id: 'pending', icon: Clock, label: 'Pending' },
    { id: 'preparing', icon: Package, label: 'Preparing' },
    { id: 'courier_picked_up', icon: Truck, label: 'On the Way' },
    { id: 'delivered', icon: CheckCircle, label: 'Delivered' }
  ];

  const normalizedStatus = normalizeOrderStatus(order.status);
  let currentStepIndex = steps.findIndex(s => s.id === normalizedStatus);

  const activeStep = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div className="bg-gray-50 min-h-screen pt-28 pb-20">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                Order <span className="font-mono text-brand-600 bg-brand-50 px-3 py-1 rounded-lg border border-brand-200 tracking-wider font-black">#{order.id.slice(0, 6).toUpperCase()}</span>
              </h1>
              <p className="text-gray-500 mt-2 font-medium">{order.restaurantName}</p>
            </div>
            {eta !== null && normalizedStatus === 'courier_picked_up' && (
              <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-brand-200">
                <Clock size={20} />
                <span>ETA: {eta} mins</span>
              </div>
            )}
          </div>

          {/* Stepper */}
          <div className="relative mb-12 mt-8 px-2 md:px-8">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full hidden md:block"></div>
            <div 
              className="absolute top-1/2 left-0 h-1 bg-brand-500 -translate-y-1/2 rounded-full transition-all duration-500 hidden md:block"
              style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
            ></div>
            
            <div className="flex flex-col md:flex-row justify-between relative z-10 gap-6 md:gap-0">
              {steps.map((step, index) => {
                const isActive = index <= activeStep;
                const isCurrent = index === activeStep;
                const Icon = step.icon;
                
                return (
                  <div key={step.id} className="flex md:flex-col items-center gap-4 md:gap-2 text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 shadow-sm transition-colors duration-300 ${
                      isActive 
                        ? 'bg-brand-500 border-white text-white' 
                        : 'bg-white border-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-brand-100 scale-110' : ''}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className={`font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                      {isCurrent && index === 2 && eta !== null && (
                        <p className="text-xs text-brand-600 font-medium md:hidden mt-1">{eta} mins away</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tracking Map */}
          <div className="md:col-span-2">
            <div className="relative w-full">
              <OrderMap order={order} />
              
              {/* Floating Status Card over Map */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[400] w-11/12 max-w-sm pointer-events-none">
                {normalizedStatus === 'courier_picked_up' && courier && eta !== null ? (
                  <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-white/50 text-center pointer-events-auto">
                    <p className="text-sm text-gray-500 font-medium">Courier is arriving in</p>
                    <p className="text-xl font-black text-brand-600">{eta} mins</p>
                  </div>
                ) : normalizedStatus === 'delivered' ? (
                  <div className="bg-green-50/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-green-200 text-center pointer-events-auto">
                    <p className="text-green-800 font-bold flex items-center justify-center gap-2">
                      <CheckCircle size={18} /> Order Delivered
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {normalizedStatus === 'delivered' && !(order as any)?.review && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                    <h3 className="text-xl font-bold mb-4 text-gray-900">How was your delivery?</h3>
                    
                    
                    <div className="flex gap-2 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button 
                                key={star} 
                                onClick={() => setRating(star)}
                                className={`text-4xl transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>

                    
                    <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Tell us what you liked or what went wrong..."
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl p-4 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 min-h-[100px] mb-6 resize-none transition-all"
                    />

                    
                    {isCardPayment && (
                        <div className="mb-6">
                            <p className="text-sm font-bold text-gray-700 mb-3">Leave a tip for the courier</p>
                            <div className="flex flex-wrap gap-2">
                                {tipOptions.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setTipAmount(amount)}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                            tipAmount === amount 
                                            ? 'bg-orange-500 text-white shadow-md' 
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                    >
                                        {amount === 0 ? 'Not now' : formatCurrencyUZS(amount)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={submitReview}
                        disabled={isSubmittingReview}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                        {isSubmittingReview ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                </div>
            )}

            {(order as any)?.review && (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 mt-6 text-center font-medium">
                    Thank you! You rated this order {(order as any).review.rating} stars.
                </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="md:col-span-1 space-y-6">
            {/* Render this block if courier state or assignedCourier info exists */}
            {(courier || order.courierName || (order as any).assignedCourier) && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* AVATAR BLOCK WITH STRICT FALLBACK */}
                        <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 text-orange-500 font-bold text-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                            {courier?.photoURL ? (
                                <img 
                                    src={courier.photoURL} 
                                    alt={courier.displayName || (courier as any)?.fullName || 'Courier'} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <span>{(courier?.displayName || (courier as any)?.fullName || order.courierName || assignedCourier?.name || 'C').charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        
                        {/* TEXT INFO BLOCK */}
                        <div className="flex flex-col">
                            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Your Courier</span>
                            <span className="font-bold text-gray-900 text-lg leading-tight">
                                {courier?.displayName || (courier as any)?.fullName || order.courierName || assignedCourier?.name || 'Courier'}
                            </span>
                            <span className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <VehicleIcon size={14} />
                                {getVehicleLabel(vehicleType)}
                                {courier?.licensePlate ? ` - ${courier.licensePlate}` : ''}
                            </span>
                        </div>
                    </div>
                    
                    {/* Optional Call Button */}
                    {(courier?.phone || order.courierPhone || assignedCourier?.phone) && (
                        <a 
                            href={`tel:${courier?.phone || order.courierPhone || assignedCourier?.phone}`} 
                            className="w-10 h-10 bg-gray-50 text-gray-600 rounded-full flex items-center justify-center hover:bg-green-50 hover:text-green-600 transition-colors shrink-0 border border-gray-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        </a>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 pb-4 border-b">Order Summary</h3>
              <div className="space-y-3 mb-6">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700"><span className="font-medium text-gray-900">{item.quantity}x</span> {item.name}</span>
                    <span className="text-gray-900 font-medium">{formatCurrencyUZS(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrencyUZS(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span>{formatCurrencyUZS(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 mt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrencyUZS(order.totalAmount)}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <MapPin size={18} className="text-brand-500" />
                Delivery Address
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{order.deliveryAddress}</p>
            </div>

            {canClientCancelOrder(order.status) && (
              <button 
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-4 rounded-xl border border-red-200 transition-colors shadow-sm disabled:opacity-60"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
