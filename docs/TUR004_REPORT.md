# EMBASIC DeepSeek Agent TUR 004 — Teknik, test ve güvenlik raporu

**Tarih:** 08.11.2026  
**Başlangıç sürümü:** v1.2.0 / TUR003  
**Yeni sürüm:** v1.3.0 / TUR004  
**Karar:** Yalnızca Windows PC kabulüne aday — canlı üretim onayı **YOK**

## 1. Önceki paketlerin doğrulanması

- `EMBASIC_DeepSeek_Agent_v1.2_TUR003_Chrome.zip` SHA-256: `f98a550bd193fe10283346fd091cb1dc60a586330ba53c961a420c1a9640f441` — **PASS**.
- `EMBASIC_DeepSeek_Agent_v1.2_TUR003_Source.zip` SHA-256: `d3547289b63a0ea2141a6063ca8362bf05282660e8a266bbb8f46dc398d19c6a` — **PASS**.
- TUR003 teknik raporu, Windows kabul rehberi, 8 Node.js test grubu, HTML/manifest statik testi, Chromium **mock** UI testi incelendi ve tekrar **PASS**.
- Önceki TUR003 gerçek MV3 worker testi **NOT_RUN** olarak raporlanmıştı. Yeni turda da Linux headless worker expose edilemedi; `xvfb-run` headful denemesi zaman aşımına uğradı. Bu, fiziki Windows kurulumu yapıldı demek değildir.

## 2. Uygulanan kod değişiklikleri

| ID | Somut değişiklik | Kanıt |
|---|---|---|
| SEC-01 | Yeni kurulum ve yükseltmede kasa gerekliliği (`embasicRequireVaultV4`), yeni görev / cevap kaydı / ayar / bulut bağlantısına fail-closed kontrolü | `test-tur004-vault.cjs` |
| SEC-02 | Chrome yerel/session depolamasına `TRUSTED_CONTEXTS` erişim seviyesi (API destekleniyorsa) | `background.js`; statik kontrol |
| SEC-03 | Son sağlam yalnız-şifreli AES-256-GCM kontrol noktası, kontrollü kurtarma, `KURTAR` onayı, sağlıklı kasada geri almaya izin vermeme | `test-tur004-vault.cjs` |
| SEC-04 | Şifreli yazımda önce recovery ciphertext, sonra yeni sealed ciphertext; hata enjeksiyonunda son commit bozulmuyor | `test-tur004-vault.cjs` |
| SCHED-05 | MV3 açılışında alarmı tekrar sağlama; uyku/yeniden başlatma sonrası gecikmiş görevi kontrol etme; bekleyen görev tekrarı engeli | `test-tur004-scheduler.cjs` |
| SYNC-06 | GitHub/Drive için şifreli arşivde kalıcı 10 dk lease; çökme sonrası süresi dolunca yeniden deneme; manuel retry override | `test-tur004-scheduler.cjs`, `test-sync.cjs` |
| DRIVE-07 | Adla bulunan başka kullanıcının klasörünü kullanmamak için app-owned `appProperties` kontrolü | `test-tur004-cloud.cjs`, API mock |
| DRIVE-08 | Rapor tur/görev kimliği ve SHA-256 eşleşmesi, `alt=media` gerçek uzak bayt denetimi; uzak içerik değişmişse fail-closed | `test-tur004-cloud.cjs` |
| DRIVE-09 | Başarılı uzak yükleme fakat yanıt kaybında aynı raporun yeniden yüklenmesini engelleme | `test-idempotence.cjs` |
| UI-10 | Türkçe zorunlu kasa uyarısı, kurtarma düğmesi, `v1.3 TUR004`, güncel yerel tanılama | `test-ui-smoke.py` (MOCK) |
| PKG-11 | Tekrarlanabilir ZIP, kaynak testleri, kurulum / SHA-256 ve Windows test kılavuzu | `tools/package.py`, `test-package.py` |

## 3. Test matrisi

| Kanıt | Sonuç | Açıklama |
|---|---|---|
| 8 eski Node.js test grubu | **PASS 8/8** | Yerel ve HTTP mock, canlı servis değil |
| 3 yeni TUR004 Node.js test grubu | **PASS 3/3** | Yeni kurulum, şifreli rollback, API response-loss/remote tamper, saatlik restart/lease |
| `test-package.py` | **PASS** | Chrome MV3 manifest, izinler, dosyalar, HTML ID'leri |
| `test-ui-smoke.py` | **PASS** | Gerçek Chromium DOM ama **mock Chrome runtime** |
| Gerçek Chromium MV3 uzantı worker | **NOT_RUN** | Linux konteyner worker expose edemedi; headful xvfb testi zaman aşımı |
| Fiziksel Windows Chrome yükleme / reloading | **NOT_RUN** | Kullanıcı PC kabulü gerekiyor |
| Gerçek Google OAuth ve dosya yükleme/okuma | **NOT_RUN** | Kullanıcı OAuth client ve hesabı bağlanmadı |
| Gerçek GitHub branş/commit / aynı-content kontrolü | **NOT_RUN** | Hesap veya repo yazma testi yapılmadı |
| PC uyku-uyanma ve 24 saat zamanlayıcı | **NOT_RUN** | Fiziksel deney gerek |
| DeepSeek web arayüzünde insansız model etkileşimi | **NOT_IMPLEMENTED** | Tasarım gereği; web otomasyonu eklenmedi |

**Sonuç:** **13/13 yerel test grubu PASS**, bağımsız gerçek servis çalışanı + canlı entegrasyon **NOT_RUN**. Bu iki başarı grubu birbirine eşit değildir.

## 4. Güvenlik ve kalan riskler

1. Kurtarma kontrol noktası ayrı fiziksel disk / harici imza / anti-rollback değildir. Uygulama bir önceki işlemi geri alabilir; parolanın kaybını çözemaz.
2. v1.2 açık arşivden geçiş yazılımsal silme yapar; SSD, Windows yedek, geçici profil, adli disk izi bakımından güvenli fiziksel silme garantisi vermez.
3. v1.2'nin `drive.file` kapsamındaki etiketlenmemiş klasörlerine otomatik sahiplenme yapılmaz; TUR004 etiketi olmayan dosya üzerine yazmaz. Eski raporlar ayrı klasörde kalabilir; çift klasör maliyetinin kabulü PC'de kontrol edilmeli.
4. Güvenlik yalnız eklentinin yetkili API kodu düzeyindedir; kötü amaçlı işletim sistemi, kötü niyetli yerel kullanıcı veya parolası bilinen profil sınırı dışında.
5. GitHub token için fine-grained PAT önerilir; public repo yayın izni her tur için açık kullanıcı kararıdır. Program yalnız rapor dalına yazar ve main dalını değiştirmez.
6. Drive `appProperties` ve uzak bayt doğrulaması bütünlük kontrolüdür; dağıtık tam işlem garantisi değildir. Üçüncü taraf API, ağ kesintisi ve eşzamanlı uzaktan değiştirme yarışları hâlâ mümkündür.
7. DeepSeek Free sohbetinde otomatik tıklama, mesaj gönderme, scraping veya hesap limit aşma mekanizması **yoktur**.
8. Yedek parolası unutulursa şifreli dosyayı kurtaracak anahtar saklanmıyor. İncelenecek veriler yalnız sentetik olmalı.

## 5. Sürüm kabul kapıları

- **PASS:** Baseline dosya SHA eşleşmesi, yerel testler, kaynak ZIP ve SHA üretimi.
- **PENDING:** Windows Chrome gerçek worker/yükleme, Google OAuth, dar kapsamlı gerçek GitHub/Drive yükleme, 24 saat uyku/uyanma, farklı Windows sürümleri.
- **BLOCK:** Gerçek kişi/soruşturma verisiyle test, otomatik `main` merge, kullanıcı onayı olmadan public repo yayını, DeepSeek web hesabını sınırsız otonom çalıştırdığı iddiası.

## 6. Dayanaklar

- Google Chrome extension service worker/alarms ve kalıcı durum: <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers>
- GitHub REST `contents` API: <https://docs.github.com/en/rest/repos/contents>
- DeepSeek kullanım koşulları (27.03.2026): <https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html>
