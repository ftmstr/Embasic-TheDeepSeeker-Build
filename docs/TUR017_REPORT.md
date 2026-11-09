# EMBASIC TheDeepSeeker TUR017 v1.16.0 — Teknik / Güvenlik Raporu

**Tarih:** 09.11.2026  
**Kanonik temel:** Public `ftmstr/Embasic-TheDeepSeeker-Build`, TUR016 Draft PR #5 HEAD `ca6e95e80b9f1de4659e0cdcffb48d71a04c4e14`.

## Başlangıç denetimi

- Draft PR #1 → #5 zinciri, TÜMÜ Draft; TUR016 commit ve GitHub Actions run `42600985644` **Windows Node/manifest, Ubuntu Node/manifest, Chromium MOCK UI: 3/3 SUCCESS**. Drive TUR016 rapor ve ILERLEME_DURUMU.md aynı tur SHA ve run numarasını içeriyor.
- TUR017 için PR/dal/Drive raporu bulunmadığından tekrar yapılmadı. TUR016 kanonik Source ZIP SHA256 `2a7c8b98121b9b0949c669c5d003daca863ca1055286851877fa929c5aabc134`; Chrome ZIP SHA256 `61af7ce5510bed41f406a7835a1f29f9d4b3a7bf039d3f96df4bc700862daa9c`.
- TUR014 Drive kaynak ZIP geçmiş uyuşmazlığı göz ardı edilmedi; kanonik kaynak **TUR016 GitHub HEAD**. Önceki 130/130 blob eşdeğerliği doğrulanmıştı; Source ZIP içindeki 2 geçmiş UI ekran görüntüsü GitHub takibi dışı artefakttır.
- TUR016 70 Node + paket/manifest + MOCK Chromium UI = 72 PASS yeniden çalıştırıldı; gerçek MV3 worker Linux Chromium'da `NOT_RUN`.

## TUR017 somut iş paketleri

1. `extension/remote-claim.js`: bağımsız istemciler için GitHub'ın CREATE-only **benzersiz ref** kuralına dayalı **ilk yazıcı kazanır** iddia prototipi. Rapor SHA-256/nonce/commit message tam eşleşmesi; önce encrypted journal, sonra bir POST; kayıp ACK, 422/409, sonraki GET 404 ve farklı sahibin ref'i fail-closed. Bu protokol **henüz mevcut uygulamanın `githubUpload`/`driveUpload` yollarına bağlı değildir**, canlı sağlayıcı koşumu yapılmadı.
2. `extension/rollback-witness.js`: bağımsız **imzalı ECDSA P-256** tanık yanıtı için salt-okunur doğrulama prototipi. Geçerli eski ciphertext ile güncel imzalı tanık uyuşmazlığı tespit edilir; sahte imza/offline hizmet engellenir. Harici monotonic CAS sunucusu ve anti-replay freshness YOK, üretim kasa güvenliği değişmedi.
3. **Uygulanan üretim kod düzeltmesi**: `restoreBackup` işlemindeki `saveState(restored)` çağrısını atomik yerel seri işleme + beklenen ciphertext stamp'li `modifyState` yoluna taşıdı. Kaynak yarışı esnasında başka worker'ın daha yeni şifreli verisi üzerine yazılamıyor. Aynı-origin Web Locks ve optimistic stamp korunuyor.
4. Windows gerçek MV3 kabul probuna **iki ayrı extension-origin pencerenin aynı Web Locks ismi altında exclusivity** testi eklendi. Fiziksel Windows üzerinde gerçek Chrome test edilmedi, `NOT_RUN`; Linux'ta service worker görülemedi.
5. Adversarial testler: bağımsız iki client remote ref yarışması; kayıp ACK / eventual 404; ref drift/sahte commit/digest farkı; journal/lease başarısızlığı; imzalı tanık doğrulaması; backup restore stale ciphertext; farklı profil Drive global folder WAL **negatif koruma sınırı** testi. Eski tüm testler korunur.

## Yerel/CI test durumu

- Önceki **70 Node** + **7 TUR017 Node** = **77 Node**. Paket manifest **1**, simüle Chromium UI **1** ⇒ **79 yerel grup hedefi**; gerçek log çıktısı ve GitHub Actions job kimlikleri RAPOR SONU doğrulama kaydında tutulur. `Node VM mock != real browser/remote server`.
- Gerçek Windows Chrome MV3, iki ayrı fiziksel cihaz, gerçek GitHub CREATE-only ref yarışı ve repo izinleri, harici imzalı tanık sunucusu, OAuth/Drive/GitHub eklenti canlı yetkilendirmeleri, PC uyku/uyanma/24h: **NOT_RUN**.

## Güvenlik kararı

**`PC_TEST_CANDIDATE / PRODUCTION_NO_GO`.** GitHub create-ref tekilleştirmesi ayrı protokolün sağlayıcıda gerçekleşmesi hâlinde en fazla *bir claim* sağlar; GitHub PUT + Drive POST atomikliği, eksiksiz CAS, tam exactly-once veya eski geçerli ciphertext'in otomatik rollback engeli **yoktur**. `remote-claim.js` ve `rollback-witness.js` deneysel kaynak olup üretim iş akışına bağlı değildir. Gerçek olmayan kabulü PASS yazmak yasaktır. DeepSeek Free web otomasyonu eklenmemiştir; main merge/deploy yok.

## Ağırlıklı mühendislik hazırlık puanı (üretim sertifikası DEĞİL)

| Alan | TUR016 | TUR017 önerisi |
|---|---:|---:|
| Yerel çekirdek + güvenlik | 34/35 | 34/35 |
| Şifreli kasa + scheduler | 17/20 | 18/20 |
| GitHub + Drive güvenlik altyapısı | 17/20 | 18/20 |
| Gerçek Windows/MV3 kabul | 0/15 | 0/15 |
| Dokümantasyon/dağıtım | 9/10 | 9/10 |
| **Toplam** | **77/100** | **79/100** |

Artış, prototip ve ek regresyon kapsamı içindir; dağıtık CAS veya anti-rollback tamamlama puanı değildir.
