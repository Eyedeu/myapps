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

let state = {
  data: null
};

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function createEmptyState(title, description) {
  return `
    <div class="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
      <div class="text-lg font-bold text-slate-900">${title}</div>
      <p class="mt-2 text-sm leading-6 text-slate-600">${description}</p>
    </div>
  `;
}

function obligationClasses(obligation) {
  return obligation === 'zorunlu'
    ? 'bg-rose-50 text-rose-700 border border-rose-100'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
}

function regionBadge(region) {
  return `<span class="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-brand-700">${region}</span>`;
}

function normalizeEmployees(rangeValue) {
  if (!rangeValue) {
    return 0;
  }
  if (rangeValue === '250+') {
    return 250;
  }
  return Number(rangeValue.split('-')[0]);
}

function matchesEmployeeRequirement(requirement, employeeRange) {
  if (!requirement || requirement === 'all') {
    return true;
  }
  const employeeMin = normalizeEmployees(employeeRange);
  if (!employeeMin && requirement !== '1+') {
    return false;
  }
  if (requirement.endsWith('+')) {
    return employeeMin >= Number(requirement.replace('+', ''));
  }
  return true;
}

function matchesRegions(certificateRegions, selectedRegions) {
  if (!selectedRegions.length) {
    return false;
  }
  if (selectedRegions.includes('Global')) {
    return true;
  }
  return certificateRegions.includes('Global') || selectedRegions.some((region) => certificateRegions.includes(region));
}

function getSelectedRegions() {
  return Array.from(elements.regionsContainer.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
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
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function populateSelect(selectElement, placeholder, items) {
  selectElement.innerHTML = '';
  selectElement.appendChild(createOption('', placeholder));
  items.forEach((item) => {
    if (typeof item === 'string') {
      selectElement.appendChild(createOption(item, item));
      return;
    }
    selectElement.appendChild(createOption(item.value, item.label));
  });
}

function renderRegions(regions) {
  elements.regionsContainer.innerHTML = '';
  regions.forEach((region) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-white';
    wrapper.innerHTML = `
      <input type="checkbox" value="${region.value}" class="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500">
      <span>
        <span class="block font-semibold text-slate-900">${region.label}</span>
        <span class="mt-1 block text-xs leading-5 text-slate-500">${region.value === 'Global' ? 'Global standartlar ve bölgesel gereksinimleri birlikte düşünmek için kullanın.' : 'Bu pazara açılımda geçerli olan veya öne çıkan gereksinimler filtrelenir.'}</span>
      </span>
    `;
    elements.regionsContainer.appendChild(wrapper);
  });
}

function renderStats(stats) {
  elements.statsGrid.innerHTML = stats.map((stat) => `
    <div class="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div class="text-3xl font-black tracking-tight text-brand-700">${stat.value}</div>
      <div class="mt-2 text-sm leading-6 text-slate-600">${stat.label}</div>
    </div>
  `).join('');
}

function renderJourney(journey) {
  elements.journeyGrid.innerHTML = journey.map((item) => `
    <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">${item.step}</div>
      <h3 class="mt-3 text-xl font-black tracking-tight text-slate-950">${item.title}</h3>
      <p class="mt-3 text-sm leading-6 text-slate-600">${item.description}</p>
    </article>
  `).join('');
}

function renderCertificates(certificates) {
  elements.certificateGrid.innerHTML = certificates.map((certificate) => `
    <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">${certificate.category}</span>
        <span class="rounded-full px-3 py-1 text-xs font-semibold ${obligationClasses(certificate.obligation)}">${certificate.obligation === 'zorunlu' ? 'Zorunlu' : 'Tavsiye Edilen'}</span>
      </div>
      <h3 class="mt-4 text-xl font-black tracking-tight text-slate-950">${certificate.name}</h3>
      <p class="mt-3 text-sm leading-6 text-slate-600">${certificate.summary}</p>
      <div class="mt-4 flex flex-wrap gap-2">${certificate.regions.map(regionBadge).join('')}</div>
      <div class="mt-5 grid gap-3 text-sm text-slate-600">
        <div><span class="font-semibold text-slate-900">Süre:</span> ${certificate.estimatedTimeline}</div>
        <div><span class="font-semibold text-slate-900">Maliyet:</span> ${certificate.estimatedCost}</div>
        <div><span class="font-semibold text-slate-900">Kaynak:</span> ${certificate.issuingAuthority}</div>
      </div>
    </article>
  `).join('');
}

function renderPlaybooks(playbooks) {
  elements.playbookGrid.innerHTML = playbooks.map((item) => `
    <article class="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <div class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">${item.sector}</div>
      <h3 class="mt-3 text-2xl font-black tracking-tight">${item.headline}</h3>
      <p class="mt-3 text-sm leading-6 text-slate-300">${item.summary}</p>
      <div class="mt-5 flex flex-wrap gap-2">
        ${item.recommendedCertificates.map((certificate) => `<span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100">${certificate}</span>`).join('')}
      </div>
    </article>
  `).join('');
}

function renderResources(resources) {
  elements.resourceGrid.innerHTML = resources.map((resource) => `
    <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <span class="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-brand-700">${resource.type}</span>
      <h3 class="mt-4 text-xl font-black tracking-tight text-slate-950">${resource.title}</h3>
      <p class="mt-3 text-sm leading-6 text-slate-600">${resource.description}</p>
    </article>
  `).join('');
}

function renderFaq(faq) {
  elements.faqGrid.innerHTML = faq.map((item) => `
    <details class="group rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-slate-900">
        <span>${item.question}</span>
        <i class="fa-solid fa-plus text-brand-700 transition group-open:rotate-45"></i>
      </summary>
      <p class="mt-4 text-sm leading-7 text-slate-600">${item.answer}</p>
    </details>
  `).join('');
}

function createSummaryCard(label, value, detail) {
  return `
    <article class="rounded-[1.5rem] border border-white/60 bg-white p-5 shadow-sm">
      <div class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">${label}</div>
      <div class="mt-3 text-lg font-black text-slate-950">${value}</div>
      <div class="mt-2 text-sm leading-6 text-slate-600">${detail}</div>
    </article>
  `;
}

function buildResultCard(title, description, certificates, emptyMessage) {
  if (!certificates.length) {
    return `
      <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-lg font-bold text-slate-900">${title}</div>
        <p class="mt-2 text-sm leading-6 text-slate-600">${description}</p>
        <div class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">${emptyMessage}</div>
      </article>
    `;
  }

  return `
    <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="text-lg font-bold text-slate-900">${title}</div>
      <p class="mt-2 text-sm leading-6 text-slate-600">${description}</p>
      <div class="mt-5 space-y-4">
        ${certificates.map((certificate) => `
          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-base font-bold text-slate-950">${certificate.name}</div>
              <span class="rounded-full px-3 py-1 text-xs font-semibold ${obligationClasses(certificate.obligation)}">${certificate.obligation === 'zorunlu' ? 'Zorunlu' : 'Tavsiye Edilen'}</span>
            </div>
            <p class="mt-2 text-sm leading-6 text-slate-600">${certificate.summary}</p>
            <div class="mt-3 flex flex-wrap gap-2">${certificate.regions.map(regionBadge).join('')}</div>
            <div class="mt-3 text-xs leading-5 text-slate-500">${certificate.officialHint}</div>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function renderNextActions(profile, mandatoryCertificates, recommendedCertificates) {
  const actions = [
    {
      title: '1. Önceliklendirme yapın',
      description: mandatoryCertificates.length
        ? `Önce ${mandatoryCertificates[0].name} gibi zorunlu başlıklardan başlayın ve mevzuat yükümlülüklerini kapatın.`
        : 'Zorunlu başlık görünmüyorsa tavsiye edilen belgeleri müşteri ve büyüme hedeflerinize göre önceliklendirin.'
    },
    {
      title: '2. Hazırlık paketinizi oluşturun',
      description: profile.personalData === 'true'
        ? 'Veri envanteri, politika seti, açık rıza metinleri ve sözleşme ekleri gibi temel dokümanları planlayın.'
        : 'Süreç dokümantasyonu, görev tanımları, risk analizi ve iç denetim hazırlığını erken aşamada kurun.'
    },
    {
      title: '3. Destek modelinizi seçin',
      description: recommendedCertificates.length + mandatoryCertificates.length > 2
        ? 'Birden fazla pazara açılıyorsanız danışmanlık ve belgelendirme kuruluşu eşleştirmesi zaman kazandırır.'
        : 'İlk belge süreciniz sınırlıysa iç kaynak + dış denetim modeliyle de ilerleyebilirsiniz.'
    }
  ];

  elements.nextActions.innerHTML = actions.map((action) => `
    <article class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="text-base font-bold text-slate-950">${action.title}</div>
      <p class="mt-3 text-sm leading-6 text-slate-600">${action.description}</p>
    </article>
  `).join('');
}

function filterCertificates(profile) {
  return state.data.certificates.filter((certificate) => {
    const sectorMatch = profile.sector ? certificate.sectors.includes(profile.sector) : true;
    const stageMatch = profile.stage ? certificate.businessStages.includes(profile.stage) : true;
    const employeesMatch = profile.employees ? matchesEmployeeRequirement(certificate.employeeRequirement, profile.employees) : true;
    const regionMatch = matchesRegions(certificate.regions, profile.regions);

    let personalDataMatch = true;
    if (profile.personalData === 'true') {
      personalDataMatch = certificate.requiresPersonalData || !certificate.requiresPersonalData;
    }
    if (profile.personalData === 'false') {
      personalDataMatch = !certificate.requiresPersonalData;
    }

    return sectorMatch && stageMatch && employeesMatch && personalDataMatch && regionMatch;
  });
}

function renderResults(profile) {
  if (!profile.sector || !profile.employees || !profile.stage || !profile.personalData || !profile.regions.length) {
    elements.summaryGrid.innerHTML = createEmptyState(
      'Değerlendirme için tüm alanları doldurun',
      'Sektör, çalışan sayısı, şirket aşaması, kişisel veri işleme durumu ve en az bir hedef pazar seçildiğinde sonuçlar oluşturulur.'
    );
    elements.resultContent.innerHTML = '';
    elements.nextActions.innerHTML = '';
    return;
  }

  const filteredCertificates = filterCertificates(profile);
  const mandatoryCertificates = filteredCertificates.filter((item) => item.obligation === 'zorunlu');
  const recommendedCertificates = filteredCertificates.filter((item) => item.obligation !== 'zorunlu');

  const personalDataLabel = profile.personalData === 'true' ? 'Evet, işliyoruz' : 'Hayır, işlemiyoruz';
  const selectedRegionLabels = state.data.filters.regions
    .filter((region) => profile.regions.includes(region.value))
    .map((region) => region.label)
    .join(', ');

  elements.summaryGrid.innerHTML = [
    createSummaryCard('Şirket Profili', profile.sector, `${profile.employees} çalışan aralığı, ${state.data.filters.businessStages.find((item) => item.value === profile.stage)?.label || ''}`),
    createSummaryCard('Veri İşleme Durumu', personalDataLabel, 'Veri koruma gereksinimleri buna göre şekillenir.'),
    createSummaryCard('Hedef Pazarlar', selectedRegionLabels, 'Global seçim yapıldıysa global standartlar ve bölgesel gereksinimler birlikte değerlendirilir.')
  ].join('');

  elements.resultContent.innerHTML = [
    buildResultCard(
      'Alınması zorunlu belgeler',
      'Mevzuat, ürün uygunluğu veya hedef pazardaki regülasyon sebebiyle öne çıkan başlıklar',
      mandatoryCertificates,
      'Seçtiğiniz profil için doğrudan zorunlu bir başlık görünmüyor. Yine de resmi kaynak doğrulaması önerilir.'
    ),
    buildResultCard(
      'Tavsiye edilen belgeler',
      'Kurumsallaşma, müşteri güveni, ihracat ve büyüme hedefleri açısından güçlü değer üreten başlıklar',
      recommendedCertificates,
      'Bu profil için tavsiye alanı boş görünüyor. Daha geniş sektör veya pazar kombinasyonlarıyla tekrar deneyebilirsiniz.'
    )
  ].join('');

  renderNextActions(profile, mandatoryCertificates, recommendedCertificates);
}

function applySavedProfile(profile) {
  if (!profile) {
    elements.savedStatus.textContent = 'Yerel kayıt bekleniyor';
    renderResults(getProfile());
    return;
  }

  elements.sector.value = profile.sector || '';
  elements.employees.value = profile.employees || '';
  elements.stage.value = profile.stage || '';
  elements.personalData.value = profile.personalData || '';

  const regionInputs = elements.regionsContainer.querySelectorAll('input[type="checkbox"]');
  regionInputs.forEach((input) => {
    input.checked = Array.isArray(profile.regions) ? profile.regions.includes(input.value) : false;
  });

  elements.savedStatus.textContent = 'Yerel kayıt yüklendi';
  renderResults(getProfile());
}

function resetForm() {
  elements.sector.value = '';
  elements.employees.value = '';
  elements.stage.value = '';
  elements.personalData.value = '';
  elements.regionsContainer.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  localStorage.removeItem(STORAGE_KEY);
  elements.savedStatus.textContent = 'Yerel kayıt temizlendi';
  renderResults(getProfile());
}

function handleContactSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('contact-name').value || 'Ziyaretçi';
  alert(`${name}, talebiniz demo modunda alındı. Gerçek sürümde bu form CRM veya teklif sistemine bağlanacaktır.`);
  elements.contactForm.reset();
}

async function init() {
  try {
    const response = await fetch('./data.json');
    state.data = await response.json();

    document.title = `${state.data.meta.platform} | Hedef Pazar Bazlı Sertifika Rehberi`;
    elements.footerDisclaimer.textContent = state.data.meta.disclaimer;
    elements.footerMeta.textContent = `Son güncelleme ${state.data.meta.lastGlobalUpdate} · ${state.data.meta.supportEmail}`;

    populateSelect(elements.sector, 'Sektör seçin', state.data.filters.sectors);
    populateSelect(elements.employees, 'Çalışan sayısını seçin', state.data.filters.employeeRanges);
    populateSelect(elements.stage, 'Firma aşamasını seçin', state.data.filters.businessStages);
    renderRegions(state.data.filters.regions);
    renderStats(state.data.stats);
    renderJourney(state.data.journey);
    renderCertificates(state.data.certificates);
    renderPlaybooks(state.data.playbooks);
    renderResources(state.data.resources);
    renderFaq(state.data.faq);

    const savedProfile = readProfile();
    applySavedProfile(savedProfile);

    elements.findButton.addEventListener('click', () => {
      const profile = getProfile();
      saveProfile(profile);
      renderResults(profile);
    });

    elements.resetButton.addEventListener('click', resetForm);
    elements.contactForm.addEventListener('submit', handleContactSubmit);
  } catch (error) {
    elements.summaryGrid.innerHTML = createEmptyState(
      'Veri yüklenemedi',
      'data.json dosyası okunamadı. Dosya yolunu ve JSON yapısını kontrol edin.'
    );
    elements.savedStatus.textContent = 'Veri yükleme hatası';
  }
}

init();
