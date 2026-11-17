// Fitur khas Onix (nggak ada di app chat lain)
import { api, bus, ME, firstName } from './service.js';
import { esc } from './util.js';
import { icon } from './icons.js';

// item tambahan di menu + : [aksi, ikon, label, warna]
export const FUN_ITEMS = [];

/* ============ MODE KALEM ============
   Pesan yang kelihatan lagi emosi -> ditawarin tahan dulu sebelum kekirim */
const RUDE = /(^|[^a-z])(anjing|anjg|anjrit|bangsat|bgst|goblok|goblog|gblk|tolol|bego|kampret|brengsek|bajingan|sialan|idiot|bodoh|tai|taik|fuck|shit|wtf|njing|kontol|memek)(?=$|[^a-z])/i;
export function calmReason(text) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (RUDE.test(text)) return 'kasar';
  if (letters.length >= 10 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) return 'caps';
  if (/[!?]{4,}/.test(text)) return 'seru';
  const h = new Date().getHours();
  if (h < 4 && text.length > 140) return 'malam';
  return null;
}
const CALM_TXT = { kasar: 'Kata-katanya agak pedes', caps: 'Kayaknya lagi teriak nih', seru: 'Tanda serunya banyak banget', malam: 'Udah larut, pesannya panjang' };
export const calmOn = () => api.settings().calm !== false;
// return 'send' | 'hold' | 'edit'
export function calmSheet(reason, text) {
  return new Promise(async resolve => {
    const { sheet } = await import('./ui.js');
    let picked = 'edit';
    await sheet({
      top: `<div class="calm">
        <div class="calm-orb"><i></i><i></i><span>🫧</span></div>
        <b>Tarik napas dulu?</b>
        <small>${esc(CALM_TXT[reason] || '')}</small>
        <div class="calm-msg">${esc(text.length > 160 ? text.slice(0, 160) + '…' : text)}</div>
        <div class="calm-btns">
          <button class="btn primary wide" data-c="hold">${icon('clock', 'tiny')} Tahan 10 menit</button>
          <div class="calm-row"><button class="btn ghost" data-c="edit">Ubah dulu</button><button class="btn ghost" data-c="send">Kirim aja</button></div>
        </div>
      </div>`,
      onMount: (s, close) => s.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { picked = b.dataset.c; close(); } }),
    });
    resolve(picked);
  });
}

/* ============ BATAL KIRIM ============ */
export const UNDO_MS = 3000;
export const undoOn = () => api.settings().undoSend !== false;
