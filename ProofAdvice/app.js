const STORAGE_KEY = 'certirehber-profile';
const elements = {
  sector: document.getElementById('sector'),
  employees: document.getElementById('employees'),
  stage: document.getElementById('stage'),
  personalData: document.getElementById('personalData'),
  regionsContainer: document.getElementById('regions-container'),
  findButton: document.getElementById('find-button'),
  resetButton: document.getElementById('reset-button'),
  summaryGrid: document.getElementById('summary-grid'),
  resultContent: document.getElementById('result-content'),
  nextActions: document.getElementById('next-actions'),
  statsGrid: document.getElementById('stats-grid'),
  journeyGrid: document.getElementById('journey-grid'),
  certificateGrid: document.getElementById('certificate-grid'),
  playbookGrid: document.getElementById('playbook-grid'),
  resourceGrid: document.getElementById('resource-grid'),
  faqGrid: document.getElementById('faq-grid'),
  savedStatus: document.getElementById('saved-status'),
  footerDisclaimer: document.getElementById('footer-disclaimer'),
  footerMeta: document.getElementById('footer-meta'),
  contactForm: document.getElementById('contact-form')
};

let state = { data: null };

function option(value, label) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function obligationClass(obligation) {
  return obligation === 'zorunlu'
    ? 'bg-rose-50 text-rose-700 border border-rose-100'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
}

function matchesEmployeeRequirement(requirement, employeeRange) {
  if (!requirement || requirement === 'all') return true;
  const min = employeeRange === '250+' ? 250 : Number((employeeRange || '0').split('-')[0]);
  return requirement.endsWith('+') ? min >= Number(requirement.replace('+', '')) : true;
}

function matchesRegions(certificateRegions, selectedRegions) {
  if (!selectedRegions.length) return false;
  if (selectedRegions.includes('Global')) return true;
  return certificateRegions.includes('Global') || selectedRegions.some((region) => certificateRegions.includes(region));
}

function getSelectedRegions() {
  return Array.from(elements.regionsContainer.querySelectorAll('input:checked')).map((input) => input.value);
}

function getProfile() {
  return {
    sector: elements.sector.value,
    employees: elements.employees.value,
    stage: elements.stage.value,
    personalData: elements.personalData.value,
    regions: getSelectedRegions()
  };
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  elements.savedStatus.textContent = 'Yerel kayıt güncellendi';
}

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function populateSelect(select, placeholder, items) {
  select.innerHTML = '';
  select.appendChild(option('', placeholder));
  items.forEach((item) => select.appendChild(typeof item === 'string' ? option(item, item) : option(item.value, item.label)));
}

function renderRegions(items) {
  elements.regionsContainer.innerHTML = items.map((region) => `
    <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-white">
      <input type="checkbox" value="${region.value}" class="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500">
      <span><span class="block font-semibold text-slate-900">${region.label}</span><span class="mt-1 block text-xs leading-5 text-slate-500">${region.value === 'Global' ? 'Global standartlar ve bölgesel gereksinimleri birlikte düşünmek için kullanın.' : 'Bu pazara açılımda geçerli olan veya öne çıkan gereksinimler filtrelenir.'}</span></span>
    </label>
  `).join('');
}

function renderCards(target, items, renderer) {
  target.innerHTML = items.map(renderer).join('');
}

function renderStatic() {
  renderCards(elements.statsGrid, state.data.stats, (stat) => `<div class="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm"><div class="text-3xl font-black tracking-tight text-brand-700">${stat.value}</div><div class="mt-2 text-sm leading-6 text-slate-600">${stat.label}</div></div>`);
  renderCards(elements.journeyGrid, state.data.journey, (item) => `<article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"><div class="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">${item.step}</div><h3 class="mt-3 text-xl font-black tracking-tight text-slate-950">${item.title}</h3><p class="mt-3 text-sm leading-6 text-slate-600">${item.description}</p></article>`);
  renderCards(elements.certificateGrid, state.data.certificates, (item) => `<article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">${item.category}</span><span class="rounded-full px-3 py-1 text-xs font-semibold ${obligationClass(item.obligation)}">${item.obligation === 'zorunlu' ? 'Zorunlu' : 'Tavsiye Edilen'}</span></div><h3 class="mt-4 text-xl font-black tracking-tight text-slate-950">${item.name}</h3><p class="mt-3 text-sm leading-6 text-slate-600">${item.summary}</p><div class="mt-4 flex flex-wrap gap-2">${item.regions.map((region) => `<span class="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-brand-700">${region}</span>`).join('')}</div></article>`);
  renderCards(elements.playbookGrid, state.data.playbooks, (item) => `<article class="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><div class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">${item.sector}</div><h3 class="mt-3 text-2xl font-black tracking-tight">${item.headline}</h3><p class="mt-3 text-sm leading-6 text-slate-300">${item.summary}</p></article>`);
  renderCards(elements.resourceGrid, state.data.resources, (item) => `<article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"><span class="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-brand-700">${item.type}</span><h3 class="mt-4 text-xl font-black tracking-tight text-slate-950">${item.title}</h3><p class="mt-3 text-sm leading-6 text-slate-600">${item.description}</p></article>`);
  renderCards(elements.faqGrid, state.data.faq, (item) => `<details class="group rounded-2xl border border-slate-200 bg-slate-50 p-5"><summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-slate-900"><span>${item.question}</span><i class="fa-solid fa-plus text-brand-700 transition group-open:rotate-45"></i></summary><p class="mt-4 text-sm leading-7 text-slate-600">${item.answer}</p></details>`);
  elements.footerDisclaimer.textContent = state.data.meta.disclaimer;
  elements.footerMeta.textContent = `Son güncelleme ${state.data.meta.lastGlobalUpdate} · ${state.data.meta.supportEmail}`;
}

function filterCertificates(profile) {
  return state.data.certificates.filter((certificate) => {
    const sectorMatch = profile.sector ? certificate.sectors.includes(profile.sector) : true;
    const stageMatch = profile.stage ? certificate.businessStages.includes(profile.stage) : true;
    const employeesMatch = profile.employees ? matchesEmployeeRequirement(certificate.employeeRequirement, profile.employees) : true;
    const regionMatch = matchesRegions(certificate.regions, profile.regions);
    const personalDataMatch = profile.personalData === 'false' ? !certificate.requiresPersonalData : true;
    return sectorMatch && stageMatch && employeesMatch && regionMatch && personalDataMatch;
  });
}

function renderResults(profile) {
  if (!profile.sector || !profile.employees || !profile.stage || !profile.personalData || !profile.regions.length) {
    elements.summaryGrid.innerHTML = '<div class="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3"><div class="text-lg font-bold text-slate-900">Değerlendirme için tüm alanları doldurun</div><p class="mt-2 text-sm leading-6 text-slate-600">Sektör, çalışan sayısı, şirket aşaması, kişisel veri işleme durumu ve en az bir hedef pazar seçildiğinde sonuçlar oluşturulur.</p></div>';
    elements.resultContent.innerHTML = '';
    elements.nextActions.innerHTML = '';
    return;
  }

  const filtered = filterCertificates(profile);
  const mandatory = filtered.filter((item) => item.obligation === 'zorunlu');
  const recommended = filtered.filter((item) => item.obligation !== 'zorunlu');
  const regionLabel = state.data.filters.regions.filter((item) => profile.regions.includes(item.value)).map((item) => item.label).join(', ');

  elements.summaryGrid.innerHTML = `
    <article class="rounded-[1.5rem] border border-white/60 bg-white p-5 shadow-sm"><div class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Şirket Profili</div><div class="mt-3 text-lg font-black text-slate-950">${profile.sector}</div><div class="mt-2 text-sm leading-6 text-slate-600">${profile.employees} çalışan aralığı</div></article>
    <article class="rounded-[1.5rem] border border-white/60 bg-white p-5 shadow-sm"><div class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Veri İşleme Durumu</div><div class="mt-3 text-lg font-black text-slate-950">${profile.personalData === 'true' ? 'Evet, işliyoruz' : 'Hayır, işlemiyoruz'}</div><div class="mt-2 text-sm leading-6 text-slate-600">Veri koruma gereksinimleri buna göre şekillenir.</div></article>
    <article class="rounded-[1.5rem] border border-white/60 bg-white p-5 shadow-sm"><div class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Hedef Pazarlar</div><div class="mt-3 text-lg font-black text-slate-950">${regionLabel}</div><div class="mt-2 text-sm leading-6 text-slate-600">Global seçim yapıldıysa global standartlar ve bölgesel gereksinimler birlikte değerlendirilir.</div></article>
  `;

  const card = (title, description, items, emptyMessage) => `
    <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="text-lg font-bold text-slate-900">${title}</div>
      <p class="mt-2 text-sm leading-6 text-slate-600">${description}</p>
      <div class="mt-5 space-y-4">${items.length ? items.map((item) => `<div class="rounded-2xl border border-slate-200 p-4"><div class="flex flex-wrap items-center gap-2"><div class="text-base font-bold text-slate-950">${item.name}</div><span class="rounded-full px-3 py-1 text-xs font-semibold ${obligationClass(item.obligation)}">${item.obligation === 'zorunlu' ? 'Zorunlu' : 'Tavsiye Edilen'}</span></div><p class="mt-2 text-sm leading-6 text-slate-600">${item.summary}</p></div>`).join('') : `<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">${emptyMessage}</div>`}</div>
    </article>
  `;

  elements.resultContent.innerHTML = card('Alınması zorunlu belgeler', 'Mevzuat, ürün uygunluğu veya hedef pazardaki regülasyon sebebiyle öne çıkan başlıklar', mandatory, 'Seçtiğiniz profil için doğrudan zorunlu bir başlık görünmüyor.') + card('Tavsiye edilen belgeler', 'Kurumsallaşma, müşteri güveni, ihracat ve büyüme hedefleri açısından güçlü değer üreten başlıklar', recommended, 'Bu profil için tavsiye alanı boş görünüyor.');
  elements.nextActions.innerHTML = `<article class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div class="text-base font-bold text-slate-950">1. Önceliklendirme yapın</div><p class="mt-3 text-sm leading-6 text-slate-600">${mandatory.length ? `Önce ${mandatory[0].name} gibi zorunlu başlıklardan başlayın.` : 'Önce tavsiye edilen belgeleri müşteri ve büyüme hedeflerinize göre sıralayın.'}</p></article><article class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div class="text-base font-bold text-slate-950">2. Hazırlık paketinizi oluşturun</div><p class="mt-3 text-sm leading-6 text-slate-600">${profile.personalData === 'true' ? 'Veri envanteri, politika seti ve sözleşme eklerini planlayın.' : 'Süreç dokümantasyonu, görev tanımları ve risk analizini hazırlayın.'}</p></article><article class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div class="text-base font-bold text-slate-950">3. Destek modelinizi seçin</div><p class="mt-3 text-sm leading-6 text-slate-600">Birden fazla pazara açılıyorsanız danışmanlık ve belgelendirme kuruluşu eşleştirmesi zaman kazandırır.</p></article>`;
}

function applySavedProfile(profile) {
  if (!profile) {
    renderResults(getProfile());
    return;
  }
  elements.sector.value = profile.sector || '';
  elements.employees.value = profile.employees || '';
  elements.stage.value = profile.stage || '';
  elements.personalData.value = profile.personalData || '';
  elements.regionsContainer.querySelectorAll('input').forEach((input) => {
    input.checked = Array.isArray(profile.regions) && profile.regions.includes(input.value);
  });
  elements.savedStatus.textContent = 'Yerel kayıt yüklendi';
  renderResults(getProfile());
}

function resetForm() {
  elements.sector.value = '';
  elements.employees.value = '';
  elements.stage.value = '';
  elements.personalData.value = '';
  elements.regionsContainer.querySelectorAll('input').forEach((input) => { input.checked = false; });
  localStorage.removeItem(STORAGE_KEY);
  elements.savedStatus.textContent = 'Yerel kayıt temizlendi';
  renderResults(getProfile());
}

async function init() {
  const response = await fetch('./data.json', { cache: 'no-store' });
  state.data = await response.json();
  populateSelect(elements.sector, 'Sektör seçin', state.data.filters.sectors);
  populateSelect(elements.employees, 'Çalışan sayısını seçin', state.data.filters.employeeRanges);
  populateSelect(elements.stage, 'Firma aşamasını seçin', state.data.filters.businessStages);
  renderRegions(state.data.filters.regions);
  renderStatic();
  applySavedProfile(readProfile());
  elements.findButton.addEventListener('click', () => { const profile = getProfile(); saveProfile(profile); renderResults(profile); });
  elements.resetButton.addEventListener('click', resetForm);
  elements.contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('contact-name').value || 'Ziyaretçi';
    alert(`${name}, talebiniz demo modunda alındı. Gerçek sürümde bu form CRM veya teklif sistemine bağlanacaktır.`);
    elements.contactForm.reset();
  });
}

init().catch(() => {
  elements.summaryGrid.innerHTML = '<div class="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6 shadow-sm lg:col-span-3"><div class="text-lg font-bold text-rose-900">Veri yüklenemedi</div><p class="mt-2 text-sm leading-6 text-rose-800">data.json dosyası okunamadı. Dosya yolunu ve JSON yapısını kontrol edin.</p></div>';
  elements.savedStatus.textContent = 'Veri yükleme hatası';
});
