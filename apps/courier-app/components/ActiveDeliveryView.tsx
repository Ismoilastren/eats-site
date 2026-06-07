// =============================================
// ACTIVE DELIVERY VIEW — Delivery with status controls
// =============================================
import React from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Order, OrderStatus } from '@repo/shared-types';
import {
  ORDER_STATUS_LABELS,
  formatCurrencyUZS,
  getVehicleLabel,
  normalizeCoordinate,
  normalizeOrderStatus,
  normalizeVehicleType,
} from '@repo/shared-types';

interface ActiveDeliveryViewProps {
  order: Order;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onCompleteDelivery: (orderId: string) => void;
  isUpdating?: boolean;
}

function getStatusStep(status: OrderStatus): number {
  switch (status) {
    case 'courier_picked_up':
      return 2;
    case 'delivered':
      return 3;
    case 'preparing':
    case 'pending':
      return 1;
    default:
      return 0;
  }
}

function getNextAction(
  status: OrderStatus
): { label: string; nextStatus: OrderStatus; icon: string } | null {
  switch (status) {
    case 'courier_picked_up':
      return {
        label: 'Mark as Delivered',
        nextStatus: 'delivered',
        icon: 'checkmark-circle-outline',
      };
    default:
      return null;
  }
}

function getVehicleIcon(vehicle?: string | null): keyof typeof Ionicons.glyphMap {
  switch (normalizeVehicleType(vehicle)) {
    case 'car':
      return 'car-outline';
    case 'foot':
      return 'walk-outline';
    case 'motorcycle':
    case 'bicycle':
    default:
      return 'bicycle-outline';
  }
}

export default function ActiveDeliveryView({
  order,
  onUpdateStatus,
  onCompleteDelivery,
  isUpdating,
}: ActiveDeliveryViewProps) {
  const normalizedStatus = normalizeOrderStatus(order.status);
  const currentStep = getStatusStep(normalizedStatus);
  const nextAction = getNextAction(normalizedStatus);
  const vehicleType = normalizeVehicleType(
    order.assignedCourier?.vehicleType ||
    order.assignedCourier?.vehicle ||
    order.courier?.vehicleType ||
    order.courier?.vehicle
  );
  const restaurantLocation = normalizeCoordinate(order.restaurantLocation) || normalizeCoordinate(order.deliveryLocation);

  const handleCallCustomer = () => {
    if (order.customerPhone) {
      Linking.openURL(`tel:${order.customerPhone}`);
    } else {
      Alert.alert('No Phone', 'Customer phone number not available.');
    }
  };

  const handleNavigate = (latitude: number, longitude: number, label: string) => {
    const url = `https://maps.google.com/?daddr=${latitude},${longitude}&label=${encodeURIComponent(label)}`;
    Linking.openURL(url);
  };

  const handleStatusUpdate = () => {
    if (!nextAction) return;

    if (nextAction.nextStatus === 'delivered') {
      Alert.alert(
        'Confirm Delivery',
        'Are you sure the order has been delivered to the customer?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Delivered',
            onPress: () => onCompleteDelivery(order.id),
          },
        ]
      );
    } else {
      onUpdateStatus(order.id, nextAction.nextStatus);
    }
  };

  const steps = [
    { label: 'Picked Up', icon: 'restaurant-outline' as const },
    { label: 'On the Way', icon: 'car-outline' as const },
    { label: 'Delivered', icon: 'checkmark-done-outline' as const },
  ];

  const isWaitingForKitchen = ['pending', 'preparing'].includes(normalizedStatus);

  return (
    <View className="flex-1 pb-10">
      {/* Dynamic Header Block */}
      <View className="h-48 items-center justify-center bg-white/5 border-b border-white/10">
        <Ionicons name={isWaitingForKitchen ? "restaurant-outline" : getVehicleIcon(vehicleType)} size={48} color={isWaitingForKitchen ? "#f97316" : "#22c55e"} />
        {isWaitingForKitchen ? (
          <Text className="mt-2 text-lg font-black text-orange-500 text-center px-4">
            Waiting for Kitchen... Go to Restaurant.
          </Text>
        ) : (
          <Text className="mt-2 text-sm font-bold text-green-400">
            Live GPS Active - {getVehicleLabel(vehicleType)}
          </Text>
        )}
        
        <View className="mt-4 flex-row gap-2">
          {isWaitingForKitchen && (
            <Pressable
              onPress={() =>
                handleNavigate(
                  restaurantLocation?.latitude ?? 0,
                  restaurantLocation?.longitude ?? 0,
                  'Restaurant'
                )
              }
              className="flex-row items-center rounded-full bg-orange-500/20 border border-orange-500/30 px-6 py-3"
            >
              <Ionicons name="navigate" size={16} color="#f97316" />
              <Text className="ml-2 text-sm font-black text-orange-500 tracking-wider uppercase">
                Navigate to Restaurant
              </Text>
            </Pressable>
          )}
          {normalizedStatus === 'courier_picked_up' && (
            <Pressable
              onPress={() =>
                handleNavigate(
                  order.deliveryLocation?.latitude ?? 0,
                  order.deliveryLocation?.longitude ?? 0,
                  'Customer'
                )
              }
              className="flex-row items-center rounded-full bg-green-500/20 border border-green-500/30 px-6 py-3"
            >
              <Ionicons name="navigate" size={16} color="#22c55e" />
              <Text className="ml-2 text-sm font-black text-green-500 tracking-wider uppercase">
                Navigate to Customer
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Progress Steps */}
      <View className="flex-row items-center justify-center gap-0 bg-[#0f172a] px-6 py-6 border-b border-white/5">
        {steps.map((step, index) => (
          <React.Fragment key={step.label}>
            <View className="items-center">
              <View
                className={`h-12 w-12 items-center justify-center rounded-full ${
                  index < currentStep
                    ? 'bg-orange-500'
                    : index === currentStep
                    ? 'bg-orange-500/20 border border-orange-500/50'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                <Ionicons
                  name={step.icon}
                  size={20}
                  color={index < currentStep ? '#fff' : index === currentStep ? '#f97316' : '#6b7280'}
                />
              </View>
              <Text
                className={`mt-2 text-xs font-bold ${
                  index <= currentStep ? 'text-orange-500' : 'text-gray-500'
                }`}
              >
                {step.label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                className={`mx-2 h-0.5 flex-1 ${
                  index < currentStep ? 'bg-orange-500' : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Order Details Card */}
      <View className="mx-4 mt-6 rounded-3xl bg-white/5 border border-white/10 p-5 shadow-sm">
        <View className="mb-4 flex-row items-center justify-between border-b border-white/10 pb-4">
          <Text className="text-xl font-black text-white">ORDER DETAILS</Text>
          <View className="rounded-full bg-white/10 border border-white/20 px-3 py-1">
            <Text className="text-xs font-black tracking-widest text-gray-300 uppercase">
              {ORDER_STATUS_LABELS[normalizedStatus] || normalizedStatus}
            </Text>
          </View>
        </View>

        {/* Restaurant */}
        <View className="mb-4 flex-row items-start">
          <View className="mt-1 h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 border border-orange-500/30">
            <Ionicons name="restaurant" size={20} color="#f97316" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Pickup from
            </Text>
            <Text className="mt-1 text-lg font-bold text-white">
              {order.restaurantName || 'Restaurant'}
            </Text>
          </View>
        </View>

        {/* Customer */}
        <View className="mb-5 flex-row items-start">
          <View className="mt-1 h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
            <Ionicons name="person" size={20} color="#3b82f6" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Deliver to
            </Text>
            <Text className="mt-1 text-lg font-bold text-white">
              {order.customerName || 'Customer'}
            </Text>
            <Text className="mt-1 text-base text-gray-400 font-medium" numberOfLines={2}>
              {order.deliveryAddress || 'No address provided'}
            </Text>
          </View>
        </View>

        {/* Contact Row */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleCallCustomer}
            className="flex-1 flex-row items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-500/30 py-4 active:bg-blue-500/30"
          >
            <Ionicons name="call" size={20} color="#60a5fa" />
            <Text className="ml-2 text-base font-black text-blue-400 uppercase tracking-wider">
              Call Customer
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Order Items Summary */}
      <View className="mx-4 mt-4 rounded-3xl bg-white/5 border border-white/10 p-5 shadow-sm">
        <Text className="mb-4 text-sm font-black uppercase tracking-widest text-gray-500">
          Items ({order.items?.length ?? 0})
        </Text>
        {order.items?.map((item, index) => (
          <View
            key={item.id || index}
            className={`flex-row items-center justify-between py-3 ${
              index < (order.items?.length ?? 0) - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <View className="flex-1 flex-row items-center">
              <View className="w-8 h-8 rounded-lg bg-orange-500/20 items-center justify-center mr-3 border border-orange-500/30">
                <Text className="text-sm font-black text-orange-500">
                  {item.quantity || 1}x
                </Text>
              </View>
              <Text className="text-base font-bold text-gray-300" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          </View>
        ))}
        <View className="mt-4 flex-row items-center justify-between border-t border-white/10 pt-4">
          <Text className="text-sm font-black uppercase tracking-widest text-gray-500">Earnings</Text>
          <Text className="text-2xl font-black text-green-400">
            {formatCurrencyUZS(order.deliveryFee)}
          </Text>
        </View>
      </View>

      {/* Action Button */}
      {nextAction && (
        <View className="px-4 pb-10 pt-6">
          <Pressable
            onPress={handleStatusUpdate}
            disabled={isUpdating}
            className={`flex-row items-center justify-center rounded-2xl py-5 ${
              nextAction.nextStatus === 'delivered'
                ? isUpdating
                  ? 'bg-green-600/50'
                  : 'bg-green-500'
                : isUpdating
                ? 'bg-orange-600/50'
                : 'bg-orange-500'
            }`}
          >
            <Ionicons
              name={nextAction.icon as keyof typeof Ionicons.glyphMap}
              size={26}
              color="white"
            />
            <Text className="ml-3 text-xl font-black text-white uppercase tracking-widest">
              {isUpdating ? 'UPDATING...' : nextAction.label}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
