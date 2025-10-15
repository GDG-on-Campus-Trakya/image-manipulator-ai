/**
 * Utility functions for image processing
 */

/**
 * Converts image to PNG format without any rotation or transformation
 * This preserves the original pixel orientation for AI processing
 *
 * @param file - The original image file
 * @returns A new File object in PNG format
 */
export async function normalizeImageOrientation(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Use createImageBitmap with 'none' to ignore EXIF orientation
    // This keeps the raw pixel data exactly as captured
    createImageBitmap(file, { imageOrientation: 'none' })
      .then((imageBitmap) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas dimensions to match the bitmap
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;

        // Draw the image without any transformations
        ctx.drawImage(imageBitmap, 0, 0);

        // Convert canvas to PNG blob (strips EXIF but preserves pixel orientation)
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }

          // Create a new File from the blob as PNG
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const pngFile = new File([blob], `${originalName}.png`, {
            type: 'image/png',
            lastModified: Date.now(),
          });

          resolve(pngFile);
        }, 'image/png');
      })
      .catch((err) => {
        reject(new Error(`Failed to process image: ${err.message}`));
      });
  });
}

