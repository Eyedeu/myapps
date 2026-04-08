# CertiRehber

CertiRehber, yeni kurulan sirketler ve buyuyen KOBI'ler icin sertifika, uyum ve belgelendirme gereksinimlerini sadelestiren statik bir web platformudur.

## Neler Sunar

- Sektor, ekip olcegi, firma asamasi ve veri isleme durumuna gore sertifika analizi
- `data.json` tabanli icerik yonetimi
- GitHub Pages uyumlu statik dagitim
- GitHub Actions ile haftalik AI destekli veri guncelleme akisi
- Sektor rehberleri, kaynak merkezi ve SSS bolumleri

## Proje Dosyalari

- `index.html`: Tum arayuz ve istemci mantigi
- `data.json`: Sertifika, FAQ, kaynak ve sektor verileri
- `update_data.py`: Resmi kaynaklardan metin toplayip LLM ile JSON guncelleyen betik
- `.github/workflows/ai-updater.yml`: Haftalik otomatik guncelleme workflow'u
- `.env.example`: Gerekli ortam degiskenleri

## GitHub Pages Kurulumu

1. Repoyu GitHub'a push edin.
2. `Settings > Pages` ekranina gidin.
3. Source olarak aktif branch ve `/root` secin.
4. Birkac dakika sonra ana sayfa yayinlanir.

## GitHub Secrets

Asagidaki secret'lari eklemeniz tavsiye edilir:

- `LLM_API_KEY`: Zorunlu
- `LLM_MODEL`: Opsiyonel, varsayilan `gpt-4.1-mini`
- `LLM_BASE_URL`: OpenAI uyumlu baska bir servis kullanacaksaniz opsiyonel
- `OFFICIAL_SOURCE_URL`: Tek kaynak icin opsiyonel
- `OFFICIAL_SOURCE_URLS`: Virgulle ayrilmis birden fazla resmi kaynak URL listesi

## Veri Guncelleme Akisi

Workflow her Pazar `01:00 UTC` calisir. Bu, 8 Nisan 2026 itibariyla Europe/Berlin saat diliminde yaz saati doneminde Pazar `03:00` anlamina gelir.

Akis:

1. Repo checkout edilir
2. Python kurulumu yapilir
3. `requirements.txt` yuklenir
4. `update_data.py` calistirilir
5. `data.json` degismisse otomatik commit ve push yapilir

## Lokal Gelistirme

Bu proje tamamen statik oldugu icin `index.html` ve `data.json` ayni klasorde oldugu surece basit bir statik sunucuyla calisir.

Python betigini lokal test etmek icin:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:LLM_API_KEY="your-key"
python update_data.py
```

## Uretim Icin Sonraki Adimlar

- `Teklif Al` formunu Formspree, Basinblue, HubSpot veya kendi CRM'inize baglamak
- `data.json` icine daha fazla sektor ve belge eklemek
- Resmi kaynak URL'lerini gercek kurum sayfalariyla guncellemek
- Ayrik landing page'ler ve blog icerikleri ile SEO derinligi eklemek
- Premium dokuman ve checklist urunleri icin odeme akisi kurmak
