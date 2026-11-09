# TUR016 — Koordinasyonun Kanıtlanabilen ve Kanıtlanamayan Sınırları

## Destekli yürütüm sınırı

Aynı Chrome uzantı **origin** kapsamındaki kooperatif Web Locks istemcileri, aynı lock adını `{mode:'exclusive'}` kullanırsa tek seferde bir kritik bölüm çalıştırabilir. Bu, imzasız yerel `chrome.storage.local.set` üzerinde CAS sağlamaz; yalnız *aynı-origin* yazarların iş birliğiyle veri kaybı riskini azaltır. API bulunmuyorsa eski iyimser envelope stamp kontrolü tek başına yeterli değildir. Web Lock talebi reddedilirse işlem **FAIL**; kilitsiz yönteme sessizce dönüş yok. Kaynağın worker'da kullanılabilirliğini gerçek Windows Chrome ile test etmeden güvenlik garantisi iddia edilmez.

## Açık kalan riskler

- **Farklı Chrome profili/cihaz**: Web Locks izole; uzakta belirlenmiş tekil transaction, işaretçi CAS veya idempotency-key kabulü olmadan aynı run iki farklı istemciden yazılabilir.
- **Chrome profilinin kopyalanması/geri alınması**: AES-256-GCM geçmiş ciphertext'i doğrular, fakat onun en son/tek güncel kopya olduğunu kanıtlayamaz. Donanımsal monotonic anchor veya güvenilir uzak append-only witness YOK. TUR016 rollback-limit testi bunu pozitif güvenlik olarak değil, beklenen **güvenlik açığı sınırlaması** olarak doğrular.
- **GitHub POST/PUT**: Web Locks GitHub API sunucusunda ref CAS değildir; belirsiz ACK'da kalıcı journal ve gerçek uzak bayt doğrulaması gerekir. Commit SHA'sız branch GET ve eventual-consistency/başka yazıcı yarışı gerçek sunucu testinden geçmedi.
- **Drive**: ortak klasör WAL tek profil/proje koşullarında tekrar POST'u frenler; başka profilin bağımsız WAL'iyle koordineli değildir. Google Drive dosya oluşturma API'sinde bu kodun server-enforced unique `runId` garantisi yok.
- **MV3/PC**: simüle Chromium UI ve Node VM ile gerçek MV3 worker suspend/restart aynı şey değildir. Uyku/uyanma ve 24h kabulü NOT_RUN.

## Üretim ön koşulu

1. Gerçek Windows Chrome MV3 Web Locks/worker testi, 24 saat/uyku-uyanma testi.
2. Sağlayıcı tarafında atomik tekillik veya haricî koordinatör üzerinde fail-closed CAS sözleşmesi; bağımsız iki gerçek istemci ile sözleşme testi.
3. AES-GCM snapshot rollback tespitine yönelik kök güven/monotonic anchor kararı veya kalıcı manual reconcile/quarantine.
4. Gerçek GitHub/Drive OAuth izinleri, mutation ACK kaybı/tekrar, rate limiting, provider işaretçi/metadata yarışı testi.
5. Başarılı bütün testlerin gerçek kanıtı olmadan production deploy/merge yapılmamalı.

Kaynaklar: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API ; https://www.w3.org/TR/web-locks/ ; https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
