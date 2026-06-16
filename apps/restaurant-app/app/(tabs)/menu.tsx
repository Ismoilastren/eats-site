import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, ActivityIndicator, Dimensions, Modal, Image, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, collection, query, where } from '@repo/firebase-config';
import { db } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useMenuStore } from '../../stores/menuStore';
import { useAuthStore } from '../../stores/authStore';
import MenuItemRow from '../../components/MenuItemRow';
import type { MenuItem } from '@repo/shared-types';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

function normalizeMenuItem(data: any, id: string, restaurantId: string): MenuItem {
  return {
    id,
    restaurantId: String(data.restaurantId || restaurantId),
    name: String(data.name || 'Untitled item'),
    description: String(data.description || ''),
    imageUrl: String(data.imageUrl || ''),
    price: Number(data.price || 0),
    category: String(data.category || data.categoryId || 'General'),
    categoryId: data.categoryId ? String(data.categoryId) : undefined,
    isAvailable: data.isAvailable ?? data.available ?? true,
    sortOrder: Number(data.sortOrder || 0),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export default function MenuScreen() {
  const { menuItems, setMenuItems } = useMenuStore();
  const restaurant = useAuthStore(state => state.restaurant);
  const [loading, setLoading] = React.useState(true);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const formatPrice = (price: any) => {
    return Number(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  useEffect(() => {
    const restaurantId = restaurant?.id;

    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let dishesMenu: MenuItem[] = [];
    let collectionMenu: MenuItem[] = [];
    let docMenu: MenuItem[] = [];

    const updateStore = () => {
      const combined = [...dishesMenu, ...collectionMenu, ...docMenu];
      const uniqueItems = Array.from(new Map(combined.map(item => [item.id, item])).values());
      uniqueItems.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      setMenuItems(uniqueItems);
      setLoading(false);
    };

    // Admin Panel writes the canonical menu here.
    const unsubscribeDishes = onSnapshot(
      collection(db, COLLECTIONS.RESTAURANTS, restaurantId, 'dishes'),
      (snapshot) => {
        dishesMenu = snapshot.docs.map((documentSnapshot) =>
          normalizeMenuItem(documentSnapshot.data(), documentSnapshot.id, restaurantId)
        );
        updateStore();
      },
      () => {
        dishesMenu = [];
        updateStore();
      }
    );

    // Backward-compatible top-level menuItems collection.
    const q = query(collection(db, COLLECTIONS.MENU_ITEMS), where('restaurantId', '==', restaurantId));
    const unsubscribeCollection = onSnapshot(q, (snapshot) => {
      collectionMenu = snapshot.docs.map((documentSnapshot) =>
        normalizeMenuItem(documentSnapshot.data(), documentSnapshot.id, restaurantId)
      );
      updateStore();
    });

    // Legacy document arrays.
    const unsubscribeDoc = onSnapshot(doc(db, COLLECTIONS.RESTAURANTS, restaurantId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const legacyItems = data.menu || data.menuItems || data.items || data.foods || data.dishes || [];
        docMenu = Array.isArray(legacyItems)
          ? legacyItems.map((item: any, index: number) =>
              normalizeMenuItem(item, String(item.id || `legacy-${index}`), restaurantId)
            )
          : [];
      } else {
        docMenu = [];
      }
      updateStore();
    });

    return () => {
      unsubscribeDishes();
      unsubscribeCollection();
      unsubscribeDoc();
    };
  }, [restaurant?.id, setMenuItems]);

  const sections = Array.from(new Set(menuItems.map(item => item.categoryId || item.category || 'General'))).map(category => ({
    title: category,
    data: menuItems.filter(item => (item.categoryId === category) || (item.category === category) || (!item.categoryId && !item.category && category === 'General'))
  })).filter(section => section.data.length > 0);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <View className="px-5 py-4 bg-gray-900/80 flex-row justify-between items-center border-b border-gray-800 shadow-sm z-10">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-orange-500/20 rounded-xl items-center justify-center border border-orange-500/30">
            <Ionicons name="restaurant" size={20} color="#FF6B35" />
          </View>
          <Text className={`font-extrabold text-white ml-3 tracking-wide ${isSmallScreen ? 'text-lg' : 'text-2xl'}`} numberOfLines={1}>
            MENU
          </Text>
        </View>
        <View className="bg-black/50 px-3 py-2 rounded-xl border border-gray-700 flex-row items-center ml-2">
          <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mr-2">Total</Text>
          <Text className="text-white font-black text-sm">{menuItems.length}</Text>
        </View>
      </View>

      {menuItems.length === 0 ? (
        <View className="flex-1 items-center justify-center mt-20 mb-10">
          <View className="w-32 h-32 bg-gray-800/80 rounded-full items-center justify-center mb-6 border border-gray-700/50 shadow-lg">
            <Ionicons name="fast-food" size={64} color="#6B7280" />
          </View>
          <Text className="text-2xl font-black text-white tracking-widest text-center">MENU IS EMPTY</Text>
          <Text className="text-gray-400 mt-3 text-sm font-medium text-center px-8 leading-6">
            Menu items are managed by the Administrator. Items added in the Admin Panel will appear here automatically.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="px-4" 
              activeOpacity={0.7} 
              onPress={() => setSelectedItem(item as MenuItem)}
            >
               <MenuItemRow item={item as MenuItem} />
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section: { title, data } }) => (
            <View className="py-3 bg-gray-900/60 mt-4 mb-2 flex-row justify-between items-center px-5 border-b border-gray-800/50 backdrop-blur-md">
              <Text className="font-extrabold text-lg text-white uppercase tracking-widest">{title}</Text>
              <Text className="text-orange-500/80 text-xs font-bold tracking-wider">{data.length} ITEMS</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Premium Detail Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
        presentationStyle="pageSheet"
        visible={!!selectedItem}
      >
        <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['top']}>
            <View className="px-4 py-3 border-b border-white/10 flex-row items-center justify-between z-10">
                <TouchableOpacity 
                    onPress={() => setSelectedItem(null)}
                    className="flex-row items-center bg-white/10 px-4 py-2 rounded-full active:bg-white/20"
                >
                    <Ionicons color="#f97316" name="arrow-back" size={20}/>
                    <Text className="text-orange-500 font-bold ml-2">Back to Menu</Text>
                </TouchableOpacity>
            </View>

            {selectedItem && (
                <ScrollView bounces={false} className="flex-1">
                    <View className="w-full h-64 bg-gray-800">
                        <Image 
                            source={{ uri: selectedItem.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image' }}
                            className="w-full h-full" 
                            resizeMode="cover" 
                        />
                        <View className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg backdrop-blur-md">
                            <Text className="text-white font-bold tracking-widest uppercase text-xs">
                                {selectedItem.category || selectedItem.categoryId || 'Food Item'}
                            </Text>
                        </View>
                    </View>

                    <View className="p-6">
                        <View className="flex-row justify-between items-start mb-4">
                            <Text className="text-3xl font-extrabold text-white flex-1 mr-4">
                                {selectedItem.name}
                            </Text>
                            <Text className="text-2xl font-black text-orange-500">
                                {formatPrice(selectedItem.price)} UZS
                            </Text>
                        </View>

                        <View className="h-[1px] w-full bg-white/10 my-4"/>

                        <Text className="text-gray-400 text-base leading-relaxed">
                            {selectedItem.description || 'No description provided by the administrator.'}
                        </Text>

                        <View className="mt-10 bg-white/5 p-4 rounded-xl border border-white/10 flex-row items-center">
                            <Ionicons color="#94a3b8" name="information-circle-outline" size={24}/>
                            <Text className="text-slate-400 text-xs ml-3 flex-1 leading-5">
                                This item is managed by the Admin Panel. You cannot edit it from the Kitchen Display.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
