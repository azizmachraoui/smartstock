import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

export interface UploadResult {
  url: string;
  provider: 'local' | 'cloudinary';
}

export async function saveImageFile(file: Express.Multer.File): Promise<UploadResult> {
  const hasCloudinary = Boolean(
    env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  );

  if (hasCloudinary) {
    try {
      // Dynamic require to prevent compilation failure when cloudinary package is optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cloudinary = require('cloudinary');
      const v2 = cloudinary.v2;
      if (env.CLOUDINARY_URL) {
        v2.config({ cloudinary_url: env.CLOUDINARY_URL });
      } else {
        v2.config({
          cloud_name: env.CLOUDINARY_CLOUD_NAME,
          api_key: env.CLOUDINARY_API_KEY,
          api_secret: env.CLOUDINARY_API_SECRET,
        });
      }
      const res = await v2.uploader.upload(file.path, {
        folder: 'smartstock/products',
        resource_type: 'image',
      });
      fs.unlink(file.path, () => {});
      return { url: res.secure_url, provider: 'cloudinary' };
    } catch {
      console.warn('[STORAGE] Cloudinary upload attempted but module or upload failed; falling back to local file storage.');
    }
  }

  // Local uploads fallback
  const filename = path.basename(file.path);
  return {
    url: `/uploads/${filename}`,
    provider: 'local',
  };
}

export function deleteImageFile(imageUrl?: string | null): void {
  if (!imageUrl) return;
  if (imageUrl.startsWith('/uploads/')) {
    const fullPath = path.join(process.cwd(), imageUrl);
    fs.unlink(fullPath, () => {});
  }
}
