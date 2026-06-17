'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, collection, getDocs, limit, onSnapshot, orderBy, query } from '@repo/firebase-config';
import { COLLECTIONS, normalizeOrderStatus } from '@repo/shared-types';

type GlobalSearchResult = {
  id: string;
  label: string;
  detail: string;
  href: string;
  type: 'Order' | 'Branch' | 'Product' | 'Courier' | 'User';
};

type OrderNotification = {
  id: string;
  title: string;
  desc: string;
  href: string;
};

export function Header() {
  const { toggleMobileSidebar } = useSidebar();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const { user, logout } = useAuth();

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const ordersQuery = query(collection(db, COLLECTIONS.ORDERS), orderBy('createdAt', 'desc'), limit(5));
    return onSnapshot(
      ordersQuery,
      (snapshot) => {
        setNotifications(snapshot.docs.map((item) => {
          const data = item.data() as Record<string, any>;
          const shortId = String(item.id).slice(0, 6).toUpperCase();
          return {
            id: item.id,
            title: `Order #${shortId}`,
            desc: `${normalizeOrderStatus(data.status || 'pending')} · ${data.customerName || 'Customer'} · ${data.restaurantName || data.branchName || 'Branch'}`,
            href: `/orders/${item.id}`,
          };
        }));
      },
      (error) => {
        console.error('Header notifications failed:', error);
        setNotifications([]);
      },
    );
  }, []);

  useEffect(() => {
    const term = searchValue.trim().toLowerCase();
    if (term.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const [ordersSnap, restaurantsSnap, menuSnap, couriersSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.ORDERS)),
          getDocs(collection(db, COLLECTIONS.RESTAURANTS)),
          getDocs(collection(db, COLLECTIONS.MENU_ITEMS)),
          getDocs(collection(db, COLLECTIONS.COURIERS)),
          getDocs(collection(db, COLLECTIONS.USERS)),
        ]);

        if (cancelled) return;
        const results: GlobalSearchResult[] = [];
        const matches = (...values: unknown[]) => values.some((value) => String(value || '').toLowerCase().includes(term));

        ordersSnap.docs.forEach((item) => {
          const data = item.data() as Record<string, any>;
          if (!matches(item.id, data.customerName, data.customerPhone, data.restaurantName, data.branchName, data.status)) return;
          results.push({
            id: `order-${item.id}`,
            label: `#${item.id.slice(0, 6).toUpperCase()} · ${data.customerName || 'Customer'}`,
            detail: `${data.restaurantName || data.branchName || 'Branch'} · ${normalizeOrderStatus(data.status || 'pending')}`,
            href: `/orders/${item.id}`,
            type: 'Order',
          });
        });

        restaurantsSnap.docs.forEach((item) => {
          const data = item.data() as Record<string, any>;
          if (!matches(data.name, data.brandName, data.branchName, data.address, data.cuisine)) return;
          results.push({
            id: `restaurant-${item.id}`,
            label: data.branchName ? `${data.brandName || data.name} · ${data.branchName}` : data.name || item.id,
            detail: data.address || data.cuisine || 'Restaurant branch',
            href: `/restaurants/edit/${item.id}`,
            type: 'Branch',
          });
        });

        menuSnap.docs.forEach((item) => {
          const data = item.data() as Record<string, any>;
          if (!matches(data.name, data.category, data.brandName, data.branchName)) return;
          results.push({
            id: `product-${item.id}`,
            label: data.name || item.id,
            detail: `${data.brandName || data.restaurantName || 'Brand'} · ${data.category || 'Category'}`,
            href: '/catalog',
            type: 'Product',
          });
        });

        couriersSnap.docs.forEach((item) => {
          const data = item.data() as Record<string, any>;
          if (!matches(item.id, data.fullName, data.displayName, data.name, data.phone, data.licensePlate, data.plateNumber)) return;
          results.push({
            id: `courier-${item.id}`,
            label: data.fullName || data.displayName || data.name || item.id,
            detail: `${data.phone || 'No phone'} · ${data.status || 'offline'}`,
            href: '/couriers',
            type: 'Courier',
          });
        });

        usersSnap.docs.forEach((item) => {
          const data = item.data() as Record<string, any>;
          if (!matches(data.fullName, data.displayName, data.name, data.email, data.phone, data.role)) return;
          results.push({
            id: `user-${item.id}`,
            label: data.fullName || data.displayName || data.name || data.email || item.id,
            detail: `${data.role || 'user'} · ${data.email || data.phone || 'No contact'}`,
            href: '/users',
            type: 'User',
          });
        });

        setSearchResults(results.slice(0, 8));
      } catch (error) {
        console.error('Global search failed:', error);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchValue]);

  const openSearchResult = (result: GlobalSearchResult) => {
    setSearchValue('');
    setSearchResults([]);
    setIsSearchOpen(false);
    router.push(result.href);
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] w-full items-center border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900 md:px-6">
      {/* -------- LEFT: Hamburger + Search -------- */}
      <div className="flex flex-1 items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobileSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          aria-label="Open sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Search input */}
        <div ref={searchRef} className="hidden sm:block relative w-full max-w-[360px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="9" cy="9" r="6" />
              <line x1="13.5" y1="13.5" x2="17" y2="17" />
            </svg>
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && searchResults[0]) openSearchResult(searchResults[0]);
              if (event.key === 'Escape') setIsSearchOpen(false);
            }}
            placeholder="Search orders, branches, products..."
            className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-brand-400"
          />
          {isSearchOpen && searchValue.trim().length >= 2 && (
            <div className="absolute left-0 top-full z-50 mt-2 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700">
                {isSearching ? 'Searching live Firestore...' : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}
              </div>
              {searchResults.length ? (
                <div className="max-h-80 overflow-y-auto py-1">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => openSearchResult(result)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-black uppercase text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                        {result.type}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">{result.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{result.detail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  No live records match this search.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* -------- RIGHT: Actions -------- */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Notifications"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-[10px] font-semibold text-white">
              {notifications.length}
            </span>
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
              <div className="space-y-3">
                {notifications.length ? notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setIsNotificationsOpen(false)}
                    className="flex gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p>
                    </div>
                  </Link>
                )) : (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                    No recent live orders.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-8 w-px bg-gray-200 dark:bg-gray-700" />

        {/* User dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white uppercase">
              {user?.email?.charAt(0) || 'A'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.displayName || 'Administrator'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
            <svg className="hidden md:block h-5 w-5 text-gray-400" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 8l4 4 4-4" />
            </svg>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.displayName || 'Administrator'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <div className="py-1">
                {[
                  { label: 'My Profile', href: '/profile', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z' },
                  { label: 'Settings', href: '/settings', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
                  >
                    <svg className="h-4 w-4 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-gray-200 py-1 dark:border-gray-700">
                <button 
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                >
                  <svg className="h-4 w-4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
