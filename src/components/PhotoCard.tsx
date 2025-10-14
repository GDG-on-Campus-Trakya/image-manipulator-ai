'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'input' | 'ai' | 'remove' | null>(null);
  const [deletingAi, setDeletingAi] = useState(false);
  const [removingFromDashboard, setRemovingFromDashboard] = useState(false);
  const [inputRotation, setInputRotation] = useState(0);
  const [outputRotation, setOutputRotation] = useState(0);

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
        prompt: prompt,
        image: [photo.url], // Use Firebase Storage URL
        aspect_ratio: 'match_input_image',
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

  const handleDeleteInput = async () => {
    if (showDeleteConfirm !== 'input') {
      setShowDeleteConfirm('input');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      // Delete from Firebase Storage - input image
      const inputStorageRef = ref(storage, photo.storagePath);
      await deleteObject(inputStorageRef);

      // Delete AI output from storage if it exists (input deletion deletes everything)
      if (photo.aiOutputStoragePath) {
        const outputStorageRef = ref(storage, photo.aiOutputStoragePath);
        await deleteObject(outputStorageRef);
      }

      // Delete from Firestore (removes entire photo document)
      const photoDoc = doc(db, `sessions/${sessionId}/photos`, photo.id);
      await deleteDoc(photoDoc);

      // Note: The photo will be removed from UI automatically via the Firestore listener in the parent component
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleDeleteAi = async () => {
    if (showDeleteConfirm !== 'ai') {
      setShowDeleteConfirm('ai');
      return;
    }

    setDeletingAi(true);
    setError(null);

    try {
      // Delete AI output from storage only
      if (photo.aiOutputStoragePath) {
        const outputStorageRef = ref(storage, photo.aiOutputStoragePath);
        await deleteObject(outputStorageRef);
      }

      // Update Firestore to remove AI fields (keeps input image)
      const photoDoc = doc(db, `sessions/${sessionId}/photos`, photo.id);
      await updateDoc(photoDoc, {
        aiOutputUrl: null,
        aiOutputStoragePath: null,
        aiProcessedAt: null,
      });

      // Update local state
      setAiOutputUrl(null);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Delete AI error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete AI output');
      setShowDeleteConfirm(null);
    } finally {
      setDeletingAi(false);
    }
  };

  const handleRemoveFromDashboard = async () => {
    if (showDeleteConfirm !== 'remove') {
      setShowDeleteConfirm('remove');
      return;
    }

    setRemovingFromDashboard(true);
    setError(null);

    try {
      // Only delete from Firestore - keep files in storage
      const photoDoc = doc(db, `sessions/${sessionId}/photos`, photo.id);
      await deleteDoc(photoDoc);

      // Note: The photo will be removed from UI automatically via the Firestore listener in the parent component
    } catch (err) {
      console.error('Remove from dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove from dashboard');
      setRemovingFromDashboard(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const handleRotateInput = () => {
    setInputRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateOutput = () => {
    setOutputRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Card Header with Remove Button */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Photo ID: <span className="font-mono text-xs">{photo.id.slice(0, 8)}...</span>
        </h2>
        <button
          onClick={handleRemoveFromDashboard}
          disabled={removingFromDashboard || showDeleteConfirm === 'remove'}
          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          title="Remove from dashboard (files remain in storage)"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
            />
          </svg>
          Remove from Dashboard
        </button>
      </div>

      {/* Delete confirmation banner */}
      {showDeleteConfirm && (
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-800 dark:text-red-200 font-medium">
                {showDeleteConfirm === 'input'
                  ? 'Delete the original image? This will also delete the AI output from storage.'
                  : showDeleteConfirm === 'ai'
                  ? 'Delete the AI-generated image from storage? The original will be kept.'
                  : 'Remove this element from the dashboard? Files will remain in storage.'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelDelete}
                disabled={deleting || deletingAi || removingFromDashboard}
                className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={
                  showDeleteConfirm === 'input'
                    ? handleDeleteInput
                    : showDeleteConfirm === 'ai'
                    ? handleDeleteAi
                    : handleRemoveFromDashboard
                }
                disabled={deleting || deletingAi || removingFromDashboard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(deleting || deletingAi || removingFromDashboard) ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
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
                    {showDeleteConfirm === 'remove' ? 'Removing...' : 'Deleting...'}
                  </>
                ) : (
                  showDeleteConfirm === 'remove' ? 'Remove' : 'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 p-6">
        {/* Left - Input Image */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Input Image
            </h3>
            <button
              onClick={handleDeleteInput}
              disabled={deleting || showDeleteConfirm === 'input'}
              className="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
              title="Delete original image (and AI output)"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
          <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
            <img
              src={photo.url}
              alt="Input photo"
              className="w-full h-full object-contain transition-transform duration-300"
              style={{ transform: `rotate(${inputRotation}deg)` }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRotateInput}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
              title="Rotate 90°"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Rotate
            </button>
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              AI Output
            </h3>
            {aiOutputUrl && (
              <button
                onClick={handleDeleteAi}
                disabled={deletingAi || showDeleteConfirm === 'ai'}
                className="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                title="Delete AI output only (keep original)"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            )}
          </div>

          {aiOutputUrl ? (
            <>
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                <img
                  src={aiOutputUrl}
                  alt="AI output"
                  className="w-full h-full object-contain transition-transform duration-300"
                  style={{ transform: `rotate(${outputRotation}deg)` }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRotateOutput}
                  className="px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  title="Rotate 90°"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Rotate
                </button>
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
