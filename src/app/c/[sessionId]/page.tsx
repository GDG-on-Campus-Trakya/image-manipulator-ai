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
import { QRCodeSVG } from 'qrcode.react';

export default function CollagePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const photosCollection = collection(db, `sessions/${sessionId}/photos`);
    // Only get photos that have AI processed output
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
        // Filter to only show photos with AI output
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

  // Filter photos with AI output
  const aiPhotos = photos.filter(photo => photo.aiOutputUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
          AI Photo Gallery
        </h1>
        <p className="text-xl text-purple-200">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-[1800px] mx-auto">
          {aiPhotos.map((photo) => {
            const downloadUrl = `/api/download/${sessionId}/${photo.id}`;
            const fullDownloadUrl = typeof window !== 'undefined'
              ? `${window.location.origin}${downloadUrl}`
              : downloadUrl;

            return (
              <div
                key={photo.id}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden transform hover:scale-105 transition-all duration-300"
              >
                {/* AI Photo */}
                <div className="relative aspect-square">
                  <img
                    src={photo.aiOutputUrl}
                    alt={`AI Generated ${photo.id}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Date Badge */}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1">
                    <p className="text-white text-xs font-medium">
                      {photo.aiProcessedAt?.toLocaleTimeString() ||
                       photo.uploadedAt.toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-semibold text-gray-700 text-center">
                      Scan to Download
                    </p>
                    <div className="bg-white p-3 rounded-xl shadow-md border-2 border-purple-300">
                      <QRCodeSVG
                        value={fullDownloadUrl}
                        size={120}
                        level="H"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      {aiPhotos.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-purple-200 text-sm">
            Scan any QR code to download the photo to your device
          </p>
        </div>
      )}
    </div>
  );
}
