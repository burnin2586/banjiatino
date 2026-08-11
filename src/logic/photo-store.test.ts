import FileSystem from 'react-native-fs';

import {
  PHOTO_DIR,
  STORAGE_PHOTO_DIR,
  deletePhotoFile,
  deleteStoragePhotoFile,
  savePhotoFile,
  saveStoragePhoto,
} from '@/logic/photo-store';

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/docs',
    mkdir: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
  },
}));

describe('photo-store', () => {
  it('PHOTO_DIR 在 documentDirectory 下', () => {
    expect(PHOTO_DIR.startsWith('/docs/')).toBe(true);
    expect(PHOTO_DIR).toContain('memory-photos');
  });

  it('savePhotoFile 拷到 PHOTO_DIR 并返回新 uri', async () => {
    const uri = await savePhotoFile('file:///tmp/x.jpg', 'photo-9');
    expect(FileSystem.copyFile).toHaveBeenCalledWith('/tmp/x.jpg', `${PHOTO_DIR}photo-9.jpg`);
    expect(uri).toBe(`file://${PHOTO_DIR}photo-9.jpg`);
  });

  it('savePhotoFile 先确保目录存在', async () => {
    await savePhotoFile('file:///tmp/y.jpg', 'photo-10');
    expect(FileSystem.mkdir).toHaveBeenCalledWith(PHOTO_DIR);
  });

  it('deletePhotoFile 删除存在的文件', async () => {
    await deletePhotoFile(`${PHOTO_DIR}photo-9.jpg`);
    expect(FileSystem.unlink).toHaveBeenCalledWith(`${PHOTO_DIR}photo-9.jpg`);
  });
});

describe('storage photo store', () => {
  it('STORAGE_PHOTO_DIR 在 documentDirectory 下', () => {
    expect(STORAGE_PHOTO_DIR).toContain('storage-photos');
  });

  it('saveStoragePhoto 拷到 STORAGE_PHOTO_DIR 并返回 uri', async () => {
    const uri = await saveStoragePhoto('file:///tmp/s.jpg', 'sp-1');
    expect(FileSystem.copyFile).toHaveBeenCalledWith('/tmp/s.jpg', `${STORAGE_PHOTO_DIR}sp-1.jpg`);
    expect(uri).toBe(`file://${STORAGE_PHOTO_DIR}sp-1.jpg`);
  });

  it('deleteStoragePhotoFile 删除存在的文件', async () => {
    await deleteStoragePhotoFile(`${STORAGE_PHOTO_DIR}sp-1.jpg`);
    expect(FileSystem.unlink).toHaveBeenCalledWith(`${STORAGE_PHOTO_DIR}sp-1.jpg`);
  });
});
