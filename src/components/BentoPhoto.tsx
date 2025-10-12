'use client';

import { useState } from 'react';
import type { Photo } from '@/types';
import { QRCodeSVG } from 'qrcode.react';

interface BentoPhotoProps {
  photo: Photo;
  downloadUrl: string;
  className?: string;
}

export default function BentoPhoto({ photo, downloadUrl, className = '' }: BentoPhotoProps) {
  const [showQr, setShowQr] = useState(false);

  const fullDownloadUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${downloadUrl}`
    : downloadUrl;

  return (
    <div
      className={`bento-item relative rounded-2xl shadow-2xl overflow-hidden transform hover:scale-105 transition-all duration-300 cursor-pointer ${className}`}
      onClick={() => setShowQr(true)}
    >
      <img
        src={photo.aiOutputUrl}
        alt={`AI Generated ${photo.id}`}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1">
        <p className="text-white text-xs font-medium">
          {photo.aiProcessedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ||
           photo.uploadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {showQr && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-10"
          onClick={(e) => {
            e.stopPropagation(); // Prevent parent onClick from firing again
            setShowQr(false);
          }}
        >
          <p className="text-sm font-semibold text-white text-center mb-3">
            Scan to Download
          </p>
          <div className="bg-white p-3 rounded-xl shadow-md border-2 border-purple-300">
            <QRCodeSVG
              value={fullDownloadUrl}
              size={150}
              level="H"
            />
          </div>
          <button
            className="mt-4 text-xs text-white bg-white/20 hover:bg-white/30 rounded-full px-4 py-1"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
