/**
 * High-performance browser-side image compressor for invoice scans and work notes.
 * Compresses large camera photos (5-15MB) down to 40-90KB crisp WebP/JPEG thumbnails.
 * Prevents LocalStorage QuotaExceededError and Firestore 1MB document size limits.
 */

export async function compressImage(
  source: File | string,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    // If running in non-browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      if (typeof source === 'string') return resolve(source);
      return resolve('');
    }

    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof source === 'string' ? source : '');
        return;
      }

      // Fill white background for transparent PNGs
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP if supported, fallback to JPEG
      try {
        const webpData = canvas.toDataURL('image/webp', quality);
        if (webpData.startsWith('data:image/webp')) {
          resolve(webpData);
          return;
        }
      } catch {
        // fallback
      }

      const jpegData = canvas.toDataURL('image/jpeg', quality);
      resolve(jpegData);
    };

    img.onerror = () => {
      resolve(typeof source === 'string' ? source : '');
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve('');
      };
      reader.readAsDataURL(source);
    }
  });
}
