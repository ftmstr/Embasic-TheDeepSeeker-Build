# EMBASIC DeepSeek Agent v1.4.0 — TUR005 Windows PC kabul kılavuzu

**Durum:** PC üzerinde henüz çalıştırılmadı (**NOT_RUN**). Yalnız sentetik veri, ayrı test GitHub deposu ve gerekirse ayrı Google Drive hesabı kullan. Gerçek kurum/veri dosyaları ve gizli anahtarları sohbet çıktısı olarak kullanma.

## 1. Ön hazırlık (veri kaybını önleme)

- [ ] v1.3 klasörünün tamamını güvenli bir yerde yedekle; mümkünse uygulamanın `.emback` şifreli yedeğini al, parolayı ayrı sakla.
- [ ] Mevcut eklentiyi **Chrome'dan kaldırma**. Eski uzantının `manifest.json` bulunan aynı klasörünü güncelleyerek **Yeniden yükle**. Farklı klasör/Chrome profili farklı uzantı ID ve ayrı saklama alanı oluşturabilir.
- [ ] Arşiv mevcutsa şifreli kasayı aç; parolayı kaybettiysen üretim verisinde kurtarma denemesi yapma.
- [ ] `chrome://extensions` üzerinden sürüm `1.4.0`, hata konsolu temiz, DevTools'ta MV3 worker denetlenebilir.

## 2. Gerçek MV3 worker ve yaşam döngüsü

- [ ] Worker konsolunda `chrome.alarms.get('embasic-scheduler').then(console.log)` çağrısı 1 dakika periyot gösterir.
- [ ] Kurulum ve tanılama: `MV3 servis çalışanı: ÇALIŞIYOR / alarm mevcut`, `Zamanlayıcı aralığı: 1` görünür.
- [ ] Kasa kurulmadan görev oluşturmak reddedilir. Kasa açıldıktan sonra 1 saat aralıklı sentetik görev, 2 tur sınırıyla kaydedilir; aynı göreve yalnız 1 bekleyen tur oluşturulur.
- [ ] Kasa kilitlenince `snapshot`/görev içerikleri görünmez; görev/senkronizasyon işlemleri durur.
- [ ] Chrome'u **tamamen kapatıp** yeniden aç; kasanın kilitli olduğunu doğrula. Parola girip açınca görevler ve bekleyen tur aynen durmalı; ekstra tur oluşmamalı.
- [ ] Gerçek 1 saatlik zaman aralığı, Chrome yeniden başlatma, uyku/uyanma en az 24 saat gözlemle test edilir. Alarm bilgisayarı uykudan uyandırmaz; kaçırılan saatler toplu çalıştırılmaz.
- [ ] Kaynak ZIP'deki `tests/test-mv3-extension.py` Playwright + Chromium yüklüyse gerçek uzantı worker'ını test etmeyi dener; bu testin `NOT_RUN` sonucu PASS değildir.

## 3. Şifreleme ve kurtarma (ayrı sentetik Chrome profilinde)

- [ ] Yanlış parola reddedilir; temiz durumda kurtarma geri alması reddedilir.
- [ ] Farklı saltlı sağlam aktif kasa + eski kurtarma kopyası senaryosu testte korunur. Aktif kasayı manuel olarak bozma işlemi **yalnız ayrı atılabilir profil/yedekle** yapılmalıdır.
- [ ] Kasayı kilitleme/kapatma; `chrome.storage.session` içinde çözülmüş anahtarın kalmaması. Parola yanlışsa sessiz eski açık metin fallback olmaması.

## 4. Google Drive / GitHub canlı entegrasyon (henüz NOT_RUN)

- [ ] Chrome Extension OAuth Client ID, gerçek uzantı kimliği ile eşleşir; `drive.file` yetkisi dışında gereksiz erişim istenmez.
- [ ] Google Drive yalnız uygulamaya ait etiketli klasörleri kullanır. Aynı rapor ikinci kez oluşturulmamalı; uzak içerik değiştirilirse aktarım blocked.
- [ ] Drive klasör oluşturulurken ağ cevabı kaybolursa sahiplik etiketli **tek** kayıtla iyileşir; iki çakışan klasör varsa fail-closed.
- [ ] Yalnız seçili test deposunda fine-grained PAT ve *Contents: Read and write* kullan; ajan dalına rapor yazılır, `main/master` değişmez.
- [ ] GitHub'da aynı run ID raporu tekrar yazılmaz, uzak içerik değişirse üzerine yazılmaz. Public depoya her tur için açık onay gerekir.
- [ ] Aktarım sürerken manuel yeniden denemenin aktif 10 dakikalık lease'i sıfırlamadığını ve süre dolunca temkinli kurtarmayı kontrol et.

## 5. Test durumları ve tanılama raporu

- [ ] Yerel terminal: `node --version`, `bash tests/run_all.sh` (Linux/Git Bash) veya `tools/test-windows.ps1` (PowerShell).
- [ ] Tanılama ekranı alarm, kasa ve lease sayısını gösteriyor; **token, parola, görev içeriği, proje adı** raporda görünmüyor.
- [ ] Her maddeyi PASS / FAIL / NOT_RUN olarak işaretle. Eklenti, Chrome sürümü, Windows sürümü ve anonim hata mesajlarını kaydet; erişim tokenlarını veya gerçek belgeyi hata raporuna ekleme.

**Kabul kararı:** Bu kontrol listesindeki gerçek MV3/Drive/GitHub aşamaları PC üzerinde başarıyla tamamlanıncaya kadar üretim onayı **YOK**. DeepSeek Free web sohbetini insansız otomatik kullanma özelliği tasarım gereği bulunmaz.
