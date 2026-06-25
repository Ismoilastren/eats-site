'use client';

import { use, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, doc, onSnapshot, updateDoc, collection, getDocs, getDoc, serverTimestamp, increment } from "@repo/firebase-config";
import {
  COLLECTIONS,
  Order,
  OrderStatus,
  formatCurrencyUZS,
  formatFirestoreDate,
  formatOrderCode,
  getVehicleLabel,
  normalizeOrderStatus,
  normalizeVehicleType,
} from "@repo/shared-types";
import { ArrowLeft, Package, User, MapPin, CreditCard, Clock, Truck, Bike, Car, Footprints } from "lucide-react";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import {
  getCourierId,
  getCourierName,
  getCourierPhone,
  getCourierVehicle,
  getCourierInvalidReason,
  isAssignableCourier,
  isRealCourier,
  sortCouriers,
  type AdminCourierRecord,
} from "@/lib/courierFilters";

const LiveTrackingMap = dynamic(() => import("@/components/LiveTrackingMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">Loading Map...</div>
});

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  
  const urlParams = useParams();
  const currentOrderId = (urlParams?.id as string) || resolvedParams.id;
  const orderId = currentOrderId;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [couriers, setCouriers] = useState<AdminCourierRecord[]>([]);
  const [currentCourier, setCurrentCourier] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!urlParams?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'orders', urlParams.id as string), (docSnap) => {
        if (docSnap.exists()) {
            setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        } else {
            toast.error("Order not found");
            router.push('/orders');
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching order:", error);
        toast.error("Failed to load order details");
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [urlParams?.id, router]);

  // Real-time listener for the canonical assigned courier.
  useEffect(() => {
    const assignedCourier = order?.assignedCourier as Partial<AdminCourierRecord> | null | undefined;
    const assignedCourierId = isRealCourier(assignedCourier) ? assignedCourier?.id || null : null;
    if (assignedCourierId && normalizeOrderStatus(order?.status) !== 'cancelled') {
      const unsubscribeCourier = onSnapshot(doc(db, COLLECTIONS.COURIERS, assignedCourierId), (docSnap) => {
        if (docSnap.exists()) {
          setCurrentCourier({ id: docSnap.id, ...docSnap.data() });
        }
      });
      return () => unsubscribeCourier();
    } else {
      setCurrentCourier(null);
    }
  }, [order?.assignedCourier, order?.status]);

  // Fetch real courier documents for assignment. User-role fallback is intentionally not used here.
  useEffect(() => {
    const fetchCouriers = async () => {
      try {
        const courierSnapshot = await getDocs(collection(db, COLLECTIONS.COURIERS));
        setCouriers(courierSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() } as AdminCourierRecord))
          .sort(sortCouriers));
      } catch (error) {
        console.error("Error fetching couriers:", error);
        toast.error("Failed to load couriers list");
      }
    };

    fetchCouriers();
  }, []);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;

    const currentStatus = normalizeOrderStatus(order.status);
    const nextStatus = normalizeOrderStatus(newStatus);
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['accepted', 'cancelled', 'rejected'],
      accepted: ['preparing', 'cancelled'],
      preparing: ['ready_for_pickup', 'cancelled'],
      ready_for_pickup: ['picked_up', 'cancelled'],
      picked_up: ['on_the_way', 'cancelled'],
      on_the_way: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
      rejected: [],
    };

    if (nextStatus === currentStatus) return;

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      toast.error(`Invalid transition: ${currentStatus.replace(/_/g, ' ')} -> ${nextStatus.replace(/_/g, ' ')}`);
      return;
    }

    const activeAssignedCourier = isRealCourier(order.assignedCourier as Partial<AdminCourierRecord> | null)
      ? order.assignedCourier
      : null;

    if (['picked_up', 'on_the_way', 'delivered'].includes(nextStatus) && !activeAssignedCourier?.id) {
      toast.error("Action blocked: assign a courier before handoff or delivery.");
      return;
    }

    setIsUpdating(true);
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);

      const updateData: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };

      if (nextStatus === 'delivered') {
        updateData.deliveredAt = serverTimestamp();
      }

      if (nextStatus === 'cancelled') {
        const reasons = [
          "High demand: Courier unavailable",
          "Restaurant out of stock",
          "Customer requested cancellation",
          "Delivery address unreachable"
        ];
        const randomReason = reasons[Math.floor(Math.random() * reasons.length)];

        updateData.cancelledAt = serverTimestamp();
        updateData.cancelReason = randomReason;

        const paymentType = (order as any).paymentMethod?.type;
        const isCard = paymentType === 'CARD' || paymentType === 'SAVED_CARD' || paymentType === 'Card' || paymentType === 'Saved Card';
        const customerId = (order as any).customerId || (order as any).customer?.uid || (order as any).customerUid;

        if (isCard && customerId) {
          const userRef = doc(db, COLLECTIONS.USERS, customerId);
          // Atomic update to customer's wallet balance
          await updateDoc(userRef, {
            walletBalance: increment(Number(order.totalAmount || 0) + 10000)
          }).catch(err => console.error("Refund failed", err));

          updateData.refundStatus = "Refunded + 10,000 UZS Bonus";
        }
      }

      await updateDoc(orderRef, updateData);
      const assignedCourierId = activeAssignedCourier?.id || null;
      if (
        assignedCourierId &&
        ['delivered', 'cancelled'].includes(nextStatus)
      ) {
        await updateDoc(doc(db, COLLECTIONS.COURIERS, assignedCourierId), {
          currentOrderId: null,
          status: 'online',
          isOnline: true,
          isAvailable: true,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
      toast.success(`Status updated to ${nextStatus.replace(/_/g, ' ')}`);
    } catch (error) {
      console.error("Status Update Error:", error);
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignCourier = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courierId = e.target.value;
    if (!courierId || !order?.id) return;

    try {
        const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);
        const courierSnap = await getDoc(courierRef);
        const cData = courierSnap.exists()
          ? ({ id: courierSnap.id, uid: courierSnap.id, ...courierSnap.data() } as AdminCourierRecord)
          : null;

        if (!isAssignableCourier(cData)) {
          toast.error("This courier is not assignable. Choose an online available courier.");
          return;
        }

        const name = getCourierName(cData);
        const phone = getCourierPhone(cData);
        const { vehicle, vehicleType } = getCourierVehicle(cData);

        await updateDoc(doc(db, COLLECTIONS.ORDERS, order.id), {
            courierId,
            courierName: name,
            courierPhone: phone,
            assignedCourier: {
                id: courierId,
                name,
                phone,
                vehicle,
                vehicleType,
            },
            courier: {
                uid: courierId,
                id: courierId,
                name,
                phone,
                vehicle,
                vehicleType,
            },
            updatedAt: serverTimestamp(),
        });

        if (courierSnap.exists()) {
          await updateDoc(courierRef, {
            currentOrderId: order.id,
            status: 'busy',
            isOnline: true,
            isAvailable: false,
            lastSeenAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        toast.success("Courier Assigned!");
    } catch (err) {
        console.error("ASSIGNMENT ERROR:", err);
        toast.error("Failed to assign courier.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'preparing': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ready_for_pickup': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'picked_up': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'on_the_way': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!order) return null;

  const orderDate = formatFirestoreDate(order.createdAt, "Unknown Date");
  const normalizedStatus = normalizeOrderStatus(order.status);
  const rawAssignedCourier = order.assignedCourier as Partial<AdminCourierRecord> | null;
  const invalidAssignedCourierReason = rawAssignedCourier && !isRealCourier(rawAssignedCourier)
    ? getCourierInvalidReason(rawAssignedCourier)
    : '';
  const assignedCourier = invalidAssignedCourierReason ? null : order.assignedCourier || null;
  const assignedCourierId = assignedCourier?.id || null;
  const courierVehicleType = normalizeVehicleType(assignedCourier?.vehicleType || assignedCourier?.vehicle || currentCourier?.vehicleType);
  const courierVehicleDetails = getCourierVehicle({
    ...(currentCourier || {}),
    ...(assignedCourier || {}),
  } as Partial<AdminCourierRecord>);
  const CourierVehicleIcon =
    courierVehicleType === 'car' ? Car :
    courierVehicleType === 'foot' ? Footprints :
    courierVehicleType === 'bicycle' ? Bike :
    Truck;
  const trackedCourierLocation = assignedCourierId
    ? (order.courierLocation || currentCourier?.currentLocation)
    : undefined;
  const assignableCouriers = couriers.filter(isAssignableCourier);
  const orderBrandName = String(order.brandName || order.restaurantName || 'Restaurant').trim();
  const orderBranchName = String(order.branchName || 'Main branch').trim();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Area */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.push('/orders')}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Order Details 
            <span className="text-brand-600 text-xl font-black font-mono bg-brand-50 px-3 py-1 rounded-lg border border-brand-200 tracking-wider">{formatOrderCode(order.id)}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Clock size={14} /> {isMounted ? orderDate : 'Loading...'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Tracking Map, Order Items & Customer Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-gray-800 dark:text-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b dark:border-gray-700">
              <MapPin className="text-brand-500" size={20} /> Restaurant Branch
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Brand</p>
                <p className="font-bold text-gray-900 dark:text-white">{orderBrandName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Branch / Filial</p>
                <p className="font-bold text-gray-900 dark:text-white">{orderBranchName}</p>
              </div>
              <div className="md:col-span-1">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Pickup Address</p>
                <p className="font-medium text-gray-900 dark:text-white">{order.restaurantAddress || 'Restaurant address missing'}</p>
              </div>
            </div>
          </div>
          
          {/* Tracking Map */}
          <div className="w-full h-80 md:h-96 rounded-xl overflow-hidden relative z-0 border border-gray-200 dark:border-gray-700">
            <LiveTrackingMap 
              restaurantLocation={order.restaurantLocation}
              customerLocation={order.deliveryLocation}
              courierLocation={trackedCourierLocation}
            />
          </div>

          {/* Order Items */}
          <div className="bg-white dark:bg-gray-800 dark:text-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b dark:border-gray-700">
              <Package className="text-brand-500" size={20} /> Order Items
            </h2>
            
            <div className="space-y-4">
              {order.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg w-12 h-12 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                      x{item.quantity}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                      {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Note: {item.notes}</p>}
                    </div>
                  </div>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {formatCurrencyUZS(Number(item.price || 0) * Number(item.quantity || 1))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Totals */}
            <div className="border-t border-gray-100 dark:border-gray-700 mt-6 pt-4 space-y-3">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrencyUZS(order.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Delivery Fee</span>
                <span className="font-medium">{formatCurrencyUZS(order.deliveryFee || 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-700">
                <span>Total</span>
                <span>{formatCurrencyUZS(order.totalAmount || 0)}</span>
              </div>
              
              {(order as any)?.tipAmount > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2 text-green-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          <span className="font-bold text-sm uppercase tracking-wider">Courier Tip</span>
                      </div>
                      <span className="text-green-400 font-bold text-lg">
                          +{formatCurrencyUZS((order as any).tipAmount)}
                      </span>
                  </div>
              )}
            </div>
          </div>

          {/* Customer & Delivery Info */}
          <div className="bg-white dark:bg-gray-800 dark:text-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b dark:border-gray-700">
              <User className="text-brand-500" size={20} /> Customer Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{order.customerName || 'Unknown Customer'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Phone</p>
                <p className="font-medium text-gray-900 dark:text-white">{order.customerPhone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Email</p>
                <p className="font-medium text-gray-900 dark:text-white truncate" title={(order as any).customer?.email || (order as any).customerEmail || 'No email provided'}>
                  {(order as any).customer?.email || (order as any).customerEmail || 'Email missing'}
                </p>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                    <MapPin size={14} /> Delivery Address
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                    {order.deliveryAddress || 'No address specified'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Delivery Instructions</p>
                  <p className="font-medium text-gray-900 dark:text-white bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl border border-yellow-100 dark:border-yellow-800/50 italic">
                    {(order as any).deliveryInstructions || (order as any).customerComment || (order as any).adminComment || 'No instructions provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Order Actions (Mutation Logic) */}
        <div className="space-y-6">
          
          {/* Status Management */}
          <div className="bg-white dark:bg-gray-800 dark:text-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 pb-4 border-b dark:border-gray-700">Order Status</h3>
            
            <div className="mb-6">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                {normalizedStatus.replace(/_/g, ' ')}
              </div>
            </div>
            
            {normalizedStatus === 'delivered' ? (
              <div className="px-4 py-2 rounded bg-green-500/20 text-green-500 font-bold text-sm flex items-center gap-2">
                ✓ Successfully Delivered
              </div>
            ) : (
              <>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Update Status</label>
                <select
                  value={normalizedStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  disabled={isUpdating}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready_for_pickup">Ready for Pickup</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="on_the_way">On the Way</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </>
            )}
          </div>

          {/* Courier Assignment */}
          <div className="bg-[#1a1f2c] rounded-2xl p-6 border border-gray-800/60 shadow-lg">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Truck size={20} className="text-blue-400" /> Assign Courier
              </h3>
              
              {assignedCourierId ? (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                            <CourierVehicleIcon size={22} className="text-blue-300" />
                          </div>
                          <div>
                          <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Active Courier</p>
                          <p className="text-white font-bold text-lg">{assignedCourier?.name || order?.courierName || 'Courier'}</p>
                          <p className="text-gray-400 text-sm">
                            {[assignedCourier?.phone || order?.courierPhone, courierVehicleDetails.vehicle || getVehicleLabel(courierVehicleType)].filter(Boolean).join(' - ')}
                          </p>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col gap-3">
                      {invalidAssignedCourierReason ? (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                          Existing assigned courier snapshot is hidden because it is {invalidAssignedCourierReason}. Assign a real online courier when one is available.
                        </div>
                      ) : null}
                      <p className="text-sm text-gray-400">No courier accepted this yet. Manually assign one below:</p>
                      {assignableCouriers.length === 0 ? (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-200">
                          No online available couriers found. Offline, busy, disabled, archived, or test couriers are hidden from assignment.
                        </div>
                      ) : (
                      <div className="flex gap-2">
                          <select 
                              id="courier-select"
                              className="flex-1 bg-gray-800/50 border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
                              onChange={handleAssignCourier}
                              value=""
                          >
                              <option value="" disabled>Select a courier...</option>
                              {assignableCouriers.map((c) => (
                                  <option key={getCourierId(c)} value={getCourierId(c)}>{getCourierName(c)}</option>
                              ))}
                          </select>
                      </div>
                      )}
                  </div>
              )}
          </div>

          {/* Customer Feedback */}
          {(order as any)?.review && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-5 rounded-2xl border border-gray-700 shadow-lg">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Feedback</h3>
                  <div className="flex items-center gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                          <svg key={i} className={`w-5 h-5 ${i < (order as any).review.rating ? 'text-yellow-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                      ))}
                      <span className="text-white font-bold ml-2">{(order as any).review.rating}/5</span>
                  </div>
                  {(order as any).review.comment ? (
                      <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-700/50">
                          <p className="text-gray-300 text-sm italic">"{(order as any).review.comment}"</p>
                      </div>
                  ) : (
                      <p className="text-gray-500 text-sm">No written comment provided.</p>
                  )}
              </div>
          )}

          {/* Payment Info */}
          <div className="bg-white dark:bg-gray-800 dark:text-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 pb-4 border-b dark:border-gray-700 flex items-center gap-2">
              <CreditCard className="text-brand-500" size={20} /> Payment Method
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CreditCard size={24} />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-bold text-gray-900 dark:text-white uppercase truncate">
                  {(order as any).paymentMethod?.type === 'CARD' 
                    ? `${(order as any).paymentMethod?.brand || 'Card'} •••• ${(order as any).paymentMethod?.last4 || '0000'}` 
                    : 'Cash on Delivery'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(order as any).paymentMethod?.type === 'CARD' ? 'Paid via App' : 'Pay on Delivery'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
