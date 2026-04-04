# Ausbildung Web App

Bu proje, gonderdigin Firebase tabanli React uygulamasinin GitHub Pages uzerinde calisabilecek statik bir web uyarlamasidir.

## Neler degisti

- Firebase bagimliliklari kaldirildi.
- Tum uygulama verileri `localStorage` icinde tutulur.
- Gemini API anahtari kod icinde sabit olarak tanimlanir.
- GitHub Pages icin `Vite` tabanli statik derleme yapisi eklendi.

## Kurulum

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

GitHub Pages icin repo kokundeki `docs/lernapp` klasorunu guncellemek istersen:

```bash
npm run build:pages
```

## GitHub Pages yayinlama

1. `npm run build:pages` calistir.
2. Repo'yu GitHub'a push et.
3. GitHub `Settings -> Pages` altinda source olarak `Deploy from a branch` sec.
4. Branch: `main`
5. Folder: `/docs`

## API anahtari

API anahtarini su dosyada tanimla:

`src/App.jsx`

Su satirdaki metni kendi anahtarinla degistir:

```js
const GEMINI_API_KEY = "BURAYA_API_ANAHTARINI_YAZ";
```

## Veri yapisi

- Dersler
- Derse bagli notlar
- Derse bagli sohbet gecmisi
- Ayarlar

Bu verilerin tamami tarayici tarafinda saklanir. Baska cihaza otomatik senkronize edilmez.
