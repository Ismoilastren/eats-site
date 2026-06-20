'use client';
import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, deleteDoc, doc } from '@repo/firebase-config';
import toast from 'react-hot-toast';
import { loadCatalogCategoryOptions, type CatalogCategoryOption } from '@/lib/restaurantAdmin';

const SYSTEM_CATEGORIES_COLLECTION = 'system_categories';
const SETTINGS_CATEGORIES_COLLECTION = 'settings/restaurant_categories/items';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CatalogCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setCategories(await loadCatalogCategoryOptions());
    } catch (error) {
      console.error(error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAdding(true);
    try {
      const normalizedName = newCatName.trim();
      const alreadyExists = categories.some((category) => category.name.toLowerCase() === normalizedName.toLowerCase());
      if (alreadyExists) {
        toast.error('This category already exists.');
        return;
      }

      await addDoc(collection(db, SYSTEM_CATEGORIES_COLLECTION), { name: normalizedName });
      toast.success('Category added to Firestore!');
      setNewCatName('');
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add category');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const category = categories.find(c => c.id === id);
    if (!category || !['settings', 'system'].includes(category.source)) {
      toast.error('Only manually created categories can be deleted here.');
      return;
    }
    try {
      await deleteDoc(doc(
        db,
        category?.source === 'settings' ? SETTINGS_CATEGORIES_COLLECTION : SYSTEM_CATEGORIES_COLLECTION,
        id
      ));
      toast.success('Category removed');
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage catalog categories used by restaurant menu item forms.</p>
        </div>
      </div>
      
      <form onSubmit={handleAddCategory} className="flex gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <input 
          type="text" 
          required
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="New Category Name (e.g. Sushi)"
          className="flex-1 rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <button 
          type="submit" 
          disabled={isAdding}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {isAdding ? 'Adding...' : '+ Add Category'}
        </button>
      </form>
      
      {isLoading ? (
        <div className="text-center text-gray-500 py-12">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow-sm dark:bg-gray-800">No categories found. Add one above.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 flex items-center justify-between">
              <div>
                <span className="font-medium dark:text-white">{cat.name}</span>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{cat.source}</p>
              </div>
              {['settings', 'system'].includes(cat.source) ? (
                <button onClick={() => handleDelete(cat.id)} className="text-red-400 hover:text-red-500 text-sm">Delete</button>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-300">Auto</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
