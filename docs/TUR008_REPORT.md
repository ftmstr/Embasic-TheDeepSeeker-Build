# EMBASIC DeepSeek Agent — TUR 008 teknik, güvenlik ve kabul raporu

**Sürüm:** 1.7.0 | **Tarih:** 09.11.2026 | **Çıktı:** Windows masaüstü Chrome için yüklenebilir Manifest V3 eklentisi ve kaynak arşivi

## Başlangıç kanıtı

- TUR007 v1.6.0 Chrome ve Source ZIP arşivleri mevcut ve `EMBASIC_DeepSeek_Agent_v1.6_TUR007_SHA256.txt` kayıtlarıyla eşleşti.
- TUR007 **24 Node.js + 1 paket + 1 Chromium DOM mock = 26/26 PASS** tekrar çalıştırıldı. Gerçek Chromium MV3 worker bu sonuca **dahil değildir**.
- Başlangıç referansı: TUR007 teknik raporu, kabul kılavuzu ve test sonuçları; bu turda değiştirilmeden korundu.

## TUR 008 kod değişiklikleri

1. **Atomik lease commit fencing:** Uzak sunucudan başarılı yanıt geldikten sonra, şifreli arşivde `synced` durumuna geçişin yapıldığı *seri durum mutasyonu içinde* de lease süresi, senkronizasyon izni ve servis etkinliği kontrol edilir. Kontrol arada geçersizleşirse `synced` yazılmaz; yeniden doğrulama için `retry` kullanılır. Ön kontrol ile kalıcı kayıt arasındaki yarış kapatılır. Uzak sistemde kesin exactly-once garantisi verilmez.
2. **Google OAuth / POST tekillik kapısı:** Bir `POST`/`PATCH`/diğer mutasyon yanıtı `401` döndürürse önbellekteki Google token temizlenir; **aynı mutasyon otomatik olarak ikinci kez gönderilmez**. Geçici hata olarak işlenir ve sonraki aktarım turu uzaktaki dosyayı/klasörü önce sorgulayarak doğrular. Okuma amaçlı `GET` için tek seferlik noninteractive token yenileme korunur.
3. **Google Drive dosya sahipliği:** Bir `files.list` sonucu `parents` alanı döndürüyorsa hedef proje klasörünü içerdiği doğrulanır. Uzak kayıt kimliği/digest uyuşsa bile yanlış ebeveynde ise `alt=media` veya yeni POST'a geçilmeden durdurulur.
4. **Google Drive yükleme makbuzu:** Yeni dosya yüklemenin `id` alanı boş/geçersizse tur başarı sayılmaz; sunucunun yanıtı belirsiz olarak reddedilir. Sonraki denemede mevcut dosya metadata ve gerçek baytlarla yeniden karşılaştırılır.
5. **Gizli veri sızıntısı azaltımı:** Ağ ve sağlayıcı hata mesajlarından GitHub PAT, bazı yaygın API anahtar kalıpları ve `Bearer` belirteçleri maskelenir. Kullanıcıya gösterilebilen bağlam uyarıları ve yerel hata günlükleri için de aynı maskeleme uygulanır. Bu, tüm olası gizli bilgileri keşfeden bir DLP sistemi değildir.
6. **Windows kabul betiği:** `CHROMIUM_PATH` ortam değişkenine verilen doğrulanmış Chrome yoluna saygı gösterir; gerçek worker bulunamıyorsa sessizce `PASS` üretilmez.

## Testler

| Tür | Sonuç | Açıklama |
|---|---|---|
| Eski 24 Node.js regresyon grubu | PASS | Tamamı yeniden çalıştı |
| Yeni 5 TUR008 adversarial Node.js grubu | PASS | Atomik commit yarışı; belirsiz POST 401; yanlış Drive parent; token redaction; bozuk yükleme makbuzu |
| Paket, manifest, HTML ve varlık kontrolü | PASS | Manifest V3, ikonlar, gerekli sayfalar, kısıtlı izinler |
| Chromium DOM arayüz simülasyonu | PASS | `chrome.runtime` taklidi; gerçek uzantı worker testi değildir |
| **Toplam yerel doğrulama** | **31/31 PASS** | 29 Node + paket + DOM mock |
| Gerçek MV3 worker / tarayıcı yeniden açma | **NOT_RUN** | Linux grafik Chromium denemesi zaman aşımı; kullanılabilir worker kanıtı yok |
| Canlı GitHub commit / Google Drive OAuth ve yükleme | **NOT_RUN** | Kullanıcı hesabı üzerinden gerçek ağ işlemi yapılmadı |
| Fiziksel Windows PC / 24 saat uyku-uyanma | **NOT_RUN** | Fiziksel Windows ortamı yok |
| DeepSeek Free insansız web sohbeti | **NOT_IMPLEMENTED** | Kullanım koşullarına aykırı web otomasyonu tasarıma alınmadı |

## Kapsam ve bilinen açıklar

- Google OAuth `manifest.json` içine kullanıcıya ait **Chrome Extension OAuth Client ID** yazılmadıkça canlı Google entegrasyonu çalışmaz. Testler sağlayıcı yanıtlarını taklit eder.
- GitHub için yalnız seçilen repo ve ayrı `embasic-agent/<task>` dalında rapor yazılması hedeflenir; `main`/`master` merge/deploy yapılmaz.
- Chrome MV3 worker 30 saniye civarında inaktiflikte sonlandırılabilir; alarm sistemleri Chrome kapalı/PC uykuda iken sürekli çalışmaz. Arşiv kilitliyken planlanmış tur veya bulut aktarımı yürütülmez.
- Şifreli kasa Chrome `storage.local` içinde AES-256-GCM ile korunur; parola kökenli anahtar yalnız `storage.session` ortamında tutulur. Parola kaybı veya profil bozulması durumunda harici yedek gereklidir; güvenli dosya silme garanti edilmez.
- OAuth POST yanıtsızlığında uzak sunucudaki gerçek durum belirsiz kalabilir. Uygulama önce uzak metadata ve rapor baytlarını kontrol eder ama dağıtık sistemlerde exactly-once garantisi vermez.
- Gerçek kişisel veri, kurum evrakı ve erişim anahtarlarıyla ilk kabul testi yapılmamalıdır.

## İlerleme hesabı (tahmini üretim kabul kapıları)

Toplam ağırlık **100 puan**. Kaynak kod ve yerel test PASS durumu ayrı; canlı/fiziksel kabul kanıtı olmadan kapı puanı tamamlanmış sayılmaz.

| Kabul kapısı | Ağırlık | Doğrulanmış puan |
|---|---:|---:|
| Proje ve görev yönetimi | 10 | 10 |
| Scheduler, checkpoint ve lease | 15 | 12 |
| Şifreli kasa, geçiş ve kurtarma | 15 | 12 |
| Otomatik yerel regresyon paketi | 10 | 10 |
| GitHub izinleri ve güvenli aktarım | 15 | 8 |
| Drive OAuth ve güvenli aktarım | 15 | 9 |
| Gerçek MV3 Chrome kabulü | 10 | 0 |
| Windows uzun süreli ve canlı hesap kabulü | 10 | 0 |
| **Toplam** | **100** | **61 (%61)** |

Bu **%61**, ağırlıklı mühendislik kabul tahminidir; fonksiyon sayısı veya başarısızlık olasılığı değildir. Kullanıcının ilk istediği **DeepSeek Free web sohbetinin insansız yürütülmesi** bu kapsama dahil değildir ve bu sürümde **%0 (uygulanmadı)**.

## Yayın kararı

**PC_TEST_CANDIDATE / NOT_PRODUCTION_VERIFIED.** ZIP paketi hazırlanmıştır; önce sentetik görevlerle gerçek Windows Chrome kabulünü yap. Canlı Google/GitHub bağlantılarını üretime açmadan ayrı onaylı testlerle doğrula. DeepSeek Free web otomasyonu eklenmedi.
