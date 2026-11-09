# EMBASIC DeepSeek Agent v1.5.0 — TUR 006 Windows PC kabul kılavuzu

**Statü:** Windows PC üzerinde henüz gerçekleştirilmedi (**NOT_RUN**). Gerçek soruşturma/hukuki dosyalarını, şifreleri veya başka hassas bilgileri testte kullanma. İlk kabulü ayrı, atılabilir bir Chrome profili ve sentetik görevlerle yürüt.

## 1. Güvenli yükseltme ve kurulum

1. Mevcut v1.4 `.emback` **şifreli** yedeğini al; ayrı diskte sakla ve parolasını doğrula. Eklentiyi Chrome'dan kaldırma.
2. TUR006 `v1.5` Chrome ZIP'i aç; kök dizindeki `manifest.json` sürümü `1.5.0` olmalı.
3. Aynı Chrome profili, eski uzantı **klasör yolu** ve aynı uzantı kimliği korunarak eski dosyaların üzerine yeni dosyaları kopyala. `chrome://extensions` → **Yeniden yükle**.
4. Chrome → `chrome://extensions` → sürüm `1.5.0`; **Hatalar** ve **Service worker / İncele** bölümlerini kontrol et. Worker kaydolmazsa daha ileri teste geçme.
5. Arşivin mevcutsa kasayı aç; eski görev, tur sayısı ve proje isimlerini karşılaştır. Kilitli kasa hiçbir görevi veya eski içeriği göstermemeli.
6. İlk kurulumda önce kasa oluşturulmadan görev oluşturma reddedilmeli; güçlü, benzersiz 12+ karakter parola kullan.

## 2. Otomatik yerel testler (kaynak ZIP ile)

Windows bilgisayara Node.js 20+, Python 3 ve gerçek uzantı testi için Playwright kur. Kaynak ZIP'den:

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1
python -m pip install playwright
python -m playwright install chromium
python tests/test-mv3-extension.py
```

- `test-windows.ps1`: **20 Node.js testi + statik paket kontrolü**. PC'de çalıştırıldığında gerçek sonuçları kaydet.
- `test-ui-smoke.py`: **Mock Chrome runtime** ile DOM testi; gerçek worker testi sayılmaz.
- `test-mv3-extension.py`: Unpacked uzantı gerçek Chrome/Chromium worker'ını, alarmı, kasa oluşturma, gizli verinin kalıcı depoda şifreliliğini, kasa kilidi ve tarayıcının kalıcı profil üzerinden gerçek yeniden başlatılmasını test etmeyi **dener**.
- Test `NOT_RUN` derse **PASS değildir**. Grafik ortamı, Chromium'un eklenti desteğini, profil/izinlerini doğrula; gerçek fiziksel Chrome kurulumu ile elle kabul yap.

## 3. Gerçek MV3 / 1 saatlik görevler

- [ ] `chrome.alarms.get('embasic-scheduler')` 1 dakika döngüsüyle kurulu (görev aralığı ayrı: en az 1 saat).
- [ ] Arşiv **kilitliyken** worker görev üretmiyor veya bulut raporu göndermiyor.
- [ ] Kasa açıkken sentetik 2 görev oluştur; her biri için yalnızca **1 bekleyen tur** bulunuyor.
- [ ] Worker DevTools'u kapat, Chrome'u tamamen kapat ve yeniden aç; kasa kilitli, şifreli kayıt duruyor. Parolayla açınca tur sayısı değişmemiş.
- [ ] Chrome uyku/uyanma ve 24 saatlik alarm gözlemi yap (yapılmadıysa **NOT_RUN**). Chrome kapalı veya bilgisayar uykudayken zamanında iş yürütme garantisi yok.
- [ ] Tanılama panelinde **lastSchedulerAt**, `deferredTasks`, `staleLeases`, sonraki görev zamanı; kilitliyken `null`/gizli görünüyor. Token veya parola ekranda/logda bulunmuyor.

## 4. Şifreli arşiv kurtarma

- [ ] Yanlış parola ve değiştirilmiş şifreli dosya güvenle reddediliyor.
- [ ] Sağlam aktif kasa, eski kurtarma kopyası ile sessizce geri alınmıyor.
- [ ] Atılabilir Chrome profilinde simüle veri bozulması sonrası `KURTAR` onayıyla yalnız son sağlam şifreli kopyaya dönüş yapılıyor; **son kaydın kaybolabileceğini** kaydet.
- [ ] Eski v1.0–v1.4 arşiv geçişinde görev/tur sayısı ve kullanıcı izni korunuyor. Açık eski kayıtların disk seviyesinde güvenli silindiği iddia edilmez.

## 5. Google Drive / GitHub canlı testleri — bu turda NOT_RUN

- [ ] Google Chrome Extension OAuth Client ID, gerçek uzantı ID'sine karşılık geliyor. Yalnız `drive.file` kapsamı onaylanıyor.
- [ ] İki kere 401 dönen token, başka interaktif pencere çıkmadan iptal ediliyor; 403 yetki yükseltmiyor.
- [ ] Drive'da etiketli proje klasörü ve doğru `embasicRun`/SHA raporu oluşuyor; tekrar denemede mükerrer dosya yok. Uzak içerik değişirse engel çıkıyor.
- [ ] GitHub fine-grained token yalnız **test deposu** Contents read/write yetkisiyle çalışıyor; sadece `embasic-agent/<task-id>` dalı değişiyor. `main/master` üzerinde hiçbir yazma yok.
- [ ] Ağ bağlantısı kesildiğinde uzaktaki gerçek kayıt geri okunmadan ikinci yazma yapılmıyor; lease dolmuşsa eski worker yeni yazma başlatamıyor.
- [ ] Public depo için kullanıcı izni ayrıca gerekiyor. Otomatik merge/deploy ve DeepSeek web sohbet otomasyonu **yok**.

**Kabul:** Tüm gerçek Chrome/Drive/GitHub testleri yapılmadan `üretim onayı` verilmez. Bu çalışma bir yerel kabul sürümüdür; bulut servisleriyle uçtan uca test edilmiş değildir.
