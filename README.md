# AI Image Manipulator

A Next.js application that allows mobile photo uploads and real-time AI image processing through a desktop dashboard. Built with Firebase Storage and Replicate AI.

## Features

- **Password Protection**: Simple password authentication to secure access
- **Mobile Upload**: Capture and upload photos from mobile devices
- **Real-time Sync**: Photos appear instantly on the dashboard via Firestore
- **AI Processing**: Process images with Replicate AI using custom prompts
- **QR Code Generation**: Generate QR codes for easy photo sharing
- **Session-based**: Organize photos by session for better management

## Architecture

### Routes

- `/` - Home page with session creation
- `/m/[sessionId]` - Mobile upload interface
- `/d/[sessionId]` - Desktop dashboard with AI controls

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4
- **Storage**: Firebase Storage
- **Database**: Firestore
- **AI**: Replicate API
- **QR Codes**: qrcode.react

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firebase Storage and Firestore
3. Get your Firebase configuration from Project Settings

### 3. Replicate Setup

1. Sign up at [replicate.com](https://replicate.com)
2. Get your API token from [Account Settings](https://replicate.com/account)
3. Choose a model version from [Replicate Explore](https://replicate.com/explore)

Popular models for image processing:
- **BLIP Image Captioning**: `Salesforce/blip`
- **LLaVA Vision**: `yorickvp/llava-13b`
- **Stable Diffusion**: `stability-ai/stable-diffusion`

### 4. Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Copy the example file
cp .env.local.example .env.local
```

Fill in your credentials:

```env
# Site Password Protection
NEXT_PUBLIC_SITE_PASSWORD=your_secure_password_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Replicate Configuration
NEXT_PUBLIC_REPLICATE_API_TOKEN=r8_your_token_here
NEXT_PUBLIC_REPLICATE_MODEL_VERSION=your_model_version_here
```

**Important**: Change `NEXT_PUBLIC_SITE_PASSWORD` to a secure password. This password will be required to access the entire application.

### 5. Firebase Security Rules

#### Storage Rules

Set up Storage rules for demo purposes (adjust for production):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Input images from mobile uploads
    match /stant_images/input/{sessionId}/{imageId} {
      allow read: if true;
      allow write: if true;
    }

    // AI processed output images
    match /stant_images/ai/{sessionId}/{imageId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

#### Firestore Rules

Set up Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{sessionId}/photos/{photoId} {
      allow read, write: if true;
    }
    match /sessions/{sessionId}/aiResponses/{responseId} {
      allow read, write: if true;
    }
  }
}
```

**Note**: These rules are permissive for demo purposes. In production, implement proper authentication and authorization.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Login

1. Open the application in your browser
2. Enter the password you set in `NEXT_PUBLIC_SITE_PASSWORD`
3. Password is stored in browser session storage (valid until browser is closed)

### 2. Create a Session

1. Navigate to the home page
2. Click "Generate ID" to create a new session ID
3. Copy the session ID for later use

### 3. Upload Photos (Mobile)

1. Open `/m/[sessionId]` on your mobile device
2. Tap to upload or use camera to capture
3. Photos are automatically uploaded to Firebase Storage

### 4. Process with AI (Desktop)

1. Open `/d/[sessionId]` on your desktop
2. Photos appear in real-time
3. Enter a prompt for each image
4. Click "Generate AI Image" to process
5. View AI output on the right side

### 5. Share Photos

- Click "Show QR" to generate a QR code for the image URL
- Click "Download" to save the original image

## Storage Structure

Firebase Storage is organized as follows:

```
stant_images/
├── input/              # Original uploaded images
│   └── {sessionId}/
│       └── {timestamp}.jpg
└── ai/                 # AI processed output images
    └── {sessionId}/
        └── {photoId}_{timestamp}.jpg
```

## Firestore Data Schema

```
sessions/
  {sessionId}/
    photos/
      {photoId}
        - url: string                    # Input image URL
        - storagePath: string            # Storage path for input
        - uploadedAt: timestamp
        - aiOutputUrl?: string           # AI output image URL
        - aiOutputStoragePath?: string   # Storage path for AI output
        - aiProcessedAt?: timestamp
    aiResponses/
      {responseId}
        - photoId: string
        - prompt: string
        - outputImageUrl: string         # AI generated image URL
        - outputImageStoragePath: string # Storage path in stant_images/ai
        - status: string                 # 'processing' | 'succeeded' | 'failed'
        - error?: string
        - createdAt: timestamp
```

## API Integration

### Replicate API

The app uses Replicate's REST API for AI processing:

1. **Create Prediction**: POST `/v1/predictions`
2. **Poll Status**: GET `/v1/predictions/{id}`
3. **Get Result**: Retrieved when status is "succeeded"

#### Model Input Format

The application sends the following parameters to Replicate:

```javascript
{
  size: "1K",
  width: 2048,
  height: 2048,
  prompt: "user's prompt text",
  max_images: 1,
  image_input: ["https://firebasestorage.googleapis.com/..."],  // Firebase Storage URL
  aspect_ratio: "match_input_image",
  sequential_image_generation: "disabled"
}
```

#### Processing Flow

1. **User uploads image** → Saved to `stant_images/input/{sessionId}/`
2. **User enters prompt** → Sent to Replicate with image URL
3. **Replicate processes** → Returns AI-generated image URL
4. **Download AI output** → Fetch image from Replicate's temporary URL
5. **Save to Firebase** → Upload to `stant_images/ai/{sessionId}/`
6. **Update metadata** → Store URLs and timestamps in Firestore

See [src/lib/replicate.ts](src/lib/replicate.ts) and [src/components/PhotoCard.tsx](src/components/PhotoCard.tsx) for implementation details.

## Security Considerations

**Important**: This is a demo application with client-side API calls.

For production:

1. Move Replicate API calls to server-side API routes
2. Implement proper authentication
3. Add rate limiting
4. Secure Firebase rules
5. Validate file uploads
6. Add environment-specific configs

## Troubleshooting

### Firebase Connection Issues

- Verify environment variables are set correctly
- Check Firebase console for API key restrictions
- Ensure Firestore and Storage are enabled

### Replicate API Errors

- Verify API token is valid
- Check model version is correct
- Ensure input format matches model requirements
- Monitor rate limits

### Image Upload Fails

- Check file size (default limit: 10MB)
- Verify Storage bucket name
- Check CORS settings in Firebase

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home page
│   ├── layout.tsx            # Root layout with password protection
│   ├── m/[sessionId]/        # Mobile upload
│   └── d/[sessionId]/        # Desktop dashboard
├── components/
│   ├── PasswordProtection.tsx # Password authentication
│   └── PhotoCard.tsx         # Photo display component
├── lib/
│   ├── firebase.ts           # Firebase initialization
│   └── replicate.ts          # Replicate API client
└── types/
    └── index.ts              # TypeScript types
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
