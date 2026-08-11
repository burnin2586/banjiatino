import FileSystem from 'react-native-fs';

export const PHOTO_DIR = `${FileSystem.DocumentDirectoryPath}/memory-photos/`;

function filePath(uri: string): string {
  return decodeURI(uri.replace(/^file:\/\//, ''));
}

function fileUri(path: string): string {
  return `file://${path}`;
}

export async function ensurePhotoDir(): Promise<void> {
  await FileSystem.mkdir(PHOTO_DIR);
}

export async function savePhotoFile(sourceUri: string, photoId: string): Promise<string> {
  await ensurePhotoDir();
  const dest = `${PHOTO_DIR}${photoId}.jpg`;
  await FileSystem.copyFile(filePath(sourceUri), dest);
  return fileUri(dest);
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    const path = filePath(uri);
    if (await FileSystem.exists(path)) await FileSystem.unlink(path);
  } catch (error) {
    console.warn('删除照片文件失败', uri, error);
  }
}

export const STORAGE_PHOTO_DIR = `${FileSystem.DocumentDirectoryPath}/storage-photos/`;

export async function ensureStoragePhotoDir(): Promise<void> {
  await FileSystem.mkdir(STORAGE_PHOTO_DIR);
}

export async function saveStoragePhoto(sourceUri: string, photoId: string): Promise<string> {
  await ensureStoragePhotoDir();
  const dest = `${STORAGE_PHOTO_DIR}${photoId}.jpg`;
  await FileSystem.copyFile(filePath(sourceUri), dest);
  return fileUri(dest);
}

export async function deleteStoragePhotoFile(uri: string): Promise<void> {
  try {
    const path = filePath(uri);
    if (await FileSystem.exists(path)) await FileSystem.unlink(path);
  } catch (error) {
    console.warn('删除收纳照片文件失败', uri, error);
    throw error;
  }
}
