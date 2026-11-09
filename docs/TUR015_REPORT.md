# EMBASIC TheDeepSeeker — TUR015 v1.14.0 Teknik/Güvenlik ve Kaynak Kökeni Raporu

**Tarih:** 09.11.2026 (Europe/Istanbul)  
**Durum:** PC_TEST_CANDIDATE / PRODUCTION_NO_GO  
**Başlangıç:** Public `ftmstr/Embasic-TheDeepSeeker-Build`, TUR014 Draft PR #3, SHA `ee434bb8c47c55a48e46fc9a7478ddce5a718669`. Önceki GitHub Actions PR run `42588813261` (3/3 SUCCESS). `main`e merge/deploy yok.

## 1. Başlangıç ve kaynak kökeni

- GitHub'da yalnız Draft PR #1, #2, #3 ve dalları bulundu; ilk kontrolde TUR015 yoktu.
- TUR014 Google Drive teknik raporu ve `ILERLEME_DURUMU.md` okundu, önceki SHA ve CI durumu doğrulandı.
- **Tedarik/bütünlük bulgusu:** Drive'da kayıtlı `EMBASIC_DeepSeek_Agent_v1.13_TUR014_Source.zip` (914.589 bayt, SHA-256 `1e517351d5be2c96aa265e491a486d1d0cfde91138ccf8acf25dae6764c6cb64`) GitHub TUR014 HEAD ile aynı tam kaynak ağacı **değil**: 102 dosyanın 77'si Git blob SHA ile eşleşiyor, 25'i farklı; Git HEAD'deki 15 dosya Drive ZIP'te yok. Drive'a yüklenmiş TUR014 Chrome ZIP boyutu 54.864 bayt, geçmişte doğrulanmış SHA'sı `e8d9b9f593622270b69f5dcdd37c0843a076c6f84e2166030bb15ff1f9ed851a`.
- Çalışma ortamında bulunan diğer TUR014 ZIP örneği 932.178 bayttı (SHA `6023894604fce20417e2bff0ce850615df499e509cb1d8c3f9e5965fe410af79`); farklı ZIP özeti tespit edildi. Bu dosyadan ayrılan çalışma ağacında, TUR015'in değişiklikleri dışında kalan **94 GitHub-takipli blob**, GitHub HEAD'deki SHA ile birebir eşleşti. Değişen 15 GitHub-takipli dosya planlı TUR015 kod/CI/sürüm değişiklikleridir. Eksik iki Git kök dosyası `.gitignore` ve GPL-3.0 `LICENSE` GitHub blob SHA'larıyla ayrı doğrulanıp kaynak paketine eklendi. GitHub TREE ve bağımsız blob kimliği kanonik temeldir; uyuşmaz TUR014 Drive ZIP'i kesinlikle otomatik olarak dağıtım kaynağı kullanılmamalıdır.
- Bu bulgu eski TUR014 raporlarını sessizce değiştirmek için gerekçe değildir. TUR015 ZIP'leri yerel çalışma ağacından **yeni**, bütünlüğü doğrulanabilir paketlerdir.

## 2. Gerçek kod değişiklikleri

1. **Şifreli state iyimser sürüm denetimi:** `modifyState` tarafından okunmuş AES-GCM envelope'un IV/data/salt kimliği, `saveState` öncesi ve checkpoint sonrası sınanır; son yazımın ciphertext readback'i doğrulanır. Başka worker'ın yeni kaydını açıkça algıladığında `STALE_LOCAL_WRITER` ile fail-closed. Ayrı worker V8 bağlamları ile sentetik yarış ve geri-okuma clobber senaryoları test edildi. **ÖNEMLİ:** `chrome.storage.local.get/set` atomik CAS/transaction sağlamaz; kontrol/yazma arasındaki yarış penceresi kapatılmış değildir. Donanımsal anti-rollback veya bağımsız bir koordinatör iddiası yok.
2. **Kasa kurtarma replay karantinası:** Şifreli recovery checkpoint geri alınan tüm eski run'lar `recoveryQuarantined` işaretine sahiptir; `manualRetrySync`, `approvePublicRun` ve `syncPending` eski run'ları tekrar yayımlayamaz. Dış JSON arşivinden içe aktarılan eski run'lar da aynı karantinaya alınır. Yeni çalışma turu, kullanıcının görevi açıkça yeniden başlatmasıyla oluşturulabilir.
3. **Drive uygulama-geneli klasör niyeti:** AES-GCM içinde `driveFolderIntents` kaydı parent/name/run/lease ile tutulur. Farklı görevler, listede görünmeyen ama ilk isteği COMMIT etmiş olabilecek klasöre **ikinci POST** gönderemez. Uzakta tek sahiplikli klasör doğrulanırsa ledger çözülür. Bozuk kayıtlar sessizce düşürülmek yerine fail-closed hatasıdır. Aynı Chrome profili ve aynı şifreli state dışındaki bağımsız istemciler için global tekillik sağlanmaz.
4. **Google OAuth bağlama yolu:** `googleConnect` artık salt-okunur klasör GET'i yapar. Kök klasör POST'u yalnızca kullanıcı onaylı rapor aktarımında, aktif lease ve kalıcı şifreli niyetle başlatılır. 401 GET için token yeniden alma, 401/403/429 mutasyon replay yasağı korunur.
5. **Chrome MV3 kabulü:** Test sürümü v1.14.0, Playwright worker keşif bekleme penceresi yapılandırılabilir ve Windows `EMBASIC_REQUIRE_MV3=1` fiziksel kabul yolu strict. Arayüz tanılaması, sürekli worker çalışma garantisi yerine yanıt veren worker/alarm durumunu ifade eder.
6. `.gitignore` ve `LICENSE` GitHub blob verileri korunarak tam kaynak ZIP'e dahil edildi; GPLv3 lisans değiştirilmedi.

## 3. Adversarial doğrulama

- TUR014'ün 57 Node regresyonu yeniden yürütüldü; TUR015 için 7 yeni test yazıldı. **64 Node + paket/manifest + MOCK Chromium UI = 66/66 yerel PASS**.
- Yeni testler: cross-worker stale envelope, write-after-clobber readback, eski run'ın recovery sonrasında otomatik/manüel replay yasağı, projeler arası Drive kök klasör ledger, salt-okunur Google bağlantısı, mock MV3 alarm/restart, bozuk authenticated ledger'ın fail-closed reddi.
- `python tests/test-mv3-extension.py`: gerçek Chromium worker görünmediği için **NOT_RUN**. Bu sonuç 66 yerel PASS'a katılmaz.
- Fiziksel Windows Chrome, 24 saat uyku/uyanma, gerçek Google OAuth izni/Drive ve GitHub canlı extension API yazımı: **NOT_RUN**. Sentetik testler gerçek hizmet garantisi değildir.
- GitHub Actions yeni SHA'da CI oluşana/değerlendirilene kadar **PENDING / UNVERIFIED** olarak gösterilir; yalnız önceki TUR014 CI doğrulanmıştır.

## 4. Sınırlar ve sıradaki tur

- Tam bağımsız dağıtık CAS için haricî, doğrulanmış koordinatör ve sağlayıcı tarafı şartlı mutasyon gerekebilir; `get`→`set` TOCTOU yarışı kalır.
- Saldırganın Chrome storage'ı tümüyle geri almasına karşı TPM/secure enclave veya bağımsız monotonic anchor yoktur.
- İptal edilmiş Google OAuth yetkisinin tekrar verilmesi, sağlayıcı tarafındaki eventual consistency/403/429 ve GitHub/Drive geçmiş COMMIT belirsizlikleri canlı uçtan uca test edilmemiştir.
- Google Drive `drive.file` kapsamı ve kullanıcı onaylı içerik arşivi korunur. DeepSeek Free web sohbetinde insansız otomatik mesaj, DOM scraping, kullanım sınırı aşımı **yoktur**.

## 5. İlerleme puanı (mühendislik tahmini)

| Alan | Puan |
|---|---:|
| Yerel çekirdek ve güvenlik | 34/35 |
| Şifreli kasa ve scheduler | 16/20 |
| GitHub / Drive güvenli aktarım | 16/20 |
| Gerçek Chrome/Windows kabulü | 0/15 |
| Dokümantasyon ve dağıtım | 8/10 |
| **TOPLAM** | **74/100 (%74)** |

Önceki TUR014 %72 idi. Bu ölçüt üretim sertifikasyonu veya gerçek canlı API garantisi değildir. `main`e merge/deploy, gerçek hesapla yetkisiz test veya DeepSeek Free web otomasyonu yapılmaz.

## 6. Son kanıtlar

Bu rapor sonunda gerçek TUR015 GitHub commit SHA, Draft PR, GitHub Actions CI run/job ve ZIP SHA-256 değerleri **araç sonuçları alındıktan sonra** ayrıca işlenecektir. Her iddia gerçek okuma/günlük kanıtıyla desteklenir.
