'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { runReplicate } from '@/lib/replicate';
import type { Photo, ReplicateModelInput } from '@/types';

interface PhotoCardProps {
  photo: Photo;
  sessionId: string;
}

export default function PhotoCard({ photo, sessionId }: PhotoCardProps) {
  const [prompt, setPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [aiOutputUrl, setAiOutputUrl] = useState<string | null>(photo.aiOutputUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [showInputQR, setShowInputQR] = useState(false);
  const [showOutputQR, setShowOutputQR] = useState(false);

  // Generate a short URL for QR code
  const getShortDownloadUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/download/${sessionId}/${photo.id}`;
    }
    return '';
  };

  const downloadImageFromUrl = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download image from Replicate');
    }
    return response.blob();
  };

  const handleRunAI = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    const modelVersion = process.env.NEXT_PUBLIC_REPLICATE_MODEL_VERSION || '';
    if (!modelVersion) {
      setError('Replicate model version not configured');
      return;
    }

    setProcessing(true);
    setError(null);
    setStatus('Starting AI processing...');

    try {
      // Prepare Replicate model input
      const modelInput: Partial<ReplicateModelInput> = {
        size: '1K',
        width: 2048,
        height: 2048,
        prompt: prompt,
        max_images: 1,
        image_input: [photo.url], // Use Firebase Storage URL
        aspect_ratio: 'match_input_image',
        sequential_image_generation: 'disabled',
      };

      // Run Replicate (token is now handled by API route)
      setStatus('Processing with AI...');
      const output = await runReplicate(
        modelVersion,
        modelInput as any,
        undefined, // No token needed - handled server-side
        (newStatus) => {
          setStatus(`AI Status: ${newStatus}`);
        }
      );

      // Replicate output is usually an array of image URLs
      let imageUrl: string;
      if (Array.isArray(output) && output.length > 0) {
        imageUrl = output[0];
      } else if (typeof output === 'string') {
        imageUrl = output;
      } else {
        throw new Error('Unexpected output format from Replicate');
      }

      // Download the AI output image
      setStatus('Downloading AI output...');
      const imageBlob = await downloadImageFromUrl(imageUrl);

      // Upload to Firebase Storage - stant_images/ai path
      setStatus('Uploading to storage...');
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `stant_images/ai/${sessionId}/${photo.id}_${timestamp}.jpg`
      );
      await uploadBytes(storageRef, imageBlob);

      // Get the Firebase Storage URL
      const firebaseUrl = await getDownloadURL(storageRef);
      setAiOutputUrl(firebaseUrl);

      // Update the photo document with AI output info
      setStatus('Saving metadata...');
      const photoDoc = doc(db, `sessions/${sessionId}/photos`, photo.id);
      await updateDoc(photoDoc, {
        aiOutputUrl: firebaseUrl,
        aiOutputStoragePath: storageRef.fullPath,
        aiProcessedAt: serverTimestamp(),
      });

      // Save AI response to aiResponses subcollection
      const aiResponsesCollection = collection(
        db,
        `sessions/${sessionId}/aiResponses`
      );
      await addDoc(aiResponsesCollection, {
        photoId: photo.id,
        prompt: prompt,
        outputImageUrl: firebaseUrl,
        outputImageStoragePath: storageRef.fullPath,
        status: 'succeeded',
        createdAt: serverTimestamp(),
      });

      setStatus('Completed!');
    } catch (err) {
      console.error('AI processing error:', err);
      setError(err instanceof Error ? err.message : 'AI processing failed');
      setStatus('Failed');

      // Save failed AI response
      try {
        const aiResponsesCollection = collection(
          db,
          `sessions/${sessionId}/aiResponses`
        );
        await addDoc(aiResponsesCollection, {
          photoId: photo.id,
          prompt: prompt,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          createdAt: serverTimestamp(),
        });
      } catch (dbErr) {
        console.error('Failed to save error to database:', dbErr);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="grid lg:grid-cols-3 gap-4 p-6">
        {/* Left - Input Image */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Input Image
          </h3>
          <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
            <img
              src={photo.url}
              alt="Input photo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex gap-2">
            <a
              href={photo.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-center text-xs font-medium transition-colors"
            >
              Download
            </a>
            <button
              onClick={() => setShowInputQR(!showInputQR)}
              className="flex-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-lg text-xs font-medium transition-colors"
            >
              {showInputQR ? 'Hide' : 'Show'} QR
            </button>
          </div>

          {showInputQR && (
            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border-2 border-blue-200 dark:border-blue-700 flex justify-center">
              <QRCodeSVG value={photo.url} size={150} level="H" />
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Uploaded: {photo.uploadedAt.toLocaleString()}
          </p>
        </div>

        {/* Middle - AI Controls */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Processing</h3>

          <div>
            <label
              htmlFor={`prompt-${photo.id}`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Prompt
            </label>
            <textarea
              id={`prompt-${photo.id}`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={processing}
              placeholder="Describe the transformation you want..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
              rows={5}
            />
          </div>

          <button
            onClick={handleRunAI}
            disabled={processing || !prompt.trim()}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              'Generate AI Image'
            )}
          </button>

          {status && !error && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-blue-800 dark:text-blue-200 text-xs">{status}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-800 dark:text-red-200 text-xs font-medium">{error}</p>
            </div>
          )}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Model Settings:</strong>
              <br />
              Size: 1K (2048x2048)
              <br />
              Aspect: Match Input
            </p>
          </div>
        </div>

        {/* Right - AI Output */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            AI Output
          </h3>

          {aiOutputUrl ? (
            <>
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                <img
                  src={aiOutputUrl}
                  alt="AI output"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex gap-2">
                <a
                  href={aiOutputUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-200 rounded-lg text-center text-xs font-medium transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => setShowOutputQR(!showOutputQR)}
                  className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-200 rounded-lg text-xs font-medium transition-colors"
                >
                  {showOutputQR ? 'Hide' : 'Show'} QR
                </button>
              </div>

              {showOutputQR && (
                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border-2 border-green-200 dark:border-green-700 flex justify-center">
                  <QRCodeSVG value={getShortDownloadUrl()} size={200} level="M" />
                </div>
              )}

              {photo.aiProcessedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Processed: {photo.aiProcessedAt.toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <div className="aspect-square bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center p-6 text-center">
              <svg
                className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No AI output yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Enter a prompt and click Generate
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
