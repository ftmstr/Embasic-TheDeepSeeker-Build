# EMBASIC DeepSeek Agent v1.2 — Windows Chrome PC kabul kılavuzu

## Ön hazırlık

- Yalnızca sentetik görevler ve özel test depoları kullan. Özel soruşturma belgelerini yükleme.
- Eski sürüm güncelleniyorsa önce şifreli `.emback` yedeği al, kaynak klasörünü kopyala; uzantıyı kaldırma. Aynı klasörde dosyaları yenile ve Chrome'da `Yeniden yükle`.
- `chrome://extensions` → ayrıntılar → sürüm **1.2.0**, uzantı kimliği, `Servis çalışanı / İncele` görünümü doğrulanmalı.

## Adım adım kabul

1. Panel açılıyor mu? Uygulama başlığında **v1.2 TUR003** yazmalı.
2. `Yerel veri kasası` bölümünde en az 12 karakterli güçlü parola oluştur; ilk kurulumda **ŞİFRELİ / AÇIK** görünmeli.
3. Test görevi oluştur: `Test Projesi Alfa`, 1 saat, 2 tur; başka bir `Test Projesi Beta` oluştur.
4. Aynı görev iki kez planlanıyor mu? `Zamanlayıcıyı şimdi kontrol et` birkaç kez; her görev için yalnızca bir bekleyen tur olmalı.
5. Alfa turunu tamamla; Beta'nın özetine Alfa verisi girmemeli.
6. Kasa `Kilitle` düğmesine bas; görev/rapor içerikleri kaybolmalı ve sistem kullanıcıya parola sormalı.
7. Yanlış parola dene: reddedilmeli. Doğru parola: eski turlar dönmeli.
8. Tarayıcıyı tamamen kapat/aç: arşiv yeniden kilitli olmalı. Doğru parola sonrası içerik değişmemeli.
9. DevTools → uzantının `Service Worker` konsolunda hata olmamalı. Storage bölümünde `embasicSealedStateV3` görünmeli; `embasicStateV2` ve `embasicStateV1` görünmemeli. **Gerçek içerikleri veya anahtarları ekran görüntüsüyle paylaşma.**
10. Test kapsamında 1 saat açık Chrome bekle; aynı iş için duplicate turn oluşmamalı. Uyku/uyanma deneyi ile kaçırılan saatlerin topluca gönderilmediğini doğrula.
11. GitHub'da yalnızca test depolu fine-grained PAT kullan; `Contents read/write` dışında gereksiz yetki verme. Token kasasını ayrıca kilitli test et.
12. GitHub senkronizasyonda yalnız `embasic-agent/<görevID>` dalı ve `agent-reports/...` dosyaları yaratılmış mı? `main` değişmemeli.
13. Test deposunu public yapacaksan ilgili tur için açık onay ekranı gelmeli; onaysız aktarım engellenmeli.
14. Google Cloud Chrome Extension OAuth istemcisini *gerçek uzantı kimliği* ile yapılandır, `manifest.json` değiştir ve reload yap. Yetki yalnızca `drive.file` olmalı.
15. Drive'da `EMBASIC DeepSeek Agent / Test Projesi [...] / UUID.md` oluşmalı. Aynı raporu tekrar senkronize ederken dosya çoğalmamalı.
16. Google ve GitHub ağ hatası senaryosunda `retry` statüsü ve sonradan manuel retry çalışmalı. Hesapta izinsiz silme/merge olmamalı.
17. Şifreli `.emback` yedeği dışarı al, yanlış parola ile geri açılmasını dene; reddedilmeli. Doğru parola ile geri yükleme bütün görevleri durdurmalı.
18. `Kasa kilitli` durumundayken manuel `Zamanlayıcı` ya da senkronizasyon tetikleme denemesi arşivi değiştirmemeli.

## Değerlendirme

- Gerçek Chrome servis çalışanı, alarm, canlı OAuth ve GitHub/Drive API işlemleri ayrı ayrı **PASS** olursa PC kabulünün ilgili kapısı kapanır.
- Chrome extension Service Worker açılmazsa veya Google OAuth istemci kimliği eksikse **BLOCKED/NOT_RUN** kaydet; PASS yazma.
- 1 saatlik görev hazırlığı, DeepSeek Free web modeliyle **insansız yapay zekâ üretimi değildir**. Bu davranış için modelin izinli ayrı API/yerel erişimi gerekir.
