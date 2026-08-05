/**
 * Read a single File as a data URL (legacy, kept for backward compatibility).
 */
export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Read multiple Files as data URLs (legacy, kept for backward compatibility).
 */
export async function readFilesAsDataUrls(files: FileList | null) {
  if (!files || files.length === 0) return [];
  const list = Array.from(files);
  return Promise.all(list.map((file) => readFileAsDataUrl(file)));
}

/**
 * Extract File objects from a FileList or null.
 * Used by the new FormData upload flow.
 */
export function getFileObjects(files: FileList | File[] | null): File[] {
  if (!files) return [];
  return Array.from(files);
}
