import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

/**
 * Converte Uint8Array para Base64 de forma eficiente e segura para grandes payloads
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB por chunk para evitar estouro de stack
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return typeof window !== 'undefined' && window.btoa ? window.btoa(binary) : '';
}

/**
 * Converte string Base64 de volta para Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  if (typeof window === 'undefined' || !window.atob) return new Uint8Array(0);
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Salva qualquer dado serializável no localStorage comprimido com fflate (Deflate nível 6)
 */
export function setCompressedCache<T>(key: string, data: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const jsonStr = JSON.stringify(data);
    const rawBytes = strToU8(jsonStr);
    const compressedBytes = deflateSync(rawBytes, { level: 6 });
    const base64Data = bytesToBase64(compressedBytes);
    
    window.localStorage.setItem(key, base64Data);
    return true;
  } catch (error) {
    console.warn(`[CompressedCache] Erro ao comprimir e salvar cache para "${key}":`, error);
    return false;
  }
}

/**
 * Recupera e descompacta os dados do localStorage com fflate
 */
export function getCompressedCache<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const rawStored = window.localStorage.getItem(key);
    if (!rawStored) return null;

    // Se já estiver salvo como JSON puro (legado), faz fallback suave
    if (rawStored.startsWith('{') || rawStored.startsWith('[')) {
      try {
        return JSON.parse(rawStored) as T;
      } catch {
        return null;
      }
    }

    const compressedBytes = base64ToBytes(rawStored);
    if (compressedBytes.length === 0) return null;

    const decompressedBytes = inflateSync(compressedBytes);
    const jsonStr = strFromU8(decompressedBytes);
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.warn(`[CompressedCache] Erro ao descompactar cache para "${key}":`, error);
    return null;
  }
}

/**
 * Remove uma chave do cache
 */
export function removeCompressedCache(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[CompressedCache] Erro ao remover chave "${key}":`, error);
  }
}

/**
 * Limpa todo o cache de dados financeiros de um usuário específico
 */
export function clearUserCompressedCache(userId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.includes(userId)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => window.localStorage.removeItem(k));
  } catch (error) {
    console.warn(`[CompressedCache] Erro ao limpar cache do usuário "${userId}":`, error);
  }
}
