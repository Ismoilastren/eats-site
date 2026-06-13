'use client';

import { ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo } from 'react';

type RestaurantImageUploaderProps = {
  file: File | null;
  imageUrl?: string;
  onFileChange: (file: File | null) => void;
  onClearExisting?: () => void;
  error?: string;
};

export function RestaurantImageUploader({
  file,
  imageUrl,
  onFileChange,
  onClearExisting,
  error,
}: RestaurantImageUploaderProps) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : imageUrl || ''), [file, imageUrl]);

  useEffect(() => {
    return () => {
      if (file && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [file, previewUrl]);

  const handleFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    onFileChange(nextFile);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Restaurant image</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG or WebP. Max 5 MB.</p>
        </div>
        {previewUrl && (
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              onClearExisting?.();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
      </div>

      <label className="group relative flex min-h-[220px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-white transition hover:border-orange-400 dark:border-gray-700 dark:bg-gray-800">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Restaurant image preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-950">
                <UploadCloud size={18} /> Change image
              </span>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
              <ImageIcon size={28} />
            </div>
            <p className="mt-4 text-sm font-bold text-gray-900 dark:text-white">Upload restaurant cover</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Preview appears here before save.</p>
          </div>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </label>

      {file && (
        <p className="mt-2 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
          Selected: {file.name}
        </p>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
