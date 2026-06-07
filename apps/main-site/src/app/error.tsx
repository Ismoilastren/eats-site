'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error("FATAL APP ERROR:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl w-full text-center border border-red-100">
        <h2 className="text-3xl font-extrabold text-red-600 mb-4">Something went wrong!</h2>
        <div className="bg-red-50 text-red-800 p-4 rounded-lg text-left overflow-auto text-sm font-mono mb-6 max-h-64">
          {error.message || "Unknown Application Crash"}
        </div>
        <button
          onClick={() => reset()}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
        >
          Try to recover (Refresh)
        </button>
      </div>
    </div>
  );
}
