'use client';
import React, { useState } from 'react';
import { db, collection, getDocs, query, limit } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = async (type: string) => {
    setIsGenerating(true);
    toast.loading(`Generating ${type}...`, { id: 'report' });
    
    try {
      let targetCollection = '';
      if (type.includes('Financial') || type.includes('Order')) targetCollection = COLLECTIONS.ORDERS;
      if (type.includes('User')) targetCollection = COLLECTIONS.USERS;
      if (type.includes('Restaurant')) targetCollection = COLLECTIONS.RESTAURANTS;

      if (!targetCollection) throw new Error('Unknown report type');

      // Fetch live data from Firestore
      const q = query(collection(db, targetCollection), limit(1000));
      const snapshot = await getDocs(q);
      
      const rows: string[] = [];
      let headers: string[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // If it's the first document, extract keys as headers
        if (headers.length === 0) {
          headers = ['id', ...Object.keys(data)];
          rows.push(headers.join(','));
        }

        // Extract values in the same order as headers
        const rowValues = headers.map(header => {
          if (header === 'id') return doc.id;
          let val = data[header];
          if (val && typeof val === 'object' && val.seconds) {
            val = new Date(val.seconds * 1000).toISOString();
          } else if (typeof val === 'object') {
            val = JSON.stringify(val).replace(/"/g, '""');
          }
          return `"${val ?? ''}"`;
        });
        
        rows.push(rowValues.join(','));
      });

      if (rows.length === 0) {
        rows.push('No data available');
      }

      const csvContent = rows.join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${type.replace(/\s+/g, '_').toLowerCase()}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${type} generated from live Firestore data!`, { id: 'report' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate report', { id: 'report' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports Generator</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Export live platform data from Firestore directly to CSV.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['Financial Report', 'User Growth Report', 'Restaurant Performance'].map((report, idx) => (
          <div key={idx} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-medium dark:text-white">{report}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">Generates CSV based on live Firestore data chunks.</p>
            <button 
              onClick={() => generateReport(report)}
              disabled={isGenerating}
              className="text-brand-500 font-medium hover:text-brand-600 disabled:opacity-50"
            >
              {isGenerating ? 'Querying Firestore...' : 'Download CSV \u2192'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
