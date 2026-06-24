import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

// Infer a reasonable MIME type from filename when the picker returns none
const guessMime = (name = '', fallback = 'application/octet-stream') => {
  const ext = name.split('.').pop()?.toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv',
    zip: 'application/zip', mp4: 'video/mp4',
  };
  return map[ext] || fallback;
};

export const pickAndUploadMedia = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',           // accept everything — no extension restriction
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const safeName = (asset.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `chat/${Date.now()}_${safeName}`;

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const contentType =
    (asset.mimeType && asset.mimeType !== 'application/octet-stream')
      ? asset.mimeType
      : guessMime(asset.name, blob.type || 'application/octet-stream');

  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, blob, { contentType, upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('chat-media')
    .getPublicUrl(path);

  return publicUrl;
};

export const isImageUrl = (url) =>
  /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);

export const getFileIcon = (url) => {
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return '🖼️';
  if (/\.pdf(\?|$)/i.test(url)) return '📄';
  if (/\.(doc|docx)(\?|$)/i.test(url)) return '📝';
  if (/\.(xls|xlsx|csv)(\?|$)/i.test(url)) return '📊';
  if (/\.(ppt|pptx)(\?|$)/i.test(url)) return '📑';
  if (/\.(zip|rar)(\?|$)/i.test(url)) return '🗜️';
  if (/\.(mp4|mov|avi)(\?|$)/i.test(url)) return '🎬';
  return '📎';
};

export const getFileName = (url) => {
  try {
    const decoded = decodeURIComponent(url.split('?')[0]);
    const last = decoded.split('/').pop() || 'File';
    // Strip the timestamp prefix added during upload (e.g. "1718000000_report.pdf" → "report.pdf")
    return last.replace(/^\d+_/, '');
  } catch {
    return 'File';
  }
};
