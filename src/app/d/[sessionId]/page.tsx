'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PhotoCard from '@/components/PhotoCard';
import type { Photo } from '@/types';

export default function DashboardPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    try {
      const photosCollection = collection(db, `sessions/${sessionId}/photos`);
      const photosQuery = query(photosCollection, orderBy('uploadedAt', 'desc'));

      const unsubscribe = onSnapshot(
        photosQuery,
        (snapshot) => {
          const photosList: Photo[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              url: data.url,
              storagePath: data.storagePath,
              uploadedAt:
                data.uploadedAt instanceof Timestamp
                  ? data.uploadedAt.toDate()
                  : new Date(),
              aiOutputUrl: data.aiOutputUrl,
              aiOutputStoragePath: data.aiOutputStoragePath,
              aiProcessedAt:
                data.aiProcessedAt instanceof Timestamp
                  ? data.aiProcessedAt.toDate()
                  : undefined,
            };
          });
          setPhotos(photosList);
          setLoading(false);
        },
        (err) => {
          console.error('Firestore error:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Setup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      setLoading(false);
    }
  }, [sessionId]);

  const mobileUploadUrl = `${window.location.origin}/m/${sessionId}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                AI Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Session:{' '}
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {sessionId}
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={mobileUploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-center transition-colors"
              >
                Open Mobile Upload
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="text-gray-600">Loading photos...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
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
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && photos.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              No photos yet
            </h3>
            <p className="mt-1 text-gray-500">
              Upload photos from the mobile device to see them here
            </p>
            <div className="mt-6">
              <a
                href={mobileUploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Open Upload Page
              </a>
            </div>
          </div>
        )}

        {photos.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Photos ({photos.length})
              </h2>
            </div>

            <div className="space-y-4">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  sessionId={sessionId}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
