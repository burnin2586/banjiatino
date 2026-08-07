import * as FileSystem from 'expo-file-system/legacy';

export const PHOTO_DIR = `${FileSystem.documentDirectory}memory-photos/`;

export async function ensurePhotoDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

export async function savePhotoFile(sourceUri: string, photoId: string): Promise<string> {
  await ensurePhotoDir();
  const dest = `${PHOTO_DIR}${photoId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('删除照片文件失败', uri, error);
  }
}

export const STORAGE_PHOTO_DIR = `${FileSystem.documentDirectory}storage-photos/`;

export async function ensureStoragePhotoDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(STORAGE_PHOTO_DIR, { intermediates: true });
}

export async function saveStoragePhoto(sourceUri: string, photoId: string): Promise<string> {
  await ensureStoragePhotoDir();
  const dest = `${STORAGE_PHOTO_DIR}${photoId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deleteStoragePhotoFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('删除收纳照片文件失败', uri, error);
  }
}
