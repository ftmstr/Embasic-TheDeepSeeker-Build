# TUR031 — Gerçek Chrome MV3 kilitli alarm, lease revocation ve witness anahtar rotasyonu

**Sınır:** Yalnız Public `ftmstr/Embasic-TheDeepSeeker-Build`, TUR030 son HEAD üzerine tek stacked Draft PR. Yerel sentetik içerik; canlı GitHub/Drive mutasyonları, gerçek kullanıcı OAuth yetkilendirmesi veya DeepSeek Free otomatik sohbeti yok.

## Gerçek Chrome MV3 kabulü (ayrı, Linux CI)

`tests/test-mv3-extension.py`, `EMBASIC_TUR031_LOCKED_ALARM=1` ile önceden **gerçek Linux MV3 iki ayrı profil, iki tam Chrome restart ve iki native alarm** kabulünü ister. Üçüncü aşamada:

1. Disposable profil içinde şifreli kasa `vaultLock` çağrısıyla kilitlenir; `chrome.storage.session` anahtarı temizlenir. Gerçek Chrome `chrome.alarms` olayı extension sayfasındaki `onAlarm` listener ile gözlenir; `schedulerNow` çağrısı kullanılmaz.
2. Kasa kilitliyken mesajla `snapshot` alınamaz, `embasicSealedStateV3` ciphertext nesnesi değişmez. Kasa açıldığında saklı `lastSchedulerAt` ilk checkpoint ile aynı kalır ve `waiting` run kimliği korunur; hiçbir lease veya upload canlandırılmaz.
3. Açık kasayla ikinci gerçek native alarm istenir; şifreli checkpoint **ilerlemek zorundadır**; görev/run tekilliği, `liveLeases=0`, `staleLeases=0` ve bulut commit belirsizliği sıfır korunur.
4. Gerçek worker aşamasında assertion hatası **FAIL** olur; gerçek Chrome worker bulunamaz veya CI timeout oluşursa **NOT_RUN** gösterilir (asla PASS sayılmaz). Mock UI, bu kabulün yerine geçmez.

Bu kabul bile **fiziksel Windows Chrome ve 24 saatlik sleep/resume testi değildir**; bunlar `NOT_RUN`.

## Node adversarial testleri (sentetik sağlayıcı)

- `tests/test-tur031-lease-revocation-http.cjs`: 127.0.0.1 gerçek TCP/HTTP ile sentetik GraphQL `beforeOid` sağlar. Şifreli niyet kaydından sonra üçüncü lease kontrolünün iptali -> **sıfır POST**. Dördüncü kontrol uzak COMMIT sonrasında iptal edilirse, lease sahibi HTTP başarılı olsa bile yerel ACK veremez; sonraki yeni lease ancak **immutable owner/sha/digest readback** ile, mutation replay yapmadan geçmişi uzlaştırır. Uzak aynı OID ancak yabancı commit mesajı `CAS_COMMIT_UNVERIFIED` ile reddedilir.
- `tests/test-tur031-signed-witness-key-rotation.cjs`: P-256 ECDSA ile eski ve yeni imza anahtarları, epoch/generation, owner/nonce/digest bağları, yanlış anahtar, imza ve geçersiz freshness bayrakları sınanır. Eski tanık **gerçekten imzalı olduğu hâlde**, caller'ın kendisiyle birlikte eski `anchor` kuşağı geri alınırsa kabul edilebildiği negatif testle gösterilir. Bu **haricî bağımsız güvenilir monotonik tanık değildir**, üretim anti-rollback iddiası yapılamaz.

## Zorunlu GO/NO-GO

- Live GitHub GraphQL `beforeOid`/REST PUT ve Google Drive kayıp POST ACK / idempotency, çoklu cihaz ve yönetici/owner yetkileri: **NOT_RUN / NOT_PROVEN**.
- Gerçek güvenilir dış ECDSA monotonic witness, anti-equivocation, güvenilir anahtar rotasyonu ve imzalı geriye alma reddi: **NOT_RUN / NOT_PROVEN**.
- Fiziksel Windows Chrome, tam 24 saat alarm+uyku/uyanma ve gerçek kullanıcı etkileşimi: **NOT_RUN**.
- Deneysel CAS/rollback witness üretim bulut işlemlerine bağlı değil; dağıtık exactly-once veya global CAS yok.
- `main` merge, production deploy veya DeepSeek Free insansız web sohbet otomasyonu **yok**.

Önce gerçek GitHub CI işlerinin ve kanonik HEAD'in doğruluğunu kanıtla, sonra aynı exact HEAD'den iki kez deterministik TUR031 kaynak/Chrome ZIP (Git blob SHA, ZIP CRC, manifest, 15/15 dosya) üret. Google Drive Kaynak/Uygulama/Rapor klasörlerine yükle, tüm dosyaların ham SHA256 geri okumasını gerçekleştir; merkezî `ILERLEME_DURUMU.md` geçmişini sakla.

**Ölçülecek mühendislik hazırlığı 79/100, `PC_TEST_CANDIDATE / PRODUCTION_NO_GO`.**
