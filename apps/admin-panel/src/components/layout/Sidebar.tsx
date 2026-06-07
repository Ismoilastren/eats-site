'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';

/* ==============================
   SVG ICON COMPONENTS
   ============================== */

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ShoppingBagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-4h16l1 4" />
      <path d="M3 9v11a1 1 0 001 1h16a1 1 0 001-1V9" />
      <path d="M9 21V13h6v8" />
      <path d="M3 9h18" />
      <path d="M7 5l-.5 4M12 5v4M17 5l.5 4" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

/* ==============================
   MENU DATA STRUCTURE
   ============================== */

interface SubMenuItem {
  label: string;
  href: string;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  subItems?: SubMenuItem[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const menuSections: MenuSection[] = [
  {
    title: 'MENU',
    items: [
      {
        label: 'Dashboard',
        icon: GridIcon,
        subItems: [
          { label: 'Overview', href: '/' },
          { label: 'Analytics', href: '/analytics' },
        ],
      },
      {
        label: 'Orders',
        icon: ShoppingBagIcon,
        href: '/orders',
      },
      {
        label: 'Restaurants',
        icon: StoreIcon,
        href: '/restaurants',
      },
      {
        label: 'Couriers',
        icon: TruckIcon,
        href: '/couriers',
      },
      {
        label: 'Users',
        icon: UsersIcon,
        href: '/users',
      },
      {
        label: 'Admins',
        icon: ShieldIcon,
        href: '/admins',
      },
    ],
  },
  {
    title: 'OTHERS',
    items: [
      {
        label: 'Settings',
        icon: SettingsIcon,
        href: '/settings',
      },
      {
        label: 'Reports',
        icon: ChartIcon,
        href: '/reports',
      },
    ],
  },
];

/* ==============================
   SIDEBAR COMPONENT
   ============================== */

export function Sidebar() {
  const pathname = usePathname();
  const { isExpanded, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebar();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    // Auto-open the menu that contains the current path
    const initial: Record<string, boolean> = {};
    for (const section of menuSections) {
      for (const item of section.items) {
        if (item.subItems?.some((sub) => sub.href === pathname)) {
          initial[item.label] = true;
        }
      }
    }
    return initial;
  });

  const toggleMenu = useCallback((label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: MenuItem) => {
    if (item.href) return pathname === item.href;
    return item.subItems?.some((sub) => sub.href === pathname) ?? false;
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* -------- LOGO -------- */}
      <div className="flex h-[72px] items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-xl font-bold text-orange-500">2(13)</span>
        </Link>
        {/* Desktop collapse button */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {isExpanded ? (
              <path d="M15 4l-6 6 6 6M4 4v12" />
            ) : (
              <path d="M5 4l6 6-6 6M16 4v12" />
            )}
          </svg>
        </button>
      </div>

      {/* -------- MENU ITEMS -------- */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-6">
            {isExpanded && (
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {section.title}
              </h3>
            )}

            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isParentActive(item);
                const isOpen = openMenus[item.label] ?? false;

                if (item.href && !item.subItems) {
                  // Simple link item (no submenu)
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeMobileSidebar}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? 'bg-brand-500 text-white'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                        title={!isExpanded ? item.label : undefined}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'}`} />
                        {isExpanded && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                }

                // Menu item with submenu
                return (
                  <li key={item.label}>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                      title={!isExpanded ? item.label : undefined}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'}`} />
                      {isExpanded && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDownIcon
                            className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </>
                      )}
                    </button>

                    {/* Sub-menu items */}
                    {isExpanded && isOpen && item.subItems && (
                      <ul className="mt-1 space-y-0.5 pl-[38px]">
                        {item.subItems.map((subItem) => {
                          const subActive = isActive(subItem.href);
                          return (
                            <li key={subItem.href}>
                              <Link
                                href={subItem.href}
                                onClick={closeMobileSidebar}
                                className={`relative flex items-center rounded-lg px-3 py-2 text-sm transition-all duration-200 before:absolute before:-left-[7px] before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full ${
                                  subActive
                                    ? 'text-brand-600 before:bg-brand-500 dark:text-brand-400'
                                    : 'text-gray-600 before:bg-gray-300 hover:text-gray-900 dark:text-gray-400 dark:before:bg-gray-600 dark:hover:text-gray-200'
                                }`}
                              >
                                {subItem.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* -------- MOBILE OVERLAY -------- */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* -------- MOBILE SIDEBAR -------- */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[290px] border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* -------- DESKTOP SIDEBAR -------- */}
      <aside
        className={`hidden lg:flex h-screen shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
          isExpanded ? 'w-[290px]' : 'w-[90px]'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
