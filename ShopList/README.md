# ShopList

Paylaşımlı **ev alışveriş listesi**: biri ürünleri ekler, diğeri aldıkça işaretler. GitHub Pages üzerinde çalışır; telefonda tarayıcıdan **Ana ekrana ekle** ile uygulama gibi kullanılabilir (PWA manifest).

## Çalışma şekli

1. Firebase’de bir proje açın, **Firestore**’u etkinleştirin, web uygulaması ekleyip `firebaseConfig` JSON’unu alın.
2. Siteyi açın; ilk girişte bu JSON’u yapıştırın (tarayıcıda saklanır).
3. **Yeni liste oluştur** ile liste yaratın, **Bağlantıyı kopyala** ile paylaşın.
4. Aile üyesi aynı bağlantıyı veya listedeki **UUID** kodunu “Listeye katıl” alanına yapıştırarak açar.

Veriler `shopLists/{listeId}` ve alt koleksiyon `items` altında tutulur.

## Firestore güvenlik kuralları (örnek)

Aile içi kullanım için; **liste kimliğini bilen herkes** okuyup yazabilir. Üretimde daha sıkı kurallar veya kimlik doğrulama düşünün.

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

## Yerel geliştirme

```bash
npm ci
npm run dev
```

## Derleme (GitHub Pages / myapps betiği)

`myapps` deposundaki `publish-pages.mjs` bu klasörü otomatik keşfeder; `npm ci && vite build --base=/REPO_ADI/ShopList/` ile `dist` üretilir.
