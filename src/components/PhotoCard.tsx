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

    const token = process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN;
    if (!token) {
      setError('Replicate API token not configured');
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

      // Run Replicate
      setStatus('Processing with AI...');
      const output = await runReplicate(
        modelVersion,
        modelInput as any,
        token,
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
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      <div className="grid lg:grid-cols-3 gap-4 p-6">
        {/* Left - Input Image */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Input Image
          </h3>
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
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
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-center text-xs font-medium transition-colors"
            >
              Download
            </a>
            <button
              onClick={() => setShowInputQR(!showInputQR)}
              className="flex-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors"
            >
              {showInputQR ? 'Hide' : 'Show'} QR
            </button>
          </div>

          {showInputQR && (
            <div className="bg-white p-3 rounded-lg border-2 border-blue-200 flex justify-center">
              <QRCodeSVG value={photo.url} size={150} level="H" />
            </div>
          )}

          <p className="text-xs text-gray-500">
            Uploaded: {photo.uploadedAt.toLocaleString()}
          </p>
        </div>

        {/* Middle - AI Controls */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">AI Processing</h3>

          <div>
            <label
              htmlFor={`prompt-${photo.id}`}
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Prompt
            </label>
            <textarea
              id={`prompt-${photo.id}`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={processing}
              placeholder="Describe the transformation you want..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-500 text-sm"
              rows={5}
            />
          </div>

          <button
            onClick={handleRunAI}
            disabled={processing || !prompt.trim()}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 text-xs">{status}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-xs font-medium">{error}</p>
            </div>
          )}

          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
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
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            AI Output
          </h3>

          {aiOutputUrl ? (
            <>
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
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
                  className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-center text-xs font-medium transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => setShowOutputQR(!showOutputQR)}
                  className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-medium transition-colors"
                >
                  {showOutputQR ? 'Hide' : 'Show'} QR
                </button>
              </div>

              {showOutputQR && (
                <div className="bg-white p-3 rounded-lg border-2 border-green-200 flex justify-center">
                  <QRCodeSVG value={aiOutputUrl} size={150} level="H" />
                </div>
              )}

              {photo.aiProcessedAt && (
                <p className="text-xs text-gray-500">
                  Processed: {photo.aiProcessedAt.toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <div className="aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-6 text-center">
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
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
              <p className="text-sm text-gray-500">
                No AI output yet
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Enter a prompt and click Generate
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
