/**
 * Yerelde / ilk açılışta Firestore bağlantısı (localStorage boşsa).
 * Genel repoda paylaşmak istemiyorsanız bu dosyayı kaldırıp yalnızca
 * uygulama içi "Firebase ayarı" ile yapıştırın veya VITE_ ortam değişkeni kullanın.
 */
export const DEFAULT_FIREBASE_JSON = JSON.stringify({
  apiKey: 'AIzaSyBvR5pyypATMwxqOrjnWijekFTSIP4B52E',
  authDomain: 'metal-episode-474912-b7.firebaseapp.com',
  projectId: 'metal-episode-474912-b7',
  storageBucket: 'metal-episode-474912-b7.firebasestorage.app',
  messagingSenderId: '29029115867',
  appId: '1:29029115867:web:a2f18776158fbd93a269fe',
})
