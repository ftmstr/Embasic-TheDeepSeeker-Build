# TUR015 — Eşzamanlılık / CAS ve Anti-Rollback Sınırları

- `chrome.storage.local` genel amaçlı **read-modify-write transaction ya da atomik CAS sunmaz**. Yeni `envelopeStamp` denetimi, iki ayrı context'in eski ciphertext ile yazmasını birçok zamanlamada saptar, fakat `get` ile `set` arasındaki yarışı matematiksel olarak kapatmaz.
- `driveFolderIntents` uygulama içi şifreli durumun parçasıdır. Aynı profile geri yükleme veya farklı profilden bağımsız yazıcı, bu ledger'ı geri alabilir/bilmeyebilir.
- Gerçek çoklu istemci koşulsuz tekillik için sağlayıcı tarafında doğru karşılaştırma koşulu, idempotency anahtarı veya bağımsız güvenilir koordinatör gereklidir; uygun resmi API desteği ve gerçek kimlik/izin kanıtı olmadan bu özellik 'tamamlandı' denmez.
- Şifreli AES-GCM ciphertext bütünlüğü ve checkpoint karantinası, dışarıdan **tüm** Chrome storage klasörünün eski ve yine geçerli haline döndürülmesi durumunda donanımsal monotonluk garanti etmez.
- Uzak COMMIT'in ACK'sı kayıp olduğunda ilgili `githubUncertain*`, `driveUncertain*`, `driveFolderIntents` marker'ları doğrulanana kadar yeni uzak mutasyon yapılmamalı. Uzaktan aramanın boş gelmesi tek başına yokluk kanıtı değildir.
- Şifreli backup restore ve recovery sonrası eski run'a otomatik/manüel bulut onayı geri verilmez. Yeni tur, kullanıcı tarafından etkinleştirilerek ayrı bir kimlikle oluşturulur.
- Canlı Windows MV3 worker + 24 saat alarmlı kabul; canlı OAuth, Drive, GitHub resmi API testleri yapılmadan üretim yayını **NO-GO**.
