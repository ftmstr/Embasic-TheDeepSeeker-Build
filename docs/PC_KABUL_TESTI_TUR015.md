# EMBASIC TheDeepSeeker v1.14.0 — TUR015 Windows PC / Gerçek Chrome MV3 Kabul Kılavuzu

**Durum: NOT_RUN.** Bu kılavuz gerçek fiziksel Windows Chrome kabulünün yerine geçmez. Yalnız sentetik proje/dosya ve atılabilir Chrome profili kullan; gerçek soruşturma, kişisel veri veya kurum sırrı kullanma.

## Ön koşullar

1. Chrome 120+ Windows 10/11, Python ve Playwright; Node.js 20+ yapısal regresyon için.
2. Mevcut Chrome uzantısını **silme**. Önce ayrı bir `.emback` şifreli yedek oluştur, parolayı başka güvenli yerde tut. Aynı `manifest.json` klasörü içindeki dosyaları güncelle ve `chrome://extensions` → **Yeniden yükle** yap; farklı klasör uzantı kimliği ve Chrome storage sürekliliğini değiştirebilir.
3. `EMBASIC_DeepSeek_Agent_v1.14_TUR015_Chrome.zip` dosyasını çıkar; ZIP kökünde `manifest.json` olmalı. Chrome → `chrome://extensions` → Geliştirici modu → Paketlenmemiş öğe yükle.
4. Manifest sürümü `1.14.0`. Google OAuth için gerçek Chrome uzantı kimliğine bağlı istemci kimliği ayrıca yapılandırılmalı; paket varsayılan `YOUR_...` ile canlı OAuth **çalışmaz**.

## Otomatik yerel ve gerçek-worker komutları

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1
powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1
```

İkinci komut fiziksel Windows Chrome oturumu ister; `EMBASIC_REQUIRE_MV3=1`, `EMBASIC_HEADLESS=0` ve worker keşfi 15 saniye. Worker bulunmazsa **FAIL** olur. Linux'ta `python tests/test-mv3-extension.py` worker'ı bulamazsa `NOT_RUN` yazması kabul başarısı değildir.

## Fiziksel adımlar (her adım için zaman, ekran görüntüsü ve gizlisiz kanıt kaydı tut)

- **Kasa:** İlk kurulumda kasasız görev ekleme engelli; kurulum, kilit/aç ve aynı Chrome profilinde tam yeniden başlatmadan sonra anahtar tekrar isteniyor; görevler ve şifreli yerel geçmiş korunuyor.
- **Alarm:** Gerçek Chrome worker/`embasic-scheduler` 1 dakikalık alarm; Chrome restart ve uyku/uyanma dönüşünde yeniden kurulum; bekleyen tur mükerrer üretilmiyor. 24 saat gerçek uyku/uyanma için süreli ayrı fiziksel gözlem yap. Chrome kapalıyken çalışma garantisi yoktur.
- **Kurtarma:** Sentetik checkpoint bozulması, `KURTAR` onayı sonrası önceki tüm turların `recoveryQuarantined` ile bloklanması; manuel yeniden dene ve public onayın eski turu yeniden yayımlayamaması; açık kullanıcı eylemiyle yeni tur hazırlanması.
- **GitHub:** Sadece sentetik ve tercihen Private test repo + yalnız ilgili depoya en az yetkili fine-grained PAT. Kayıp dal POST ACK / kayıp rapor PUT ACK sonrası **tek** mutasyon, takip eden GET 404 durumunda ikinci yazma yok, tam uzak içerik readback; branch head yarışında bekleme/bloke. Public yazma için her tur özelinde açık onay ve `main` koruması.
- **Drive:** Salt OAuth bağlantısında klasör POST yok. `drive.file` kapsamı; onaylı rapor ile app-owned klasör ve rapor; `appProperties`, ebeveyn, dosya baytı ve SHA doğrula. 401 GET yeniden yetki, 401/403/429 POST belirsizliği, yenilenmiş token ile ikinci POST yok; belirsiz klasörde farklı projenin tekrar POST göndermemesi.
- **Bağımsız istemci:** Ayrı Chrome profili/cihaz testleri salt yerel marker ile garanti edilemez; uzak sağlayıcıda çapraz-istemci çakışma ve şartlı yazma tasarımı eklenmeden `PRODUCTION_NO_GO` kalmalı.
- **Gizlilik:** tanılama kilitliyken proje, token, şifre, içerik ve belirsiz iş sayısı ifşa etmemeli; sunucu hataları credential redaction'dan geçmeli.

**PASS/FAIL/NOT_RUN kaydını ayrı ayrı tut.** Yerel Node ve sahte Chrome nesneleri fiziksel Windows veya canlı OAuth/GitHub/Drive API kabulünün yerine geçmez. Kullanım koşullarını aşan DeepSeek Free otomasyonu hiçbir şekilde denenmez.
