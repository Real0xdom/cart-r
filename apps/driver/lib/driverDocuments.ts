import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "@/lib/supabase";

export const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
export const DRIVER_DOCUMENT_MAX_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  webp: "image/webp",
};

const SAFE_STORAGE_URL_SEGMENTS = [
  `/storage/v1/object/public/${DRIVER_DOCUMENTS_BUCKET}/`,
  `/storage/v1/object/sign/${DRIVER_DOCUMENTS_BUCKET}/`,
  `/storage/v1/object/authenticated/${DRIVER_DOCUMENTS_BUCKET}/`,
];

export type DriverDocumentId = "insurance" | "license" | "rc" | "vehicle";

export interface PickedDriverDocument {
  mimeType: string;
  name: string;
  size: number | null;
  uri: string;
}

export interface UploadedDriverDocument {
  fileName: string;
  mimeType: string;
  publicUrl: string;
}

export function isPdfDocument(reference?: string | null) {
  return getDocumentExtension(reference) === "pdf";
}

export function isImageDocument(reference?: string | null) {
  const extension = getDocumentExtension(reference);
  return extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp";
}

export function isSupportedDocumentReference(reference?: string | null) {
  const extension = getDocumentExtension(reference);
  if (!extension || !EXTENSION_TO_MIME[extension]) {
    return false;
  }

  if (!reference) {
    return false;
  }

  if (!reference.startsWith("http://") && !reference.startsWith("https://")) {
    return true;
  }

  try {
    const parsed = new URL(reference);
    const supabaseOrigin = process.env.EXPO_PUBLIC_SUPABASE_URL
      ? new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).origin
      : null;

    if (supabaseOrigin && parsed.origin !== supabaseOrigin) {
      return false;
    }

    return SAFE_STORAGE_URL_SEGMENTS.some((segment) => parsed.pathname.includes(segment));
  } catch {
    return false;
  }
}

export async function pickDriverDocumentFromDevice() {
  let documentPickerModule: {
    getDocumentAsync: (options: {
      copyToCacheDirectory: boolean;
      multiple: boolean;
      type: string[];
    }) => Promise<{
      assets?: Array<{
        mimeType?: string | null;
        name?: string | null;
        size?: number | null;
        uri: string;
      }>;
      canceled: boolean;
    }>;
  };

  try {
    documentPickerModule = await import("expo-document-picker");
  } catch {
    throw new Error(
      "Choosing files from the device needs a rebuilt app. Camera photos can still work in this build, but PDF/gallery picking will work after you rebuild the app."
    );
  }

  const result = await documentPickerModule.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: [...ALLOWED_MIME_TYPES],
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return normalizePickedDocument({
    mimeType: result.assets[0].mimeType,
    name: result.assets[0].name,
    size: result.assets[0].size,
    uri: result.assets[0].uri,
  });
}

export function normalizeImageAsset(asset: ImagePickerAsset): PickedDriverDocument {
  const extension = getDocumentExtension(asset.fileName || asset.uri) || "jpg";
  const mimeType = normalizeMimeType(asset.mimeType, extension);

  return {
    mimeType,
    name: asset.fileName || `document.${extension}`,
    size: asset.fileSize ?? null,
    uri: asset.uri,
  };
}

export async function uploadDriverDocument(params: {
  documentId: DriverDocumentId;
  file: PickedDriverDocument;
  userId: string;
}) {
  const file = normalizePickedDocument(params.file);
  validateDocumentSelection(file);

  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  validateDocumentSignature(arrayBuffer, file.mimeType);

  const extension = getDocumentExtension(file.name) || "jpg";
  const safeName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
  const fileName = `${params.userId}/${params.documentId}_${Date.now()}_${safeName}.${extension}`;

  const { error } = await supabase.storage
    .from(DRIVER_DOCUMENTS_BUCKET)
    .upload(fileName, arrayBuffer, {
      cacheControl: "3600",
      contentType: file.mimeType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(DRIVER_DOCUMENTS_BUCKET)
    .getPublicUrl(fileName);

  return {
    fileName,
    mimeType: file.mimeType,
    publicUrl: data.publicUrl,
  } satisfies UploadedDriverDocument;
}

function normalizePickedDocument(file: {
  mimeType?: string | null;
  name?: string | null;
  size?: number | null;
  uri: string;
}) {
  const extension = getDocumentExtension(file.name || file.uri);
  const mimeType = normalizeMimeType(file.mimeType, extension);

  return {
    mimeType,
    name: file.name || `document.${extension || "jpg"}`,
    size: file.size ?? null,
    uri: file.uri,
  } satisfies PickedDriverDocument;
}

function normalizeMimeType(mimeType?: string | null, extension?: string | null) {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return mimeType.toLowerCase();
  }

  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension];
  }

  return "application/octet-stream";
}

function validateDocumentSelection(file: PickedDriverDocument) {
  const extension = getDocumentExtension(file.name || file.uri);

  if (!extension || !EXTENSION_TO_MIME[extension]) {
    throw new Error("Only JPG, PNG, WEBP, or PDF files are allowed.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    throw new Error("Unsupported file type. Please upload a JPG, PNG, WEBP, or PDF.");
  }

  if (file.size && file.size > DRIVER_DOCUMENT_MAX_SIZE_BYTES) {
    throw new Error("File is too large. Please upload a file smaller than 15 MB.");
  }
}

function validateDocumentSignature(buffer: ArrayBuffer, mimeType: string) {
  const bytes = new Uint8Array(buffer);

  if (mimeType === "application/pdf" && matchesSignature(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return;
  }

  if (mimeType === "image/jpeg" && matchesSignature(bytes, [0xff, 0xd8, 0xff])) {
    return;
  }

  if (
    mimeType === "image/png" &&
    matchesSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return;
  }

  if (
    mimeType === "image/webp" &&
    matchesAscii(bytes, 0, "RIFF") &&
    matchesAscii(bytes, 8, "WEBP")
  ) {
    return;
  }

  throw new Error("This file does not look like a valid image or PDF.");
}

function matchesSignature(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function matchesAscii(bytes: Uint8Array, start: number, value: string) {
  if (bytes.length < start + value.length) {
    return false;
  }

  return value.split("").every((char, index) => bytes[start + index] === char.charCodeAt(0));
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "document";
}

function getDocumentExtension(value?: string | null) {
  if (!value) {
    return null;
  }

  const cleanValue = value.split("?")[0].split("#")[0];
  const match = cleanValue.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? null;
}
