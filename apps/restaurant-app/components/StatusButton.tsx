import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { db, doc, updateDoc, serverTimestamp } from '@repo/firebase-config';
import { COLLECTIONS, Order } from '@repo/shared-types';
import { useOrderStore } from '../stores/orderStore';

interface StatusButtonProps {
  order: Order;
}

export default function StatusButton({ order }: StatusButtonProps) {
  const { updateOrderStatus } = useOrderStore();
  const [loading, setLoading] = React.useState(false);

  const getButtonConfig = () => {
    switch (order.status) {
      case 'pending':
        return { text: 'Accept Order', bg: 'bg-violet-500', nextStatus: 'accepted' as const };
      case 'accepted':
        return { text: 'Start Preparing', bg: 'bg-amber-500', nextStatus: 'preparing' as const };
      case 'preparing':
        return {
          text: 'Ready for Pickup',
          bg: 'bg-emerald-500',
          nextStatus: 'ready_for_pickup' as const,
        };
      default:
        return null;
    }
  };

  const config = getButtonConfig();
  if (!config) return null;

  const handlePress = async () => {
    try {
      setLoading(true);
      const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
      await updateDoc(orderRef, {
        status: config.nextStatus,
        updatedAt: serverTimestamp(),
      });
      updateOrderStatus(order.id, config.nextStatus);
    } catch (e) {
      console.error('Error updating order status:', e);
      Alert.alert('Update Failed', 'Could not update this order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      className={`${config.bg} py-3 px-4 rounded-xl flex-row justify-center items-center`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-white font-bold text-center">{config.text}</Text>
      )}
    </TouchableOpacity>
  );
}
