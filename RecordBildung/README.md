# Gizli Ausbildung Asistani

iPhone Safari ve GitHub Pages icin hazirlanmis PWA tabanli ders kayit asistani.

## Ozellikler

- Uygulama acilisinda mikrofon izni ister ve kaydi baslatmayi dener.
- Sade siyah saat ekrani kullanir; kontrol paneli cift tiklama/dokunma ile acilir.
- Kayitlar ders klasorlerine ayrilarak IndexedDB icinde saklanir.
- Settings ekranindan Gemini API key girilir; anahtar sadece tarayicida saklanir.
- Kayitlar Gemini 1.5 Flash ile analiz edilip Turkce ozet ve Almanca teknik terim sozlugu uretilir.
- Manifest ve service worker ile ana ekrana eklenebilir.

## Notlar

- iOS Safari mikrofon iznini kullanici onayi olmadan vermez. Ilk acilista izin istemi gorunur; engellenirse `Baslat` butonu ile tekrar denenebilir.
- Ses kaydi yapmadan once bulundugun yerdeki izin ve gizlilik kurallarina uydugundan emin ol.
- Wake Lock API iOS tarafinda desteklenmeyebilir; destek varsa ekranin kapanmasini onlemek icin kullanilir.
