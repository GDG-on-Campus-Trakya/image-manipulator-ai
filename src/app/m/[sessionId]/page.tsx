'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { normalizeImageOrientation } from '@/lib/imageUtils';

export default function MobileUploadPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      // Normalize image orientation based on EXIF data
      // This prevents images from being rotated incorrectly
      const normalizedFile = await normalizeImageOrientation(file);

      // Upload to Firebase Storage - stant_images/input path
      const timestamp = Date.now();
      const storageRef = ref(storage, `stant_images/input/${sessionId}/${timestamp}.jpg`);
      await uploadBytes(storageRef, normalizedFile);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Save metadata to Firestore
      const photosCollection = collection(db, `sessions/${sessionId}/photos`);
      await addDoc(photosCollection, {
        url: downloadURL,
        storagePath: storageRef.fullPath,
        uploadedAt: serverTimestamp(),
      });

      setUploadSuccess(true);

      // Reset file input
      e.target.value = '';

      // Reset success message after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Photo Upload
          </h1>
          <p className="text-gray-600">
            Session: <span className="font-mono text-sm">{sessionId}</span>
          </p>
        </div>

        <div className="space-y-4">
          <label
            htmlFor="file-upload"
            className={`
              block w-full p-8 border-2 border-dashed rounded-xl text-center cursor-pointer
              transition-all duration-200
              ${uploading ? 'border-gray-300 bg-gray-50 cursor-not-allowed' : 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'}
            `}
          >
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-gray-600">
                {uploading ? (
                  <span className="font-medium">Uploading...</span>
                ) : (
                  <>
                    <span className="font-medium text-indigo-600">
                      Click to upload
                    </span>
                    <span> or drag and drop</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
            </div>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <svg
                className="h-5 w-5 text-green-500 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-800 font-medium">
                Upload successful!
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <svg
                className="h-5 w-5 text-red-500 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Photos will appear on the dashboard in real-time
          </p>
        </div>
      </div>
    </div>
  );
}
