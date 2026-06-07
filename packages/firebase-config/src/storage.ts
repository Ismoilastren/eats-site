// =============================================
// Firebase Storage Instance & Re-exports
// =============================================

import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { app } from './app';

export const storage: FirebaseStorage = getStorage(app);

export {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  type StorageReference,
  type UploadResult,
  type UploadTask,
} from 'firebase/storage';
