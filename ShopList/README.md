# ShopList

Aynı Firebase projesine bağlı iki kişinin (ör. anne–çocuk) ortak kullandığı **ev alışveriş listesi**. GitHub Pages’te çalışır; **Ana ekrana ekle** ile PWA gibi açılabilir.

## Çalışma şekli

1. Firestore’u açın; güvenlik kurallarını aşağıdaki örneğe göre ayarlayın.
2. `src/firebase/defaultConfig.ts` içindeki web yapılandırması veya uygulamadaki **Firebase ayarı** ile projeyi bağlayın.
3. **Yeni liste oluştur** ile liste açın; ana sayfada tüm listeler canlı listelenir (paylaşım kodu gerekmez).
4. Liste başlığını düzenlemek için detayda başlığa dokunup düzenleyin; odaktan çıkınca kaydedilir.
5. Tüm kalemler işaretlendiğinde üstte çıkan soruda **Evet, sil** derseniz liste ve ürünler Firestore’dan kalıcı silinir. İstediğiniz zaman **Listeyi kaldır** ile de silebilirsiniz.

Veri yapısı: `shopLists/{listeId}` alanları `title`, `createdAt`, `pendingCount`, `totalCount`; ürünler `shopLists/{listeId}/items/{ürünId}`.

## Firestore güvenlik kuralları (örnek)

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shopLists/{listId} {
      allow read, write: if listId.matches('^[0-9a-f-]{36}$');
      match /items/{itemId} {
        allow read, write: if listId.matches('^[0-9a-f-]{36}$');
      }
    }
  }
}
```

`shopLists` sorgusunda `orderBy('createdAt')` kullanıldığı için, eski belgelerde `createdAt` yoksa konsolda indeks veya sorgu hatası görebilirsiniz; yeni listelerde alan her zaman set edilir.

## Yerel geliştirme

```bash
npm ci
npm run dev
```

## Derleme (GitHub Pages / myapps)

`publish-pages.mjs` bu uygulamayı otomatik derler: `dist` → `_site/ShopList/`.
