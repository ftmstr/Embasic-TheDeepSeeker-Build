# EMBASIC DeepSeek Agent TUR007 v1.6 — Windows Chrome fiziksel kabul

**Sadece sentetik/gizli olmayan veriler kullan.** Gerçek hesap token'larını test günlüklerine yazma. Bu adımlar otomatik yürütülmedi; tamamı **NOT_RUN**.

## 1. Paket ve yükseltme

1. Chrome'da eskisini kaldırmadan uygulama üzerinden şifreli `.emback` yedeği al. Parolayı ayrı güvenli yerde tut.
2. ZIP `EMBASIC_DeepSeek_Agent_v1.6_TUR007_Chrome.zip` içeriğini mevcut uzantı klasöründeki **aynı manifest.json yoluna** çıkar. Chrome → `chrome://extensions` → **Yeniden yükle**. Yeni klasör/uzantı kimliği oluşturarak eski yerel verilere erişimi kaybetme.
3. `manifest.json` sürümü `1.6.0` olmalı. `chrome://extensions` ekranında hata olmamalı. Gerçek hatayı ekran görüntüsü ve console log ile kaydet.
4. İlk kurulumda kasa oluşturmadan görev kaydı denenirse reddedilmeli; 12+ karakter güçlü parolayla kasa kurulmalı.

## 2. Yerel regresyonlar

PowerShell'de kaynak paketi klasöründe:

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1
```

Node.js 20+, Python ve Chromium mock UI testi için Playwright gereklidir. Betik 24 Node.js ve paket testini çalıştırır; mock UI için ayrıca `python tests/test-ui-smoke.py` kullanılabilir.

## 3. GERÇEK Chrome MV3 servis çalışanı kabulü

Chrome yüklü Windows masaüstü oturumunda Python Playwright kurulu olmalı. Kaynak paketi içinde:

```powershell
python -m pip install playwright
powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1
```

Bu, **gerçek Chrome** çalıştırır, geçici temiz profil ve sentetik görevler kullanır. MV3 worker yüklenmemişse `NOT_RUN` yerine **FAIL** ile çıkar; sessiz başarı yoktur. Kontroller: gerçek alarm kurulumu, kilitli kasanın engeli, ilk kasa oluşturma, bir bekleyen tur, şifreli yerel veri/geri yükleme kopyası, kilitle/aç, Chrome kapatma/açma, kilidin korunması, tekrar eden tur oluşmaması ve tanılama.

Ek manuel denetim: `chrome://extensions` → servis çalışanı **İncele** → Console hata yok; Chrome kapat-aç → alarm geri kuruluyor; bilgisayar uyku/uyanma sonrası süresi dolmuş görev yalnız bir kez kuyruklanıyor; yanıt verilmeden ikinci bekleyen tur oluşmuyor.

## 4. Canlı bağlantı kabulü (hiçbiri burada çalıştırılmadı)

- Google Cloud'da bu Chrome uzantısının kimliğiyle eşleşen OAuth istemci kimliğini yapılandır; yalnız `drive.file`. Ayrı test Google hesabında uygulama klasörü açılışı, sentetik rapor yazma, aynı rapor tekrar denendiğinde yeni dosya oluşmaması, bozuk uzak içerik varsa otomatik overwrite engeli ve 401/403 tekrar-yetkilendirme kontrolü.
- GitHub fine-grained PAT yalnızca seçili **test deposunda** `Contents: Read and write` yetkisiyle; anahtar session veya ayrı şifreli kasada. Raporun yalnız `embasic-agent/<taskId>` dalında olduğunu, mevcut rapor farklıysa üzerine yazılmadığını, `main` dalının değişmediğini doğrula.
- Public GitHub için tur bazlı açık izin olmadan yükleme reddedilmeli. Gerçek veya hassas hukuk dosyalarını test deposuna koyma.

## 5. 24 saat ve hata kurtarma

En az 24 saat açık Chrome kullanımı, çoklu görev, kullanıcı tetiklemesi, 10 dakikalık lease aşımı, ağ kopması/yeniden bağlanması ve güç kesintisi senaryoları gözlenmeli. Yetki iptali, yanlış parolayla açma, bozuk kasa, `KURTAR` açık onayı ile tek kontrol noktası kurtarma doğrulanmalı. Gerçek servis çalışanı ve canlı API kanıtı yoksa kabul durumunu **NOT_RUN** bırak.

**Sürüm sınırı:** DeepSeek Free sohbeti otomatik yürütülmez; saatlik görevler talimat üretir ve yetkili/onaylı sonuçları senkronize eder. Chrome ve bilgisayar kapalıyken süreklilik vaat edilmez.
