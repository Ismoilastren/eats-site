'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, setDoc, addDoc } from '@repo/firebase-config';
import { COLLECTIONS, Restaurant, MenuItem, isReadableAddress } from '@repo/shared-types';
import toast from 'react-hot-toast';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { buildDishPayload, buildRestaurantPayload, deriveRestaurantBrandBranch } from '@/lib/marketplaceSchema';
import {
  compressImageFile,
  extractRestaurantLocation,
  loadCatalogCategoryOptions,
  loadRestaurantTypeOptions,
  validateRestaurantImage,
  type CatalogCategoryOption,
  type RestaurantLocationValue,
  type RestaurantTypeOption,
} from '@/lib/restaurantAdmin';
import { RestaurantImageUploader } from '@/components/restaurants/RestaurantImageUploader';
import { RestaurantLocationPicker } from '@/components/restaurants/RestaurantLocationPicker';
import { RestaurantTypeSelect } from '@/components/restaurants/RestaurantTypeSelect';

export default function EditRestaurantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [restaurantTypes, setRestaurantTypes] = useState<RestaurantTypeOption[]>([]);
  const [menuCategories, setMenuCategories] = useState<CatalogCategoryOption[]>([]);
  const [isLoadingMenuCategories, setIsLoadingMenuCategories] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [location, setLocation] = useState<RestaurantLocationValue>({
    address: '',
    lat: 41.311081,
    lng: 69.240562,
    source: 'manual',
    coordinatesConfirmed: false,
  });
  
  const [formData, setFormData] = useState({
    brandName: '',
    branchName: '',
    name: '',
    restaurantType: '',
    description: '',
    imageUrl: '',
    phone: '',
    workingHours: '09:00-23:00',
    deliveryTime: '30',
    deliveryFee: '0',
    serviceFee: '0',
    minOrder: '0',
    isActive: true,
  });

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentManagerEmail, setCurrentManagerEmail] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [isCreatingManager, setIsCreatingManager] = useState(false);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [newMenuImageFile, setNewMenuImageFile] = useState<File | null>(null);
  const [newMenuImageError, setNewMenuImageError] = useState('');
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    imageUrl: '',
    isAvailable: true,
  });
  const [newMenuCategoryName, setNewMenuCategoryName] = useState('');

  const menuCategoryOptions = React.useMemo(() => {
    const names = new Set<string>();
    menuCategories.forEach((category) => names.add(category.name));
    menuItems.forEach((item) => {
      if (item.category) names.add(item.category);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [menuCategories, menuItems]);

  const menuImagePreviewUrl = React.useMemo(
    () => (newMenuImageFile ? URL.createObjectURL(newMenuImageFile) : newMenuItem.imageUrl),
    [newMenuImageFile, newMenuItem.imageUrl],
  );

  useEffect(() => {
    return () => {
      if (menuImagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(menuImagePreviewUrl);
    };
  }, [menuImagePreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    loadRestaurantTypeOptions()
      .then((options) => {
        if (!cancelled) setRestaurantTypes(options);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load restaurant types');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTypes(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMenuCategories = React.useCallback(async () => {
    setIsLoadingMenuCategories(true);
    try {
      setMenuCategories(await loadCatalogCategoryOptions());
    } catch {
      toast.error('Failed to load menu categories');
    } finally {
      setIsLoadingMenuCategories(false);
    }
  }, []);

  useEffect(() => {
    void refreshMenuCategories();
  }, [refreshMenuCategories]);

  useEffect(() => {
    if (isMenuModalOpen) void refreshMenuCategories();
  }, [isMenuModalOpen, refreshMenuCategories]);

  useEffect(() => {
    if (!id) return;
    
    const fetchRestaurant = async () => {
      try {
        const docRef = doc(db, COLLECTIONS.RESTAURANTS, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Restaurant;
          const raw = data as any;
          const existingLocation = extractRestaurantLocation(raw);
          const branch = deriveRestaurantBrandBranch({
            id,
            name: data.name,
            brandId: raw.brandId,
            brandName: raw.brandName,
            branchId: raw.branchId,
            branchName: raw.branchName,
          });
          setLocation(existingLocation);
          setFormData({
            brandName: branch.brandName,
            branchName: branch.branchName,
            name: data.name || '',
            restaurantType: Array.isArray(raw.cuisines) ? raw.cuisines[0] || '' : data.cuisine || raw.category || '',
            description: data.description || '',
            imageUrl: data.imageUrl || raw.coverImageUrl || '',
            phone: raw.phone || '',
            workingHours: raw.workingHours || '09:00-23:00',
            deliveryTime: String(raw.avgDeliveryTime || raw.deliveryTime || 30),
            deliveryFee: String(raw.deliveryFee || 0),
            serviceFee: String(raw.serviceFee || raw.platformFee || 0),
            minOrder: String(raw.minOrder || raw.minOrderAmount || 0),
            isActive: raw.isActive !== false && raw.status !== 'inactive',
          });
          
          if (data.ownerId) {
            setOwnerId(data.ownerId);
            // Fetch the user's email
            const userRef = doc(db, COLLECTIONS.USERS, data.ownerId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              setCurrentManagerEmail(userSnap.data().email || '');
            }
          }

          // Fetch Menu Items
          const menuData: MenuItem[] = [];
          const dishesSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS, id, 'dishes'));
          dishesSnap.forEach((d) => {
            menuData.push({ id: d.id, ...d.data() } as MenuItem);
          });
          if (menuData.length === 0) {
            const menuQuery = query(
              collection(db, COLLECTIONS.MENU_ITEMS),
              where('restaurantId', '==', id)
            );
            const menuSnap = await getDocs(menuQuery);
            menuSnap.forEach((d) => {
              menuData.push({ id: d.id, ...d.data() } as MenuItem);
            });
          }
          setMenuItems(menuData.sort((a, b) => a.sortOrder - b.sortOrder));
        } else {
          toast.error("Restaurant not found");
          router.push('/restaurants');
        }
      } catch (error) {
        console.error("Error fetching restaurant:", error);
        toast.error("Failed to load restaurant details");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRestaurant();
  }, [id, router]);

  const setRestaurantImage = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImageError('');
      return;
    }

    const validationError = validateRestaurantImage(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    setImageFile(file);
    setImageError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandName.trim() || !formData.branchName.trim() || !formData.name.trim() || !formData.restaurantType.trim() || !isReadableAddress(location.address)) {
      toast.error('Brand, branch, display name, restaurant type, and readable location are required.');
      return;
    }

    setIsSaving(true);
    toast.loading('Saving changes...', { id: 'edit-restaurant' });

    try {
      let finalImageUrl = formData.imageUrl;
      if (imageFile) {
        finalImageUrl = await compressImageFile(imageFile);
      }

      const updates = buildRestaurantPayload({
        id,
        name: formData.name.trim(),
        brandName: formData.brandName.trim(),
        branchName: formData.branchName.trim(),
        cuisine: formData.restaurantType.trim(),
        address: location.address.trim(),
        description: formData.description.trim(),
        imageUrl: finalImageUrl,
        phone: formData.phone.trim(),
        workingHours: formData.workingHours.trim(),
        deliveryTime: Number(formData.deliveryTime || 30),
        deliveryFee: Number(formData.deliveryFee || 0),
        serviceFee: Number(formData.serviceFee || 0),
        minOrder: Number(formData.minOrder || 0),
        isActive: formData.isActive,
        location: {
          address: location.address.trim(),
          lat: location.lat,
          lng: location.lng,
          source: location.source,
          coordinatesConfirmed: location.coordinatesConfirmed,
        },
      });

      const docRef = doc(db, COLLECTIONS.RESTAURANTS, id);
      await setDoc(docRef, updates, { merge: true });

      toast.success('Restaurant updated successfully!', { id: 'edit-restaurant' });
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to update restaurant: ' + error.message, { id: 'edit-restaurant' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateManager = async () => {
    if (!managerEmail || !managerPassword) {
      toast.error('Email and password required');
      return;
    }

    setIsCreatingManager(true);
    const toastId = toast.loading('Creating manager account...');

    try {
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const tempAppName = 'TempApp_' + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, tempAppName);
      const secondaryAuth = getAuth(secondaryApp);

      let uid = '';
      try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, managerEmail, managerPassword);
        uid = userCred.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // If already exists, just sign in to get the UID
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          const existingCred = await signInWithEmailAndPassword(secondaryAuth, managerEmail, managerPassword);
          uid = existingCred.user.uid;
        } else {
          throw authError; // Rethrow if it's a different error
        }
      }

      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        email: managerEmail,
        name: `${formData.name} Manager`,
        role: 'restaurant',
        createdAt: new Date()
      }, { merge: true });

      await updateDoc(doc(db, COLLECTIONS.RESTAURANTS, id), {
        ownerId: uid
      });

      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      setOwnerId(uid);
      setCurrentManagerEmail(managerEmail);

      toast.success('Manager created and linked successfully!', { id: toastId });
      setManagerEmail('');
      setManagerPassword('');
    } catch (error: any) {
      console.error("Manager Creation Error:", error);
      toast.error('Failed: ' + error.message, { id: toastId });
    } finally {
      setIsCreatingManager(false);
    }
  };

  const handleUnlinkManager = async () => {
    try {
      await updateDoc(doc(db, COLLECTIONS.RESTAURANTS, id), {
        ownerId: null
      });
      setOwnerId(null);
      setCurrentManagerEmail('');
      toast.success('Manager unlinked.');
    } catch (error) {
      toast.error('Failed to unlink manager');
    }
  };

  const handleAddMenuCategory = async () => {
    const normalizedName = newMenuCategoryName.trim();
    if (!normalizedName) return;
    const alreadyExists = menuCategoryOptions.some((category) => category.toLowerCase() === normalizedName.toLowerCase());
    if (alreadyExists) {
      setNewMenuItem((current) => ({ ...current, category: normalizedName }));
      setNewMenuCategoryName('');
      toast.success('Category selected.');
      return;
    }

    try {
      await addDoc(collection(db, 'system_categories'), { name: normalizedName });
      setMenuCategories((current) => [
        ...current,
        { id: normalizedName.toLowerCase(), name: normalizedName, source: 'system' },
      ]);
      setNewMenuItem((current) => ({ ...current, category: normalizedName }));
      setNewMenuCategoryName('');
      toast.success('Category added and selected.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add category');
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuItem.name || !newMenuItem.price || !newMenuItem.category) {
      toast.error('Name, price, and category are required.');
      return;
    }
    if (Number(newMenuItem.price) <= 0) {
      toast.error('Price must be greater than 0.');
      return;
    }
    
    setIsSaving(true);
    try {
      let finalImageUrl = newMenuItem.imageUrl;
      if (newMenuImageFile) {
        finalImageUrl = await compressImageFile(newMenuImageFile, 700);
      }

      if (editingMenuId) {
        const updates = buildDishPayload({
          id: editingMenuId,
          restaurantId: id,
          branchId: id,
          branchName: formData.branchName.trim(),
          brandId: deriveRestaurantBrandBranch({ id, name: formData.name, brandName: formData.brandName, branchName: formData.branchName }).brandId,
          brandName: formData.brandName.trim(),
          name: newMenuItem.name,
          description: newMenuItem.description,
          price: parseFloat(newMenuItem.price),
          category: newMenuItem.category,
          imageUrl: finalImageUrl,
          isAvailable: newMenuItem.isAvailable,
          sortOrder: menuItems.find((item) => item.id === editingMenuId)?.sortOrder || 0,
        });
        await setDoc(doc(db, COLLECTIONS.MENU_ITEMS, editingMenuId), updates, { merge: true });
        await setDoc(doc(db, COLLECTIONS.RESTAURANTS, id, 'dishes', editingMenuId), updates, { merge: true });

        setMenuItems(menuItems.map(item => item.id === editingMenuId ? {
          ...item,
          id: editingMenuId,
          restaurantId: id,
          name: newMenuItem.name,
          description: newMenuItem.description,
          price: parseFloat(newMenuItem.price),
          category: newMenuItem.category,
          imageUrl: finalImageUrl,
          isAvailable: newMenuItem.isAvailable,
          sortOrder: menuItems.find((menuItem) => menuItem.id === editingMenuId)?.sortOrder || 0,
          updatedAt: new Date(),
        } : item));
        toast.success('Menu item updated successfully!');
      } else {
        const topLevelRef = doc(collection(db, COLLECTIONS.MENU_ITEMS));
        const menuItemData = buildDishPayload({
          id: topLevelRef.id,
          restaurantId: id,
          branchId: id,
          branchName: formData.branchName.trim(),
          brandId: deriveRestaurantBrandBranch({ id, name: formData.name, brandName: formData.brandName, branchName: formData.branchName }).brandId,
          brandName: formData.brandName.trim(),
          name: newMenuItem.name,
          description: newMenuItem.description,
          price: parseFloat(newMenuItem.price),
          category: newMenuItem.category,
          imageUrl: finalImageUrl,
          isAvailable: newMenuItem.isAvailable,
          sortOrder: menuItems.length,
        });

        await setDoc(topLevelRef, menuItemData);
        await setDoc(doc(db, COLLECTIONS.RESTAURANTS, id, 'dishes', topLevelRef.id), menuItemData);
        setMenuItems([...menuItems, {
          id: topLevelRef.id,
          restaurantId: id,
          name: newMenuItem.name,
          description: newMenuItem.description,
          price: parseFloat(newMenuItem.price),
          category: newMenuItem.category,
          imageUrl: finalImageUrl,
          isAvailable: newMenuItem.isAvailable,
          sortOrder: menuItems.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as MenuItem]);
        toast.success('Menu item added successfully!');
      }

      setNewMenuItem({ name: '', description: '', price: '', category: '', imageUrl: '', isAvailable: true });
      setNewMenuCategoryName('');
      setNewMenuImageFile(null);
      setNewMenuImageError('');
      setEditingMenuId(null);
      setIsMenuModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save menu item');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteMenuItem = async () => {
    if (!deleteMenuId) return;
    const itemId = deleteMenuId;
    setDeleteMenuId(null);
    try {
      await deleteDoc(doc(db, COLLECTIONS.MENU_ITEMS, itemId));
      await deleteDoc(doc(db, COLLECTIONS.RESTAURANTS, id, 'dishes', itemId));
      setMenuItems(menuItems.filter(item => item.id !== itemId));
      toast.success('Menu item deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete item');
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading restaurant details...</div>;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Restaurant management</p>
        <h1 className="mt-2 text-3xl font-black text-gray-900 dark:text-white">Edit Restaurant</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the details for this restaurant.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <RestaurantImageUploader
            file={imageFile}
            imageUrl={formData.imageUrl}
            onFileChange={setRestaurantImage}
            onClearExisting={() => setFormData((current) => ({ ...current, imageUrl: '' }))}
            error={imageError}
          />

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Marketplace status</p>
                <p className="text-xs text-gray-500">Inactive restaurants stay hidden from customers.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, isActive: !current.isActive }))}
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  formData.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                }`}
              >
                {formData.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Average delivery time (min)</label>
                <input
                  type="number"
                  min="5"
                  value={formData.deliveryTime}
                  onChange={(event) => setFormData({ ...formData, deliveryTime: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Delivery fee</label>
                <input
                  type="number"
                  min="0"
                  value={formData.deliveryFee}
                  onChange={(event) => setFormData({ ...formData, deliveryFee: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Service fee</label>
                <input
                  type="number"
                  min="0"
                  value={formData.serviceFee}
                  onChange={(event) => setFormData({ ...formData, serviceFee: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">Applied only to delivery orders. Pickup has no delivery or service fee.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                Brand is the chain. Branch / filial is the physical location used by catalog, orders, courier pickup, and customer tracking.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(event) => setFormData({ ...formData, brandName: event.target.value })}
                    placeholder="e.g. Bellissimo Pizza"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Branch / Filial Name</label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(event) => setFormData({ ...formData, branchName: event.target.value })}
                    placeholder="e.g. Yunusabad 4"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Marketplace Display Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="e.g. Bellissimo Pizza Yunusabad"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <RestaurantTypeSelect
              value={formData.restaurantType}
              options={restaurantTypes}
              loading={isLoadingTypes}
              onChange={(restaurantType) => setFormData({ ...formData, restaurantType })}
            />

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                placeholder="+998 90 123 45 67"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Working Hours</label>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(event) => setFormData({ ...formData, workingHours: event.target.value })}
                placeholder="09:00-23:00"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Minimum Order</label>
              <input
                type="number"
                min="0"
                value={formData.minOrder}
                onChange={(event) => setFormData({ ...formData, minOrder: event.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Short description shown on customer restaurant pages"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          <RestaurantLocationPicker
            value={location}
            onChange={setLocation}
          />

          <div className="flex flex-col justify-end gap-3 border-t border-gray-100 pt-4 sm:flex-row dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* App Login / Manager Section */}
      {ownerId ? (
        <div className="mt-8 rounded-xl bg-emerald-50 p-6 shadow-sm dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Manager Account Linked
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              This restaurant is already connected to a manager. They can log into the Mobile App with their email.
            </p>
          </div>
          
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
             <div>
                 <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Linked Manager Email</span>
                 <span className="font-bold text-gray-900 dark:text-white">{currentManagerEmail || "Loading..."}</span>
             </div>
             <button 
               onClick={handleUnlinkManager} 
               className="text-sm px-4 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
             >
               Remove Link
             </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-xl bg-orange-50 p-6 shadow-sm dark:bg-gray-800/80 border border-orange-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mobile App Login (Manager)</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create an email and password for the restaurant manager so they can log into the Kitchen Display App.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manager Email</label>
              <input 
                type="email" 
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="manager@restaurant.com"
                className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manager Password</label>
              <input 
                type="password" 
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              onClick={handleCreateManager}
              disabled={isCreatingManager}
              className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {isCreatingManager ? 'Linking...' : 'Link Manager Account'}
            </button>
          </div>
        </div>
      )}

      {/* Menu Management Section */}
      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Menu Items</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage food items for this restaurant.</p>
          </div>
          <button 
            onClick={() => {
              setEditingMenuId(null);
              setNewMenuItem({ name: '', description: '', price: '', category: '', imageUrl: '', isAvailable: true });
              setNewMenuCategoryName('');
              setNewMenuImageFile(null);
              setNewMenuImageError('');
              setIsMenuModalOpen(true);
            }}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            + Add Food
          </button>
        </div>

        {menuItems.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-gray-500">No menu items found. Add some delicious food!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map(item => (
              <div key={item.id} className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/50">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No Image</span>
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                    <span className="font-semibold text-brand-600">{item.price.toLocaleString()} UZS</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.category}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4 flex-1">{item.description}</p>
                  <div className="flex justify-end gap-4 mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button 
                      onClick={() => {
                        setEditingMenuId(item.id);
                        setNewMenuItem({
                          name: item.name,
                          description: item.description || '',
                          price: item.price.toString(),
                          category: item.category || '',
                          imageUrl: item.imageUrl || '',
                          isAvailable: item.isAvailable !== false,
                        });
                        setNewMenuCategoryName('');
                        setNewMenuImageFile(null);
                        setNewMenuImageError('');
                        setIsMenuModalOpen(true);
                      }}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setDeleteMenuId(item.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Menu Modal */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingMenuId ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
              Adding to {formData.brandName || 'Brand'} / {formData.branchName || 'Branch'}. The item will sync to Catalog and customer site when active.
            </div>
            <form onSubmit={handleSaveMenuItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Food Image</label>
                <label className="group relative flex min-h-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  {menuImagePreviewUrl ? (
                    <>
                      <img
                        src={menuImagePreviewUrl}
                        alt="Food preview"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                          setNewMenuImageError('Image preview failed. Use another image or remove it.');
                        }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100">
                        Change image
                      </span>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-xl dark:bg-orange-500/10">🍽️</div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Upload food image</p>
                      <p className="mt-1 text-xs text-gray-500">JPG, PNG or WebP. Preview appears here.</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const validation = validateRestaurantImage(file);
                      if (validation) {
                        setNewMenuImageError(validation);
                        return;
                      }
                      setNewMenuImageFile(file);
                      setNewMenuImageError('');
                    }}
                  />
                </label>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-medium text-gray-500">
                    {newMenuImageFile ? `Selected: ${newMenuImageFile.name}` : newMenuItem.imageUrl ? 'Existing image attached.' : 'No image selected.'}
                  </p>
                  {menuImagePreviewUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewMenuImageFile(null);
                        setNewMenuItem((current) => ({ ...current, imageUrl: '' }));
                        setNewMenuImageError('');
                      }}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
                    >
                      Remove image
                    </button>
                  ) : null}
                </div>
                {newMenuImageError && <p className="mt-2 text-xs font-semibold text-red-600">{newMenuImageError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input required value={newMenuItem.name} onChange={e => setNewMenuItem({...newMenuItem, name: e.target.value})} type="text" className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="e.g. Pepperoni Pizza" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select required value={newMenuItem.category} onChange={e => setNewMenuItem({...newMenuItem, category: e.target.value})} className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">{isLoadingMenuCategories ? 'Loading categories...' : 'Select category'}</option>
                    {menuCategoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newMenuCategoryName}
                      onChange={(event) => setNewMenuCategoryName(event.target.value)}
                      type="text"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="New category"
                    />
                    <button
                      type="button"
                      onClick={handleAddMenuCategory}
                      disabled={!newMenuCategoryName.trim()}
                      className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshMenuCategories()}
                      disabled={isLoadingMenuCategories}
                      className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (UZS)</label>
                  <input required value={newMenuItem.price} onChange={e => setNewMenuItem({...newMenuItem, price: e.target.value})} type="number" min="0" max="100000000" maxLength={9} className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="e.g. 55000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                <textarea value={newMenuItem.description} onChange={e => setNewMenuItem({...newMenuItem, description: e.target.value})} className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="Ingredients, etc." rows={3} />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                Active on customer site
                <input
                  type="checkbox"
                  checked={newMenuItem.isAvailable}
                  onChange={(event) => setNewMenuItem({ ...newMenuItem, isAvailable: event.target.checked })}
                  className="h-5 w-5 accent-brand-500"
                />
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                <button type="button" onClick={() => { setIsMenuModalOpen(false); setEditingMenuId(null); setNewMenuCategoryName(''); setNewMenuImageFile(null); setNewMenuImageError(''); }} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" disabled={isSaving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                  {editingMenuId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteMenuId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Menu Item?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to permanently delete this menu item?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteMenuId(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={executeDeleteMenuItem}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
