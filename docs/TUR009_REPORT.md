# EMBASIC DeepSeek Agent — TUR 009 teknik ve güvenlik raporu

**Sürüm:** 1.8.0 (09.11.2026)  
**Sınır:** DeepSeek Free web sohbeti otomatik kullanılmaz. Model API çağrısı, DOM kazıma, otomatik mesaj gönderimi, limit aşma veya sürekli arka plan model yürütmesi yoktur.

## Başlangıç doğrulaması

- TUR008 v1.7 Chrome ZIP SHA-256: `83114ffcf4662e33cffb3b37cf4cf72ee3c1cea15abf83979eb91dc31cafb651` (**PASS**, kayıtla eşleşti).
- TUR008 v1.7 Source ZIP SHA-256: `ee264dfb16e4ea52b0d5f4d9863158a33e863006d63338487797c8e18991b440` (**PASS**, kayıtla eşleşti).
- TUR008 **29 Node.js + 1 paket + 1 DOM mock = 31/31 PASS** yeniden çalıştırıldı; gerçek MV3 = `NOT_RUN`.

## TUR009 kod değişiklikleri

1. **Başlangıçta zorunlu kasa kapısı**: `onStartup` yalnız alarmı değil güvenli kurulum önceliğini yeniden uygular. Legacy düz-metin görevler yeni şifreli kasaya geçmeden değiştirilemez; eski kaydı silmeden açık kullanıcı geçişi istenir. Chrome kilitliyken zamanlayıcı işlem yapmaz.
2. **Bağlam revizyonuna bağlı senkronizasyon izni**: lease edinimi, uzak aktarım ön denetimi ve `synced` durumunun kalıcı kaydı, tamamlanan turun görev revizyonunu canlı görev revizyonuyla karşılaştırır. Talimat/depo bağlamı değişirse eski turun otomatik buluta gitmesi engellenir. Önceden oluşturulmuş uzak kaydı geri alma işlemi yapmaz.
3. **Drive sahiplik/ebeveyn zorunluluğu**: Dosya ve klasör aramalarında `parents` alanı zorunlu kabul edilir; yanlış/eksik parent ve bozuk Drive kimlikleri güvenli biçimde reddedilir. Google API'deki `files.list` sorgusu bu alanı açıkça ister. Daha önce yalnız id ve appProperties dönen simülasyon fixture'ları gerçek API projeksiyonuna uygun `parents` içerecek şekilde güncellendi.
4. **Ortak Drive klasörü yarış koruması**: Eşzamanlı iki işlem aynı klasör oluşturma uçuşunu paylaştığında ikinci işlem sonucu almadan önce **kendi** lease yetkisini yeniden doğrular; ilk istemcinin geçerli olması diğer istemciye yetki devretmez.
5. **Oran sınırı regresyonu**: Google 429 `Retry-After` (saniye ve HTTP-date), GitHub 403 rate limit / reset ve otomatik POST tekrarına izin vermeme davranışları testle sabitlendi. Sağlayıcı isteklerinde garantili exactly-once iddiası yoktur.
6. **Windows yerel test aracı**: 34 Node.js regresyonunu keşfederek çalıştırır, beklenen test sayısını sabitler, paket ve DOM mock kontrolünü ekler; gerçek Chrome worker testi ayrı sıkı fail-close betiğindedir.

## Test kanıtı ve sınırlar

| Kategori | Sonuç | Kanıt |
|---|---|---|
| TUR008 31 grup baseline | PASS | `TUR009_baseline.log` |
| Önceki 29 Node regresyonu | PASS | `TUR009_final_tests.log` |
| TUR009 5 Node adversarial testi | PASS | `test-tur009-*.cjs` |
| Paket, manifest, dosya ID kontrolü | PASS | Python test-package |
| Chromium DOM arayüz (chrome.* MOCK) | PASS | Python test-ui-smoke |
| **Toplam yerel** | **36/36 PASS** | 34 Node + 1 paket + 1 mock UI |
| Gerçek Chrome MV3 worker / browser restart | **NOT_RUN** | Fiziksel Chrome kanıtı yok |
| Canlı Google OAuth / Drive API / GitHub repo | **NOT_RUN** | Hesap bağlanmadı, gerçek mutasyon yapılmadı |
| Windows 24h/uyku-uyanma | **NOT_RUN** | Windows PC kabulü yapılmadı |
| DeepSeek Free insansız web ajanı | **NOT_IMPLEMENTED** | Kullanım koşullarına aykırı otomasyon yok |

### Bilinen teknik sınırlar

- `chrome.storage.session` tarayıcı kapanınca anahtarı temizler. PC kapalı/uykuda iken saatlik çalışma sürmez; kasa kilitli olduğunda planlayıcı bekler. MV3 event worker ömür boyu çalışmaz.
- Kasadaki AES-GCM kimlik bütünlüğü sağlasa da işletim sistemi düzeyinde koruma, bağımsız monotonic anchor, sertifikalı anti-rollback veya tüm olası gizli verileri tanıyan DLP sağlamaz.
- Google OAuth Client ID varsayılan pakette **örnektir**, canlı bağlantı için kullanıcı kendi Chrome Extension OAuth Client ID'sini girmelidir. GitHub fine-grained PAT ayrı oturum/şifreli kasadadır; GitHub OAuth kurulduğu iddia edilemez.
- Yeniden denemede uzak metadata ve rapor bayt karşılaştırması kullanılır; geciken/yitmiş HTTP yanıtı nedeniyle çift işlemin matematiksel olarak imkânsız olduğu iddia edilmez.
- v1.8'in daha katı Drive parent ve görev revizyon denetimleri daha önceki sürümlerden kalan bazı bekleyen kayıtları engelleyebilir. Bu durum veri silinmesi değil **fail-closed** güvenlik kararıdır; kullanıcı yeni tur oluşturarak devam edebilir.

## Ağırlıklı kabul ilerlemesi (tahminî)

| Alan | Maksimum | Kazanılan |
|---|---:|---:|
| Proje/görev yönetimi | 10 | 10 |
| Zamanlayıcı & lease | 15 | 13 |
| AES-256-GCM kasa & kurtarma | 15 | 13 |
| Yerel doğrulama | 10 | 10 |
| GitHub izinleri ve aktarım | 15 | 9 |
| Drive OAuth ve aktarım | 15 | 10 |
| Gerçek MV3 Chrome kabul | 10 | 0 |
| Windows uzun süreli ve canlı hesap kabul | 10 | 0 |
| **Toplam** | **100** | **65** |

**%65**, mühendislik kabul kapılarına verilen *subjektif ağırlıklı hazırlık puanıdır*; üretim başarısı veya son kullanıcı gereksinimlerinin %65'i demek değildir. Yerel regresyon %100 (36/36), fakat gerçek MVP'nin DeepSeek Free insansız kullanım hedefi ayrı tutulur: **uygulanmadı (%0)**.

**Yayın kararı:** **PC_TEST_CANDIDATE / NOT_PRODUCTION_VERIFIED.** Önce sentetik Windows kabulünü, sonra izinli test depolarında canlı API sınamasını tamamla.
