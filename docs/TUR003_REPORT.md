# EMBASIC DeepSeek Agent — TUR 003 teknik, güvenlik ve doğrulama raporu

**Tarih:** 08.11.2026  |  **Başlangıç:** v1.1.0 TUR002  |  **Yeni sürüm:** v1.2.0 TUR003

## Doğrulanan TUR002 girdileri

- `EMBASIC_DeepSeek_Agent_v1.1_TUR002_Chrome.zip`: SHA-256 `b998ef267246998c0d989fb811dea04b5acfee551b6810e7a8808fbb2c176dd2` — **eşleşti**.
- `EMBASIC_DeepSeek_Agent_v1.1_TUR002_Source.zip`: SHA-256 `7090afbc778a16f2907e8db01176804b09bb883c6ae1eb3876d00b4d1f21e440` — **eşleşti**.
- Teknik rapor, PC kabul belgesi, manifest, kod, sekiz başlangıç test grubu incelendi ve TUR003 öncesinde 8/8 PASS alındı.

## Somut değişiklikler

| ID | İşlem | Kanıt |
|---|---|---|
| VAULT-01 | `embasicSealedStateV3` sürümlü şifreli yerel arşiv, AES-256-GCM; her yazımda yeni 96-bit IV ve AAD; PBKDF2-SHA256/310k | `tests/test-state-vault.cjs` |
| VAULT-02 | `chrome.storage.session` anahtarı; kilitleme, açma, yanlış parola ve bozulmuş ciphertext ret; kilitte zamanlayıcı/senkronizasyon blokajı | `tests/test-state-vault.cjs`; arayüz mock testi |
| MIG-03 | v1/v2 açık arşivden tek yönlü geçiş: önce şifreli dosyayı yaz, sonra açık metin anahtarlarını kaldır; yarım kalırsa sealed öncelikli ve unlock'ta temizlik | `tests/test-state-vault.cjs` |
| UI-04 | Türkçe kasa arayüzü, kilitli durum perdesi, tanılamada şifre durumu, mevcut görev ekranı korunarak ekleme | `tests/test-ui-smoke.py` |
| SCHED-05 | MV3 alarmı eksikse veya periyodu değişmişse yeniden oluşturma; kilitte çalıştırmama; mevcut görev başına tek bekleyen tur davranışı korundu | `background.js`, `tests/test-core.cjs` |
| SYNC-06 | GitHub raporu mevcut ve aynı içerikliyse PUT atlama; farklıysa üzerine yazmayı reddetme; proje kimliği koruması | `tests/test-idempotence.cjs` |
| SYNC-07 | Drive dosyasına tur/görev kimliği `appProperties` ekleme ve UUID dosyası bulunduğunda PATCH ile tekrar kullanma | `tests/test-idempotence.cjs` |
| PACK-08 | ZIP, SHA-256, Windows kabul kılavuzu, regresyon seti ve baştan kurulabilir kaynak | `tools/package.py` |

## Doğrulama matrisi

| Kontrol | Sonuç | Çalışma tipi |
|---|---|---|
| Başlangıç kaynak/özet doğrulama | PASS | Gerçek dosya |
| 8 adet Node.js testi (core/security/sync/isolation/backup/races/vault/idempotence) | PASS | Yerel birim + API mock |
| HTML/manifest paket yapısı | PASS | Yerel statik test |
| Dashboard görev oluşturma, yanıt kaydetme, şifreli kasa kilit/aç | PASS | Chromium DOM, **mock Chrome runtime** |
| Chromium MV3 worker tarafı | **NOT_RUN** | Linux headless Chromium 144 uzantı worker'ını expose edemedi |
| Fiziksel Windows Chrome servis çalışanı/alarm | **NOT_RUN** | Kullanıcı PC kabulü gerekir |
| Google Drive canlı OAuth/yükleme | **NOT_RUN** | Gerçek hesap bağlantısı kurulmadı |
| GitHub canlı dal/commit | **NOT_RUN** | Gerçek depoya yazılmadı |
| Uyku/uyanma saatlik davranışı | **NOT_RUN** | Fiziksel PC deneyi gerekir |
| DeepSeek Free insansız üretim | **NOT_IMPLEMENTED** | Şartlar ve tasarım gereği |

## Artık risk ve sınırlamalar

1. **Kasa isteğe bağlıdır.** Yeni kullanıcı kasayı oluşturmazsa eski varsayılan açık metin modu kullanılabilir. Arayüz açık uyarı verir. Hassas içerik için kasayı **önce** etkinleştir.
2. Şifreli kasa kasaya taşınmadan önce oluşmuş verilerin fiziksel ortamdan güvenli silinmesi garanti değildir. İşletim sistemi ve SSD geçmişi/bulut yedekleri ayrıca değerlendirilmelidir.
3. Kasa kilidini açtığında anahtar Chrome'un session storage'ında bulunur; cihazdaki kötü amaçlı yazılımlara karşı donanımsal güvenlik garantisi yoktur.
4. Drive/Google hesabı ve GitHub token işlemlerinin canlı testleri yapılmadı. Sistemin gerçek ağ üzerinde işlem yaptığı veya gerçek commit attığı iddia edilmez.
5. Chrome/PC kapalıyken model görevi gerçekleşmez; arka plan ajanı yoktur. Chrome alarmı uyuyan bilgisayarı uyandıramaz.
6. Proje izolasyonu kimlik ve alan seviyesindedir; fiziksel ayrı güvenlik sandbox'ları oluşturulmamıştır. Regex tabanlı gizli anahtar filtresi eksiksiz DLP çözümü değildir.

## Sürüm kararı

**PC KABULÜNE HAZIR / ÜRETİM ONAYI YOK.** Kaynak kod ve kurulum ZIP oluşturuldu; canlı yayın, GitHub PR/merge, Google Drive API tüketimi veya DeepSeek web otomasyonu yapılmadı.
