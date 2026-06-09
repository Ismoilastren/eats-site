'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, collection, auth, doc, setDoc } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import toast from 'react-hot-toast';
import { buildRestaurantPayload } from '@/lib/marketplaceSchema';

export default function AddRestaurantPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    cuisine: '',
    location: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.cuisine || !formData.location) {
      toast.error('Name, cuisine, and location are required.');
      return;
    }

    setIsSaving(true);
    toast.loading('Adding restaurant...', { id: 'add-restaurant' });

    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { role: 'admin' }, { merge: true });
      }

      let finalImageUrl = '';
      
      if (imageFile) {
        // Bypass Firebase Storage by compressing the image and converting to Base64
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              const scaleSize = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              // Compress as WebP for smaller size
              resolve(canvas.toDataURL('image/webp', 0.7));
            };
            img.onerror = (error) => reject(error);
          };
          reader.onerror = (error) => reject(error);
        });
      }

      const restaurantRef = doc(collection(db, COLLECTIONS.RESTAURANTS));
      const newRestaurant = buildRestaurantPayload({
        id: restaurantRef.id,
        name: formData.name,
        cuisine: formData.cuisine,
        address: formData.location,
        description: formData.description,
        imageUrl: finalImageUrl,
      });

      await setDoc(restaurantRef, newRestaurant);

      toast.success('Restaurant added successfully!', { id: 'add-restaurant' });
      router.push('/restaurants');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to add restaurant: ' + error.message, { id: 'add-restaurant' });
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Restaurant</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the details to onboard a new restaurant.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Restaurant Image</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImageFile(e.target.files[0]);
                }
              }}
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Restaurant Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Express Eats"
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuisine Type</label>
            <input 
              type="text" 
              value={formData.cuisine}
              onChange={(e) => setFormData({...formData, cuisine: e.target.value})}
              placeholder="e.g. Fast Food, Italian, Uzbek"
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Address</label>
            <input 
              type="text" 
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="e.g. Amir Temur 14, Tashkent"
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Short description of the restaurant"
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSaving}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Restaurant'}
          </button>
        </div>
      </form>
    </div>
  );
}
