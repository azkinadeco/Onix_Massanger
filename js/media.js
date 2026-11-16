// Penyimpanan media besar (video & file) di IndexedDB.
// Nanti diganti upload ke storage server (S3 / Supabase Storage / Firebase Storage).
const DB = 'onix-media', STORE = 'blobs';
let dbp;
function open() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}

export async function putMedia(blob) {
  const id = 'md' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await tx('readwrite', s => s.put(blob, id));
  return id;
}
const urls = new Map();
export async function mediaURL(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await tx('readonly', s => s.get(id));
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}
export function clearMedia() { try { indexedDB.deleteDatabase(DB); } catch { /* */ } }

export const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
export const fileExt = name => (name.split('.').pop() || '').slice(0, 4).toUpperCase();

// Ambil thumbnail + durasi dari file video
export function videoInfo(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    let done = false;
    const finish = (thumb) => {
      if (done) return; done = true;
      const out = { thumb, duration: Math.round(v.duration || 0), w: v.videoWidth || 16, h: v.videoHeight || 9 };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.addEventListener('loadeddata', () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch { finish(null); } });
    v.addEventListener('seeked', () => {
      try {
        const k = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        finish(c.toDataURL('image/jpeg', 0.7));
      } catch { finish(null); }
    });
    v.addEventListener('error', () => finish(null));
    setTimeout(() => finish(null), 6000);
    v.load();
  });
}
