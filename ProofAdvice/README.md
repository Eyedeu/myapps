# CertiRehber

CertiRehber, yeni kurulan şirketler ve büyüyen KOBİ'ler için sertifika, uyum ve belgelendirme gereksinimlerini sadeleştiren statik bir web platformudur.

## Neler Sunar

- Sektör, ekip ölçeği, firma aşaması, veri işleme durumu ve hedef pazara göre sertifika analizi
- `data.json` tabanlı içerik yönetimi
- `app.js` ile yönetilen istemci tarafı filtreleme ve raporlama
- GitHub Pages uyumlu statik dağıtım
- GitHub Actions ile haftalık AI destekli veri güncelleme akışı
- Sektör rehberleri, kaynak merkezi ve SSS bölümleri

## Proje Dosyaları

- `index.html`: Arayüz iskeleti
- `app.js`: Veri yükleme, filtreleme, render ve etkileşim mantığı
- `data.json`: Sertifika, SSS, kaynak ve sektör verileri
- `update_data.py`: Resmi kaynaklardan metin toplayıp LLM ile JSON güncelleyen betik
- `.github/workflows/ai-updater.yml`: Haftalık otomatik güncelleme workflow'u
- `.env.example`: Gerekli ortam değişkenleri

## GitHub Pages Kurulumu

1. Repoyu GitHub'a push edin.
2. `Settings > Pages` ekranına gidin.
3. Source olarak aktif branch ve `/root` seçin.
4. Birkaç dakika sonra ana sayfa yayınlanır.

## GitHub Secrets

Aşağıdaki secret'ları eklemeniz tavsiye edilir:

- `LLM_API_KEY`: Zorunlu
- `LLM_MODEL`: Opsiyonel, varsayılan `gpt-4.1-mini`
- `LLM_BASE_URL`: OpenAI uyumlu başka bir servis kullanacaksanız opsiyonel
- `OFFICIAL_SOURCE_URL`: Tek kaynak için opsiyonel
- `OFFICIAL_SOURCE_URLS`: Virgülle ayrılmış birden fazla resmi kaynak URL listesi

## Veri Güncelleme Akışı

Workflow her Pazar `01:00 UTC` çalışır. Bu, 8 Nisan 2026 itibarıyla Europe/Berlin saat diliminde yaz saati döneminde Pazar `03:00` anlamına gelir.

Akış:

1. Repo checkout edilir
2. Python kurulumu yapılır
3. `requirements.txt` yüklenir
4. `update_data.py` çalıştırılır
5. `data.json` değişmişse otomatik commit ve push yapılır

## Lokal Geliştirme

Bu proje tamamen statik olduğu için `index.html`, `app.js` ve `data.json` aynı klasörde olduğu sürece basit bir statik sunucuyla çalışır.

Python betiğini lokal test etmek için:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:LLM_API_KEY="your-key"
python update_data.py
```

## Üretim İçin Sonraki Adımlar

- `Teklif Al` formunu Formspree, Basinblue, HubSpot veya kendi CRM'inize bağlamak
- `data.json` içine daha fazla sektör, bölge ve belge eklemek
- Resmi kaynak URL'lerini gerçek kurum sayfalarıyla güncellemek
- Ayrık landing page'ler ve blog içerikleri ile SEO derinliği eklemek
- Premium doküman ve checklist ürünleri için ödeme akışı kurmak
