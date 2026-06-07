'use client';

import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success:
    'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500',
  warning:
    'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500',
  error:
    'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500',
  info:
    'bg-info-50 text-info-700 dark:bg-info-500/10 dark:text-info-500',
  default:
    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
