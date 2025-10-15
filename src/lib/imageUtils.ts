/**
 * Utility functions for image processing
 */

/**
 * Normalizes image orientation based on EXIF data
 * This prevents images from being rotated incorrectly when uploaded
 *
 * @param file - The original image file
 * @returns A new File object with corrected orientation
 */
export async function normalizeImageOrientation(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Create a FileReader to read the image
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Create a canvas to draw the corrected image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Read EXIF orientation
        getOrientation(file, (orientation) => {
          // Set canvas dimensions based on orientation
          if (orientation > 4 && orientation < 9) {
            // Orientations 5-8 require width/height swap
            canvas.width = img.height;
            canvas.height = img.width;
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }

          // Apply transformation based on EXIF orientation
          switch (orientation) {
            case 2:
              // Horizontal flip
              ctx.transform(-1, 0, 0, 1, img.width, 0);
              break;
            case 3:
              // 180° rotation
              ctx.transform(-1, 0, 0, -1, img.width, img.height);
              break;
            case 4:
              // Vertical flip
              ctx.transform(1, 0, 0, -1, 0, img.height);
              break;
            case 5:
              // Vertical flip + 90° rotation
              ctx.transform(0, 1, 1, 0, 0, 0);
              break;
            case 6:
              // 90° rotation
              ctx.transform(0, 1, -1, 0, img.height, 0);
              break;
            case 7:
              // Horizontal flip + 90° rotation
              ctx.transform(0, -1, -1, 0, img.height, img.width);
              break;
            case 8:
              // 270° rotation
              ctx.transform(0, -1, 1, 0, 0, img.width);
              break;
            default:
              // No transformation needed (orientation 1 or undefined)
              break;
          }

          // Draw the image with correct orientation
          ctx.drawImage(img, 0, 0);

          // Convert canvas to blob as PNG format
          // PNG doesn't preserve EXIF data, which ensures the rotation is baked into the image
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            // Create a new File from the blob as PNG
            // Change the file extension to .png and set type to image/png
            const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
            const correctedFile = new File([blob], `${originalName}.png`, {
              type: 'image/png',
              lastModified: Date.now(),
            });

            resolve(correctedFile);
          }, 'image/png');
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Reads EXIF orientation from image file
 *
 * @param file - The image file to read
 * @param callback - Callback function that receives the orientation value (1-8)
 */
function getOrientation(file: File, callback: (orientation: number) => void): void {
  const reader = new FileReader();

  reader.onload = (e) => {
    const view = new DataView(e.target?.result as ArrayBuffer);

    if (view.getUint16(0, false) !== 0xFFD8) {
      // Not a JPEG file
      callback(1);
      return;
    }

    const length = view.byteLength;
    let offset = 2;

    while (offset < length) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === 0xFFE1) {
        // EXIF marker
        const exifOffset = offset;

        if (view.getUint32(offset += 2, false) !== 0x45786966) {
          // Not valid EXIF data
          callback(1);
          return;
        }

        const little = view.getUint16(offset += 6, false) === 0x4949;
        offset += view.getUint32(offset + 4, little);
        const tags = view.getUint16(offset, little);
        offset += 2;

        for (let i = 0; i < tags; i++) {
          const tagOffset = offset + (i * 12);
          if (view.getUint16(tagOffset, little) === 0x0112) {
            // Orientation tag found
            const orientation = view.getUint16(tagOffset + 8, little);
            callback(orientation);
            return;
          }
        }
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break;
      } else {
        offset += view.getUint16(offset, false);
      }
    }

    // No orientation tag found
    callback(1);
  };

  reader.onerror = () => {
    callback(1);
  };

  reader.readAsArrayBuffer(file);
}
