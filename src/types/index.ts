export interface Photo {
  id: string;
  url: string;
  storagePath?: string;
  uploadedAt: Date;
  aiOutputUrl?: string; // URL of the AI processed image
  aiOutputStoragePath?: string; // Storage path of AI output
  aiProcessedAt?: Date;
}

export interface AIResponse {
  id: string;
  photoId: string;
  prompt: string;
  responseText?: string;
  responseJson?: any;
  outputImageUrl?: string; // AI generated/processed image URL
  outputImageStoragePath?: string; // Storage path in stant_images/ai
  status: 'processing' | 'succeeded' | 'failed';
  error?: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  createdAt: Date;
}

export interface ReplicateModelInput {
  size: string;
  width: number;
  height: number;
  prompt: string;
  max_images: number;
  image: string[]; // Array of image URLs
  aspect_ratio: string;
  sequential_image_generation: string;
}
