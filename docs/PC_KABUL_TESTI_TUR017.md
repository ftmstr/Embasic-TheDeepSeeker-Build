# TUR017 v1.16.0 — Windows Chrome MV3 ve uzak CAS kabul kılavuzu

**Gerçek durum: NOT_RUN / PRODUCTION_NO_GO.** Yalnız izole test Chrome profilleri, atılabilir repo ve sentetik veriler; gerçek soruşturma evrakı, hesap anahtarı veya hassas dosya ile test YASAK.

## 1. Sağlamlık / paket

Önce `Get-FileHash -Algorithm SHA256` ile `EMBASIC_TheDeepSeeker_v1.16_TUR017_{Chrome,Source}_Canonical.zip` dosyalarını `EMBASIC_TheDeepSeeker_v1.16_TUR017_SHA256_Canonical.txt` ile karşılaştır. Eklentiyi mevcut Chrome kurulumundan kaldırma: önce `.emback` şifreli yedeği al, aynı uzantı klasörüne güncelle ve yeniden yükle, `manifest.json` v1.16.0 ve profil kimliğini kontrol et.

## 2. Yerel/doğal Chrome testleri

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1
powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1
```

İkinci komut **gerçek Windows masaüstü Chrome worker** açamıyorsa FAIL. İki ayrı gerçek extension-origin sayfası aynı `navigator.locks.request(... exclusive)` kilidine girmemeli; ikinci sayfa ilk kilit bırakılana kadar beklemeli. Sentetik kasada kilitle/aç, tam tarayıcı restart, 1dk alarm, mükerrer bekleyen run olmaması, `storage.local` ciphertext ve `storage.session` key reset doğrulanmalı. 24s/uyku-uyanma iş akışı ayrıca kullanıcı tarafından gözlenmeli; çalışmadıysa `NOT_RUN`.

## 3. Bağımsız profil / farklı cihaz için kabul

- **İki ayrı fiziksel Chrome profili, farklı hesap/cihaz, aynı sentetik GitHub repo:** `refs/heads/embasic-claims/<taskId>/<runId>` CREATE-only yarışını **canlı** resmi GitHub REST API ile dene. İki istemci farklı nonce+claim commit SHA ile yarışırken yalnız bir ref oluşmalı. 422/409/401/403/429, değişen ref, kayıp ACK ve GET 404 durumlarında ikinci CREATE yapılmadığını, sahte SHA ve uyumsuz rapor digest'inin reddedildiğini kanıtla. Mevcut uygulama remote claim'i otomatik kullanmıyor: deneysel ayrı protokolün canlı testi tamamlanmadan production **NO_GO**.
- **Drive global folder**: farklı profiller aynı `driveFolderIntents` verisini paylaşmaz. Sentetik adversarial test iki ayrı `POST` riski gösterdi. GitHub ref claim'i Drive `files.create` ile atomik şart olarak uygulanmadıkça dağıtık tekillik kabulü **FAIL/NOT_PROVEN**.
- **İmzalı witness**: üretim için bağımsız monotonic server ve pinlenmiş P-256 public key, generation artırma CAS, tazelik/nonce imzalama, signature rotation, offline ve rollback kuralı gerekir. Sadece geçerli eski ciphertext'in tanıkla karşılaştırılması PoC testidir; gerçek anti-rollback hizmeti `NOT_RUN`.
- **Uygulama güvenliği**: eski encrypted snapshot ile eşzamanlı backup restore denemesinde `STALE_LOCAL_WRITER` ve veri korunması. Kasa kilitliyken tanılamadan gizli proje/commit kimliği sızmamalı.
- OAuth GET 401 yenileme en fazla bir kere, POST 401/403/429 otomatik tekrar yok, GitHub branch/PUT ACK kaybı, Drive folder WAL, sahiplik/parent/gerçek bayt readback; yalnız sentetik içerik. Test sonuçları PASS/FAIL/NOT_RUN ve UTC zamanlı ekran/kayıtla ayrı raporlanmalı.

**İşlem öncesi son kapı:** gerçek bağımsız uzak CAS ve anti-rollback sunucu yoksa veya fiziksel Chrome testleri tamamlanmadıysa `PC_TEST_CANDIDATE / PRODUCTION_NO_GO` devam eder. DeepSeek Free'ye insansız otomatik mesaj/DOM okuma yok; main merge/deploy yok.
