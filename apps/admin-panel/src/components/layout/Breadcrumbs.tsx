'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatOrderCode } from '@repo/shared-types';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/analytics': 'Analytics',
  '/orders': 'Live orders',
  '/orders/active': 'Active orders',
  '/orders/create': 'Create order',
  '/orders/dispatch': 'Dispatcher map',
  '/restaurants': 'Restaurants',
  '/restaurants/add': 'Add branch',
  '/restaurants/categories': 'Categories',
  '/catalog': 'Products',
  '/catalog/matrix': 'Branch / Catalog Matrix',
  '/couriers': 'Couriers',
  '/couriers/active': 'Active couriers',
  '/users': 'Users',
  '/admins': 'Admin users',
  '/roles': 'Roles matrix',
  '/audit-logs': 'Audit logs',
  '/geozones': 'Geozones',
  '/settings': 'Settings',
  '/reports': 'Reports',
  '/profile': 'Profile',
  '/seed': 'Seed data',
};

const SECTION_LABELS: Record<string, string> = {
  orders: 'Orders',
  restaurants: 'Restaurants',
  catalog: 'Catalog',
  couriers: 'Couriers',
  admins: 'Admins',
};

function humanizeSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildLabel(path: string, segment: string) {
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  if (SECTION_LABELS[segment]) return SECTION_LABELS[segment];

  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'orders' && parts.length === 2) {
    return `Order ${formatOrderCode(decodeURIComponent(segment))}`;
  }
  if (parts[0] === 'restaurants' && parts[1] === 'edit') {
    return parts.length === 2 ? 'Edit branch' : humanizeSegment(segment);
  }

  return humanizeSegment(segment);
}

function buildHref(path: string) {
  if (path === '/restaurants/edit') return null;
  return path;
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 4 6 6-6 6" />
    </svg>
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();

  if (!pathname || pathname === '/login') return null;

  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`;
    return {
      href: buildHref(path),
      label: buildLabel(path, segment),
      path,
    };
  });

  if (pathname === '/') {
    crumbs.push({ href: '/', label: ROUTE_LABELS['/'], path: '/' });
  }

  return (
    <nav aria-label="Breadcrumb" className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2 overflow-x-auto px-4 text-sm md:px-6">
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          aria-label="Dashboard"
        >
          <HomeIcon />
        </Link>

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <span key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-gray-300 dark:text-gray-600">
                <ChevronIcon />
              </span>
              {isLast || !crumb.href ? (
                <span className="truncate text-base font-black text-gray-900 dark:text-white md:text-lg">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-base font-bold text-gray-500 transition hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-300 md:text-lg"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
