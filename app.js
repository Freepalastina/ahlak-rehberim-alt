'use strict';

let ALL_BRANDS = [];
let filteredBrands = [];
let visibleLimit = 40;
let activeStatus = '';
let lang = localStorage.getItem('ar_lang') || 'tr';
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);

const I18N = {
  tr: {
    title: 'Ahlak Rehberim', search: 'Marka, ana firma veya alternatif yazın...', barcode: '📷 Barkod',
    allCats: 'Tüm Kategoriler', allComps: 'Tüm Ana Firmalar',
    fAll: 'Tümü', fReview: '🔴 İnceleme', fPreferred: '🟢 Tercih Edilebilir', fAlt: '⭐ Alternatifli',
    brands: 'Sonuç', more: 'Daha Fazla Göster', empty: 'Aramanıza uygun marka bulunamadı.',
    parent: 'Ana Firma', category: 'Kategori', alt: 'Alternatifler', note: 'Not', source: 'Kaynak',
    install: '📲 Yükle', bcTitle: '📷 Barkod Tara', bcPlaceholder: 'Barkod numarasını yazın...', bcSearch: 'Ara'
  },
  de: {
    title: 'Ahlak Rehberim', search: 'Marke, Mutterfirma oder Alternative...', barcode: '📷 Barcode',
    allCats: 'Alle Kategorien', allComps: 'Alle Mutterfirmen',
    fAll: 'Alle', fReview: '🔴 Prüfung', fPreferred: '🟢 Bevorzugt', fAlt: '⭐ Alternativen',
    brands: 'Ergebnisse', more: 'Mehr anzeigen', empty: 'Keine passende Marke gefunden.',
    parent: 'Mutterfirma', category: 'Kategorie', alt: 'Alternativen', note: 'Hinweis', source: 'Quelle',
    install: '📲 App', bcTitle: '📷 Barcode scannen', bcPlaceholder: 'Barcodenummer eintippen...', bcSearch: 'Suchen'
  },
  en: {
    title: 'Ahlak Rehberim', search: 'Type brand, company or alternative...', barcode: '📷 Barcode',
    allCats: 'All Categories', allComps: 'All Parent Companies',
    fAll: 'All', fReview: '🔴 Review', fPreferred: '🟢 Preferred', fAlt: '⭐ Alternatives',
    brands: 'Results', more: 'Load More', empty: 'No matching brands found.',
    parent: 'Parent Company', category: 'Category', alt: 'Alternatives', note: 'Note', source: 'Source',
    install: '📲 Install', bcTitle: '📷 Scan Barcode', bcPlaceholder: 'Enter barcode number...', bcSearch: 'Search'
  },
  ar: {
    title: 'دليلي الأخلاقي', search: 'اكتب اسم العلامة التجارية أو الشركة...', barcode: '📷 باركود',
    allCats: 'جميع الفئات', allComps: 'جميع الشركات الأم',
    fAll: 'الكل', fReview: '🔴 مراجعة', fPreferred: '🟢 مفضل', fAlt: '⭐ بدائل',
    brands: 'النتائج', more: 'عرض المزيد', empty: 'لم يتم العثور على نتائج.',
    parent: 'الشركة الأم', category: 'الفئة', alt: 'البدائل', note: 'ملاحظة', source: 'المصدر',
    install: '📲 تثبيت', bcTitle: '📷 مسح الباركود', bcPlaceholder: 'أدخل رقم الباركود...', bcSearch: 'بحث'
  }
};

function t(k) { return (I18N[lang] || I18N.tr)[k] || k; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
function norm(s) {
  return String(s ?? '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[’'`´]/g, '');
}

function getStatusType(item) {
  const d = norm(item.durum || '');
  if (d.includes('tercih') || d.includes('degil') || d.includes('preferred') || d.includes('alternatif')) return 'preferred';
  return 'review';
}

function getAlts(item) {
  if (Array.isArray(item.alternatifler)) return item.alternatifler.filter(Boolean);
  return String(item.alternatif || '').split(/[;,•]+/).map(x => x.trim()).filter(x => x && x !== '.');
}

function getSources(item) {
  if (Array.isArray(item.kaynaklar) && item.kaynaklar.length) return item.kaynaklar;
  if (item.kaynak) return [{ baslik: item.kaynak, url: /^https?:\/\//i.test(item.kaynak) ? item.kaynak : '' }];
  return [];
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  $('appTitle').textContent = t('title');
  $('searchInput').placeholder = t('search');
  $('barcodeBtn').textContent = t('barcode');
  $('fAll').textContent = t('fAll');
  $('fReview').textContent = t('fReview');
  $('fPreferred').textContent = t('fPreferred');
  $('fAlt').textContent = t('fAlt');
  $('listLabel').textContent = t('brands');
  $('loadMoreBtn').textContent = t('more');
  $('installBtn').textContent = t('install');
  $('bcTitle').textContent = t('bcTitle');
  $('manualBarcodeInput').placeholder = t('bcPlaceholder');
  $('manualBarcodeBtn').textContent = t('bcSearch');

  document.querySelectorAll('#langSwitch button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function populateFilters() {
  const cats = new Set();
  const comps = new Set();
  ALL_BRANDS.forEach(b => {
    if (b.kategori) cats.add(b.kategori.trim());
    const p = (b.anaFirma || b.anafirma || '').trim();
    if (p && p !== 'Kontrol gerekli') comps.add(p);
  });

  $('categoryFilter').innerHTML = `<option value="">${esc(t('allCats'))}</option>` +
    [...cats].sort((a, b) => a.localeCompare(b, 'tr')).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('companyFilter').innerHTML = `<option value="">${esc(t('allComps'))}</option>` +
    [...comps].sort((a, b) => a.localeCompare(b, 'tr')).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function filterAndRender(resetLimit = true) {
  if (resetLimit) visibleLimit = 40;
  const q = norm($('searchInput').value.trim());
  const cat = $('categoryFilter').value;
  const comp = $('companyFilter').value;

  $('clearSearchBtn').style.display = q ? 'block' : 'none';

  filteredBrands = ALL_BRANDS.filter(item => {
    const st = getStatusType(item);
    const alts = getAlts(item);
    if (activeStatus === 'review' && st !== 'review') return false;
    if (activeStatus === 'preferred' && st !== 'preferred') return false;
    if (activeStatus === 'alt' && !alts.length) return false;
    if (cat && (item.kategori || '').trim() !== cat) return false;
    const parent = (item.anaFirma || item.anafirma || '').trim();
    if (comp && parent !== comp) return false;
    if (q && !item._searchIndex.includes(q)) return false;
    return true;
  });

  $('resultCount').textContent = `${filteredBrands.length} / ${ALL_BRANDS.length}`;
  const grid = $('brandGrid');

  if (!filteredBrands.length) {
    grid.innerHTML = `<div class="empty-box">${esc(t('empty'))}</div>`;
    $('loadMoreBtn').style.display = 'none';
    return;
  }

  const slice = filteredBrands.slice(0, visibleLimit);
  grid.innerHTML = slice.map((item, idx) => {
    const st = getStatusType(item);
    const badgeTxt = st === 'preferred' ? t('fPreferred') : t('fReview');
    const parent = item.anaFirma || item.anafirma || '';
    const alts = getAlts(item);
    return `
      <article class="card ${st}" data-idx="${idx}">
        <div class="card-head">
          <h3>${esc(item.marka)}</h3>
          <span class="badge ${st}">${esc(badgeTxt)}</span>
        </div>
        ${parent ? `<div class="card-meta">${esc(parent)}</div>` : ''}
        ${alts.length ? `<div class="card-alt">✓ ${esc(alts.slice(0, 3).join(', '))}</div>` : ''}
      </article>
    `;
  }).join('');

  $('loadMoreBtn').style.display = filteredBrands.length > visibleLimit ? 'inline-block' : 'none';
}

function openDetail(item) {
  const st = getStatusType(item);
  const badgeTxt = st === 'preferred' ? t('fPreferred') : t('fReview');
  const parent = item.anaFirma || item.anafirma || '-';
  const alts = getAlts(item);
  const sources = getSources(item);
  const note = item.not || item.notlar || item.ozet || '-';

  $('detailBody').innerHTML = `
    <span class="badge ${st}">${esc(badgeTxt)}</span>
    <h2>${esc(item.marka)}</h2>
    <div class="info-box"><strong>${esc(t('parent'))}:</strong> ${esc(parent)}</div>
    <div class="info-box"><strong>${esc(t('category'))}:</strong> ${esc(item.kategori || '-')}</div>
    ${alts.length ? `<h4>${esc(t('alt'))}</h4><div class="alt-pills">${alts.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
    <h4>${esc(t('note'))}</h4>
    <div class="info-box">${esc(note)}</div>
    ${sources.length ? `<h4>${esc(t('source'))}</h4>${sources.map(s => `
      <div class="info-box">${s.url ? `<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.baslik || s.url)}</a>` : esc(s.baslik || '-')}</div>
    `).join('')}` : ''}
  `;
  $('detailDialog').showModal();
}

function searchBarcode(code) {
  const clean = String(code || '').trim();
  if (!clean) return;
  $('barcodeDialog').close();
  $('searchInput').value = clean;
  activeStatus = '';
  document.querySelectorAll('#quickFilters button').forEach(b => b.classList.toggle('active', b.dataset.status === ''));
  filterAndRender(true);
}

async function startBarcodeScanner() {
  $('barcodeDialog').showModal();
  $('barcodeStatus').textContent = '';
  if (!('BarcodeDetector' in window)) {
    $('barcodeStatus').textContent = 'Kamera bu tarayıcıda desteklenmiyor. Numarayı aşağıya yazabilirsiniz.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = $('barcodeVideo');
    video.srcObject = stream;
    await video.play();
    const detector = new BarcodeDetector();
    const timer = setInterval(async () => {
      if (!$('barcodeDialog').open) {
        clearInterval(timer);
        stream.getTracks().forEach(tr => tr.stop());
        return;
      }
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          clearInterval(timer);
          stream.getTracks().forEach(tr => tr.stop());
          searchBarcode(codes.rawValue);
        }
      } catch (_) {}
    }, 400);
  } catch (_) {
    $('barcodeStatus').textContent = 'Kamera açılamadı. Barkod numarasını manuel yazabilirsiniz.';
  }
}

async function loadDataFile() {
  const candidates = ['data.json', 'data/data.json', './data.json', './data/data.json'];
  for (const path of candidates) {
    try {
      const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });

