/**
 * Utility to compress image files client-side before storing or uploading
 */
export async function compressImageFile(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // WebP natively supports alpha transparency and lossy compression
          try {
            const webpData = canvas.toDataURL('image/webp', quality);
            if (webpData && webpData.startsWith('data:image/webp') && webpData.length < (e.target?.result as string).length) {
              resolve(webpData);
              return;
            }
          } catch (_) {}

          const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
          if (isPng) {
            // Se for PNG e WebP falhar, reduz escala se for excessivamente grande
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(canvas.toDataURL('image/jpeg', quality));
          }
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
}
