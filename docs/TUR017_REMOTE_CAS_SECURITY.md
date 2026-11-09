# TUR017 — Remote create-once claim ve anti-rollback tanığı güvenlik sözleşmesi

**Durum: PROTOTYPE_ONLY / PROVIDER_LIVE_NOT_RUN / PRODUCTION_NO_GO.** Bu dosya `extension/remote-claim.js` ve `extension/rollback-witness.js` için kapsam sınırını tarif eder. Prototipler mevcut `background.js` bulut aktarımına **bağlı değildir**; bundan dolayı üretim senkronizasyonu dağıtık CAS korumasına sahip değildir.

## A. GitHub referansına dayalı tek kazananlı sahiplenme

- Kapsam: Aynı GitHub deposundaki **tek bir taskId/runId** için `refs/heads/embasic-claims/<taskId>/<runId>` adının sunucuda **yalnız bir kez oluşturulmasını** bekleyen, `POST /repos/{owner}/{repo}/git/refs` protokolü. Benzersiz ref adı altında sadece **ilk başarılı CREATE** sahipliği alır; mevcut ref üzerine **UPDATE/PATCH/force push yoktur**.
- Hazırlık: İstemcinin rastgele 128+ bit `ownerNonce`, rapor SHA-256'sı ve özel `claimSha` ile bir Git commit hazırlamış olması gerekir. Commit `message` içeriği `EMBASIC-CLAIM-V1`, depo, görev, tur, rapor digest ve nonce değerlerine **birebir** bağlıdır. `claimSha` ve rapor digest ayrı doğrulanır. Hazırlayıcı GitHub `POST /git/commits` adımı ve onun belirsiz ACK uzlaştırması TUR017'de **entegrasyon dışında** bırakılmıştır: tam uçtan uca garanti yoktur.
- Önce GET ref, uzak ref varsa sahibini ve commit message'ını doğrula; farklı SHA veya mesaj varsa **FOREIGN_OWNER**. Ref yoksa *önce* encrypted write-ahead intent kaydet, lease'i doğrula, *sonra tek POST* dene. 401/403/409/422/429/network ve başarılı POST ardından GET 404 sonuçlarının tümü belirsiz olabilir. Yalnız okuma ile aynı id/commit doğrulanırsa OWNED; aksi halde **UNCERTAIN_NO_REPLAY**. Aynı anda iki bağımsız profil aynı ref'i oluşturamaz (sunucu benzersizlik varsayımı); fakat gerçek GitHub API kabulü `NOT_RUN`.
- Her uzak rapor mutasyonundan önce remote claim tekrar okunup owner/digest/commit doğrulanmalıdır. Bu kontrol ile sonraki sağlayıcı COMMIT arasında **TOCTOU** vardır; ref'in kullanıcının yazma yetkili başka istemcisince değiştirilmesine karşı atomik commit fence **yoktur**. GitHub `PUT /contents` ve Drive `files.create` **claim'i atomik şart olarak kontrol etmez**. Ref yalnız **single-winner intent** sağlar; dağıtık transaction, lease expiry, idempotency-key, CAS across providers ya da exactly-once iddiası yoktur.
- `remote-claim.js` testleri `tests/tur017-mock-github.cjs` içindeki sunucu tarafında atomik `create ref` mock'una dayanır; gerçek iki hesap/iki cihaz ağı üzerinden sağlayıcı garantisi henüz test edilmemiştir. GitHub repo izinleri bu düzeneği yetkisiz aktöre karşı izolasyon sağlar ama aynı izinlere sahip istemcilerin başka ref güncellemesini teknik olarak engellemez. Gerekirse Github repository ruleset/harici koordinatör gerekir.

## B. İmzalı haricî AES-GCM anti-rollback tanığı (fizibilite)

- `rollback-witness.js` **yalnız istemcide public key** bulunan, `vaultId`, `generation`, `cipherSha256` alanlarını kanonik kodlayıp harici sunucunun ECDSA P-256/SHA-256 imzasını kontrol eden bir **okuma doğrulama prototipidir**.
- Sunucu her kasanın **tek ve monoton artan en yeni generation** bilgisini kalıcı, geri alınamaz veya denetlenebilir biçimde saklamalıdır. Her yeni AES-GCM kaydı için sunucu tarafı **atomik check-and-increment** ve SHA binding gerekecek; bu TUR'de **yok**. Ağ kesintisi, imza eksikliği, yanlış anahtar, generation mismatch veya eski ciphertext -> **FAIL_CLOSED**.
- İmza tek başına geriye döndürmeyi engellemez: imzalı **eski tanık yanıtı da** saldırgan tarafından replay edilebiliyorsa ve istemcide güvenilir tazelik kaynağı bulunmuyorsa imza doğrulaması geçer. Bu nedenle gerçek service, replay koruması, nonce/freshness, revocation, key rotation ve server atomicity ayrıca kanıtlanmalıdır. Pinned public key değişimi açık kullanıcı onayı ister; hiçbir gizli signing key uzantıda tutulmamalıdır.
- Sentetik ECDSA imzası, farklı signer, offline witness ve geçerli eski ciphertext test edilmiştir. **Uzak güven kökü, canlı imza hizmeti, fiziksel restore testi: NOT_RUN.** Mevcut AES-GCM kasası antireplay güvencesi kazanmamıştır.

## C. Korunan geriye dönük uyumluluk ve gerçek kod düzeltmesi

- `background.js` `restoreBackup` yolu önce `serialize(()=>saveState(restored))` çağırıp **beklenen encrypted stamp'i geçmiyordu**. TUR017 bunu `modifyState` üzerinden `expectedStamp` kontrolüne taşıdı. Daha yeni ciphertext restorasyon öncesi başka worker tarafından kaydedilirse `STALE_LOCAL_WRITER` ile ret edilir; test eski kodun kaybını yakalar. Bu hâlâ farklı Chrome profili/cihazda atomik CAS değildir.
- `Web Locks` yalnız aynı-origin/aynı Chrome profili; ayrı cihazların Drive folder intent kayıtları birbirinden bağımsız. TUR017 negatif testte **iki farklı profil aynı global folder POST'unu oluşturabilir**. Yeni remote claim prototipi bu üretim akışına bağlanmadan bu açık giderilmiş sayılmaz.
- DeepSeek Free insansız tarayıcı otomasyonu, web scraping veya izinsiz API eklenmedi. Yeni host permission yok. Main merge/deploy yok.

## D. Gerçek dünya kabul kapıları

1. En az iki ayrı fiziksel Chrome profili/cihaz, yalnız atılabilir/sentetik GitHub deposu; GitHub `POST /git/refs`, 422, ref drift, timeout/ACK kaybı, API 403/429 ve kesinti sonrası GET ile bit-bit commit readback. Tam test sonuçları **NOT_RUN**.
2. Operasyonel olarak sahibi ve root-of-trust'ı belirlenmiş harici **server-enforced compare-and-swap**; yazıcı fencing token'ının GitHub/Drive mutasyonuna nasıl zorunlu koşul yapılacağı tanımlanmadan production yok.
3. Gerçek anahtar rotasyonu, tanık tazeliği, imzalı eski yanıt replay'i, cross-device restore/adversarial rollback. **NOT_RUN**.
4. Gerçek Windows Chrome MV3 service worker ve aynı origin iki gerçek pencerenin Web Lock contention testi; uyku/uyanma/24h ve OAuth/Drive/GitHub canlı kullanıcı onaylı entegrasyon. **NOT_RUN**.
5. Uygulama `PC_TEST_CANDIDATE / PRODUCTION_NO_GO` olarak kalır.
