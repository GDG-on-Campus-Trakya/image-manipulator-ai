'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Photo } from '@/types';
import BentoPhoto from '@/components/BentoPhoto';

export default function CollagePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const photosCollection = collection(db, `sessions/${sessionId}/photos`);
    const photosQuery = query(
      photosCollection,
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(photosQuery, (snapshot) => {
      const photosList: Photo[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            url: data.url,
            storagePath: data.storagePath,
            uploadedAt: data.uploadedAt?.toDate() || new Date(),
            aiOutputUrl: data.aiOutputUrl,
            aiOutputStoragePath: data.aiOutputStoragePath,
            aiProcessedAt: data.aiProcessedAt?.toDate(),
          };
        })
        .filter((photo) => photo.aiOutputUrl);

      setPhotos(photosList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Loading AI Gallery...</div>
      </div>
    );
  }

  const aiPhotos = photos.filter(photo => photo.aiOutputUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 sm:p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 drop-shadow-lg">
          AI Photo Gallery
        </h1>
        <p className="text-lg sm:text-xl text-purple-200">
          {aiPhotos.length} {aiPhotos.length === 1 ? 'Photo' : 'Photos'} Created
        </p>
      </div>

      {aiPhotos.length === 0 ? (
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              No AI photos yet...
            </h2>
            <p className="text-purple-200 text-lg">
              Process some photos to see them here
            </p>
          </div>
        </div>
      ) : (
        <div className="bento-grid max-w-[1800px] mx-auto">
          {aiPhotos.map((photo) => {
            const downloadUrl = `/api/download/${sessionId}/${photo.id}`;
            return (
              <BentoPhoto
                key={photo.id}
                photo={photo}
                downloadUrl={downloadUrl}
              />
            );
          })}
        </div>
      )}

      {aiPhotos.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-purple-200 text-sm">
            Click on any photo to reveal the QR code for download.
          </p>
        </div>
      )}
    </div>
  );
}
