import * as FileSystem from 'expo-file-system/legacy';

import { PHOTO_DIR, deletePhotoFile, savePhotoFile } from '@/logic/photo-store';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
}));

describe('photo-store', () => {
  it('PHOTO_DIR 在 documentDirectory 下', () => {
    expect(PHOTO_DIR.startsWith('file:///docs/')).toBe(true);
    expect(PHOTO_DIR).toContain('memory-photos');
  });

  it('savePhotoFile 拷到 PHOTO_DIR 并返回新 uri', async () => {
    const uri = await savePhotoFile('file:///tmp/x.jpg', 'photo-9');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/x.jpg',
      to: `${PHOTO_DIR}photo-9.jpg`,
    });
    expect(uri).toBe(`${PHOTO_DIR}photo-9.jpg`);
  });

  it('savePhotoFile 先确保目录存在', async () => {
    await savePhotoFile('file:///tmp/y.jpg', 'photo-10');
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(PHOTO_DIR, {
      intermediates: true,
    });
  });

  it('deletePhotoFile 调 deleteAsync', async () => {
    await deletePhotoFile(`${PHOTO_DIR}photo-9.jpg`);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${PHOTO_DIR}photo-9.jpg`, {
      idempotent: true,
    });
  });
});
