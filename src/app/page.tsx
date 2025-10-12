'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');

  const generateSessionId = () => {
    const id = Math.random().toString(36).substring(2, 10);
    setSessionId(id);
  };

  const goToMobileUpload = () => {
    if (sessionId) {
      router.push(`/m/${sessionId}`);
    }
  };

  const goToDashboard = () => {
    if (sessionId) {
      router.push(`/d/${sessionId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            AI Image Manipulator
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Upload photos from mobile, process with AI on desktop
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Create or Join Session
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Generate a new session ID or enter an existing one to get started
              </p>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Enter session ID"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                onClick={generateSessionId}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                Generate ID
              </button>
            </div>

            {sessionId && (
              <div className="grid sm:grid-cols-2 gap-4 pt-4">
                <button
                  onClick={goToMobileUpload}
                  className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Mobile Upload
                </button>
                <button
                  onClick={goToDashboard}
                  className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Dashboard
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
            How it works:
          </h3>
          <ol className="space-y-2 text-blue-800 dark:text-blue-300">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Generate a session ID or use an existing one</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Open the mobile upload page on your phone to capture photos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>View photos in real-time on the dashboard</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Use AI to process images with custom prompts</span>
            </li>
          </ol>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by Firebase Storage and Replicate AI</p>
        </div>
      </div>
    </div>
  );
}
