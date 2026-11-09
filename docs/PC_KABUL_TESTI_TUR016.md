# EMBASIC TheDeepSeeker TUR016 v1.15.0 — Gerçek Windows PC Kabul Kılavuzu

**Başlangıç kararı: NOT_RUN / PRODUCTION_NO_GO.** Yalnız atılabilir Chrome profili ve sentetik proje verileri. Gerçek dosya, token, soruşturma evrakı, kişisel veri veya kurum sırrı ile test yapma.

## 1. Sürüm ve kurulum

1. Kaynak `EMBASIC_TheDeepSeeker_v1.15_TUR016_Source_Canonical.zip`, Chrome `EMBASIC_TheDeepSeeker_v1.15_TUR016_Chrome_Canonical.zip` SHA-256 belgesini `Get-FileHash -Algorithm SHA256` ile doğrula.
2. Mevcut uzantıyı silme. Önce şifreli `.emback` yedeğini oluştur. Chrome `chrome://extensions` > Geliştirici modu > Paketlenmemiş öğe yükle. Güncellemede eski uzantı klasörü içindeki dosyaları değiştirip **Yeniden yükle**; farklı klasör/ID yerel verilerin yeni profil olarak görünmesine yol açabilir.
3. `manifest.json` v1.15.0; OAuth placeholder ise canlı Google bağlantısı çalışmaz.

## 2. Gerçek Chrome MV3 testi

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1
powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1
```

İkinci komut fiziksel Windows Chrome masaüstü oturumu ister; `EMBASIC_REQUIRE_MV3=1`, `EMBASIC_HEADLESS=0`; worker görünmezse **FAIL**, `navigator.locks.request` gerçek worker'da yoksa **FAIL**. Linux'ta worker hiç görünmezse `NOT_RUN`; test edilen Playwright UI mock gerçek worker değildir.

## 3. İzole adversarial senaryolar — her birini PASS / FAIL / NOT_RUN ve saatli kanıtla kaydet

- **Web Locks:** aynı uzantı origin'ine sahip iki bağımsız worker/pencere bağlamında eşzamanlı görev durumu yaz; her ikisi de okunmalı, şifreli kasada yetkisiz açık metin bulunmamalı. `navigator.locks` yoksa kabul **FAIL**. Ayrı profil ve ayrı cihazın Web Locks kilidini paylaşmadığını kabul et; haricî CAS kanıtı olmadan üretime geçme.
- **Kasa:** şifreli ilk kurulum, kilitle/aç, tam tarayıcı restart, şifreli veri bütünlüğü, kullanıcının `KURTAR` onayı, kurtarılan eski run için manuel retry/public onay engeli. Dıştan eski geçerli ciphertext geri yüklenmesini AES-GCM kendi başına tespit etmez; `anti-rollback NOT_PROVEN`.
- **MV3 scheduler:** 1 dakika alarm, worker suspend/restart, 24 saat/uyku-uyanma davranışı; bekleyen tur mükerrer oluşmaz. Chrome/PC uykudayken saatlik çalıştırma garantisi yoktur.
- **GitHub:** yalnız sentetik private repo ve en az yetki PAT ile dal POST 409/422/ACK kaybı, rapor PUT belirsiz ACK, doğrulanmış tam byte readback, branch HEAD drift, repo private→public onay kapısı. Main üzerinde commit/merge/deploy yok. Uzak CAS/ACK ve başka cihaz yarışları üretim kabulünden önce ayrı çalışılmalı.
- **Drive/OAuth:** bağlantı salt okunur; yalnız kullanıcı onaylı arşivleme sırasında lease + şifreli klasör WAL; OAuth GET 401 tek noninteractive yenileme, POST 401/403/429 tekrar yok; uzak sahiplik, ebeveyn, kimlik, metadata, gerçek bayt kontrolü, farklı projelerle belirsiz root POST engeli.
- **Gizlilik:** kilitli kasada proje verisi ve belirsiz iş sayıları tanılamada görünmez; hata kayıtlarında credential redaction; izin dışı DeepSeek Free otomasyonu yok.

**Ayrım:** 70 Node + paket + MOCK Chromium UI yerel doğrulama, gerçek Chrome/Windows ve canlı API kabulünün yerine geçmez. Fiziksel testler tamamlanana dek `PRODUCTION_NO_GO`.
