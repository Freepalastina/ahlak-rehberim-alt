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
    title: 'Ahlak Rehberim', sub: 'Marka, ana firma ve alternatif arama',
    search: 'Marka, firma veya alternatif yazın...', barcode: '📷 Barkod',
    allCats: 'Tüm Kategoriler', allComps: 'Tüm Ana Firmalar',
    fAll: 'Tümü', fReview: '🔴 İncelenmesi Önerilir', fPreferred: '🟢 Tercih Edilebilir', fAlt: '⭐ Alternatifli',
    statTotal: 'Toplam', statReview: 'İnceleme', statPref: 'Tercih Edilebilir', statAlt: 'Alternatifli',
    brands: 'Markalar', more: 'Daha Fazla Göster', empty: 'Aramanıza uygun marka bulunamadı.',
    parent: 'Ana Firma', category: 'Kategori', alt: 'Alternatifler', note: 'Not', source: 'Kaynak',
    details: 'Detayları Gör', install: '📲 Yükle', bcTitle: '📷 Barkod Tara', bcPlaceholder: 'Barkod numarasını yazın...', bcSearch: 'Ara'
  },
  de: {
    title: 'Ahlak Rehberim', sub: 'Marken, Mutterfirmen & Alternativen suchen',
    search: 'Marke, Firma oder Alternative eintippen...', barcode: '📷 Barcode',
    allCats: 'Alle Kategorien', allComps: 'Alle Mutterfirmen',
    fAll: 'Alle', fReview: '🔴 Prüfung empfohlen', fPreferred: '🟢 Bevorzugt', fAlt: '⭐ Mit Alternativen',
    statTotal: 'Gesamt', statReview: 'Prüfung', statPref: 'Bevorzugt', statAlt: 'Alternativen',
    brands: 'Marken', more: 'Mehr anzeigen', empty: 'Keine passende Marke gefunden.',
    parent: 'Mutterfirma', category: 'Kategorie', alt: 'Alternativen', note: 'Hinweis', source: 'Quelle',
    details: 'Details ansehen', install: '📲 App', bcTitle: '📷 Barcode scannen', bcPlaceholder: 'Barcodenummer eintippen...', bcSearch: 'Suchen'
  },
  en: {
    title: 'Ahlak Rehberim', sub: 'Search brands, parent companies & alternatives',
    search: 'Type brand, company or alternative...', barcode: '📷 Barcode',
    allCats: 'All Categories', allComps: 'All Parent Companies',
    fAll: 'All', fReview: '🔴 Review Recommended', fPreferred: '🟢 Preferred', fAlt: '⭐ With Alternatives',
    statTotal: 'Total', statReview: 'Review', statPref: 'Preferred', statAlt: 'Alternatives',
    brands: 'Brands', more: 'Load More', empty: 'No matching brands found.',
    parent: 'Parent Company', category: 'Category', alt: 'Alternatives', note: 'Note', source: 'Source',
    details: 'View Details', install: '📲 Install', bcTitle: '📷 Scan Barcode', bcPlaceholder: 'Enter barcode number...', bcSearch: 'Search'
  },
  ar: {
    title: 'دليلي الأخلاقي', sub: 'البحث عن العلامات التجارية والشركات الأم والبدائل',
    search: 'اكتب اسم العلامة التجارية أو الشركة...', barcode: '📷 باركود',
    allCats: 'جميع الفئات', allComps: 'جميع الشركات الأم',
    fAll: 'الكل', fReview: '🔴 يُنصح بالمراجعة', fPreferred: '🟢 مفضل', fAlt: '⭐ له بدائل',
    statTotal: 'المجموع', statReview: 'مراجعة', statPref: 'مفضل', statAlt: 'بدائل',
    brands: 'العلامات التجارية', more: 'عرض المزيد', empty: 'لم يتم العثور على نتائج.',
    parent: 'الشركة الأم', category: 'الفئة', alt: 'البدائل', note: 'ملاحظة', source: 'المصدر',
    details: 'التفاصيل', install: '📲 تثبيت', bcTitle: '📷 مسح الباركود', bcPlaceholder: 'أدخل رقم الباركود...', bcSearch: 'بحث'
  }
};

function t(k) { return (I18N[lang] || I18N.tr)[k] || k; }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

// Tippfehler-freundliche Normalisierung (ignoriert Akzente, Groß/Kleinschreibung, türkische Sonderzeichen)
function norm(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[’'`´]/g, '');
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
  $('appSub').textContent = t('sub');
  $('searchInput').placeholder = t('search');
  $('barcodeBtn').textContent = t('barcode');
  $('fAll').textContent = t('fAll');
  $('fReview').textContent = t('fReview');
  $('fPreferred').textContent = t('fPreferred');
  $('fAlt').textContent = t('fAlt');
  $('listHeading').textContent = t('brands');
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

  const catSel = $('categoryFilter');
  const compSel = $('companyFilter');
  catSel.innerHTML = `<option value="">${esc(t('allCats'))}</option>` +
    [...cats].sort((a, b) => a.localeCompare(b, 'tr')).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  compSel.innerHTML = `<option value="">${esc(t('allComps'))}</option>` +
    [...comps].sort((a, b) => a.localeCompare(b, 'tr')).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function renderStats() {
  let review = 0, pref = 0, alt = 0;
  ALL_BRANDS.forEach(b => {
    if (getStatusType(b) === 'preferred') pref++; else review++;
    if (getAlts(b).length) alt++;
  });
  $('statsBar').innerHTML = `
    <div class="stat"><span>${esc(t('statTotal'))}</span><b>${ALL_BRANDS.length}</b></div>
    <div class="stat review"><span>${esc(t('statReview'))}</span><b>${review}</b></div>
    <div class="stat preferred"><span>${esc(t('statPref'))}</span><b>${pref}</b></div>
    <div class="stat"><span>${esc(t('statAlt'))}</span><b>${alt}</b></div>
  `;
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

  $('resultCount').textContent = `${filteredBrands.length}`;
  const grid = $('brandGrid');

  if (!filteredBrands.length) {
    grid.innerHTML = `<div class="empty">${esc(t('empty'))}</div>`;
    $('loadMoreBtn').style.display = 'none';
    return;
  }

  const slice = filteredBrands.slice(0, visibleLimit);
  grid.innerHTML = slice.map((item, idx) => {
    const st = getStatusType(item);
    const badgeCls = st === 'preferred' ? 'preferred' : 'review';
    const badgeTxt = st === 'preferred' ? t('fPreferred') : t('fReview');
    const parent = item.anaFirma || item.anafirma || '-';
    const alts = getAlts(item);
    return `
      <article class="card" data-idx="${idx}">
        <span class="badge ${badgeCls}">${esc(badgeTxt)}</span>
        <h3>${esc(item.marka)}</h3>
        <div class="meta"><b>${esc(t('parent'))}:</b> ${esc(parent)}</div>
        ${item.kategori ? `<div class="meta"><b>${esc(t('category'))}:</b> ${esc(item.kategori)}</div>` : ''}
        ${alts.length ? `<div class="meta" style="color:var(--green2)"><b>${esc(t('alt'))}:</b> ${esc(alts.slice(0, 3).join(', '))}</div>` : ''}
        <button type="button">${esc(t('details'))} →</button>
      </article>
    `;
  }).join('');

  $('loadMoreBtn').style.display = filteredBrands.length > visibleLimit ? 'inline-block' : 'none';
}

function openDetail(item) {
  const st = getStatusType(item);
  const badgeCls = st === 'preferred' ? 'preferred' : 'review';
  const badgeTxt = st === 'preferred' ? t('fPreferred') : t('fReview');
  const parent = item.anaFirma || item.anafirma || '-';
  const alts = getAlts(item);
  const sources = getSources(item);
  const note = item.not || item.notlar || item.ozet || '-';

  $('detailBody').innerHTML = `
    <span class="badge ${badgeCls}">${esc(badgeTxt)}</span>
    <h2>${esc(item.marka)}</h2>
    <div class="detailGrid">
      <div class="infoBox"><small>${esc(t('parent'))}</small><b>${esc(parent)}</b></div>
      <div class="infoBox"><small>${esc(t('category'))}</small><b>${esc(item.kategori || '-')}</b></div>
    </div>
    ${alts.length ? `<h3>${esc(t('alt'))}</h3><div class="pillrow">${alts.map(a => `<span class="pill">${esc(a)}</span>`).join('')}</div>` : ''}
    <h3>${esc(t('note'))}</h3>
    <div class="listItem">${esc(note)}</div>
    ${sources.length ? `<h3>${esc(t('source'))}</h3><div class="list">${sources.map(s => `

