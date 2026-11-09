# EMBASIC DeepSeek Agent v1.7.0 — Windows Chrome PC kabul kılavuzu

## Ön koşullar

- Windows 10/11 ve masaüstü Google Chrome 120+; Python 3 ve Playwright Python paketi (gerçek worker test betiğini kullanacaksan).
- Eski eklentideki arşivin güçlü parolayla şifreli `.emback` yedeğini **ayrı diske** al. Var olan eklentiyi silme; Chrome yerel verilerini korumak için aynı kurulum klasöründeki dosyaları güncelle.
- Canlı GitHub/Drive girişini ve gerçek projeleri testin ilk aşamasında bağlama. Sentetik proje adları/yanıtları kullan.

## Kurulum

1. `EMBASIC_DeepSeek_Agent_v1.7_TUR008_Chrome.zip` dosyasını ayrı sabit klasöre çıkart. `manifest.json` klasörün kökünde bulunmalı.
2. İlk kez kuruyorsan `chrome://extensions` → Geliştirici modu → Paketlenmemiş öğe yükle. Eski kurulumsa uzantıyı kaldırmadan aynı klasörün içeriğini güncelle ve **Yeniden yükle**.
3. Eklenti sayfasında sürüm `1.7.0` doğrula; kontrol panelini aç.
4. Kasa oluştur, kilitle, yeniden aç ve sentetik görev oluştur. Bekleyen tur sayısının aynı görev için birden fazla artmadığını kontrol et.
5. Chrome'u tamamen kapatıp yeniden aç; kilitli kasada görev içeriği/yanıt açılmadığını; parolayla açıldığında bekleyen tur geçmişinin korunduğunu kontrol et.

## Gerçek MV3 worker kabul testi

Kaynak ZIP içindeki tüm dosyaları ayrı bir klasöre aç. PowerShell'de kaynak klasöründe:

```powershell
python -m pip install playwright
powershell -ExecutionPolicy Bypass -File .\tools\test-mv3-windows.ps1
```

`CHROMIUM_PATH` farklı bir kurulumsa önce `$env:CHROMIUM_PATH='C:\...\chrome.exe'` olarak ayarla. Test geçici Chrome profili ve sentetik kayıtlarla çalışır; Google/DeepSeek/GitHub'a bağlanmaz. Gerçek worker bulunamazsa `FAIL` yazması gerekir. `NOT_RUN` veya zaman aşımını kesinlikle PASS sayma.

## API entegrasyonu (yalnız test deposu/klasörü)

1. Drive için `manifest.json` içindeki placeholder OAuth Client ID'yi Chrome Extension istemcisiyle değiştir; uygun `drive.file` izinlerini ver. Doğrulanmış Google hesabıyla yalnız uygulamanın test klasöründe dene.
2. GitHub için yalnız test deposuna erişebilen, fine-grained `Contents: read/write` token kullan; `main`/`master` üzerinde commit veya merge yapılmadığını doğrula.
3. Bağlantıyı geçici keserek yeniden dene. Tek turun iki kez yüklenmemesini kontrol et. Belirsiz durum/401/429 geldiğinde aktarımların durup yeniden doğrulanmasını gözle.
4. Üç ayrı test projesi oluştur; proje A'nın geçmişi/çıktısı B veya C'nin raporuna girmemeli.
5. Chrome tamamen kapalıyken ve PC uykudayken görev tetiklenmesini bekleme; uyandırınca yalnız zamanı gelmiş ve hâlâ yetkili görevlerin kontrol edilmesi gerekir. Kasa kilitliyse çalışmamalıdır.

## Başarısızlıkta yapılacaklar

- Chrome eklenti kartından `Hatalar` ve `Service worker` bağlantılarını aç; hata metinlerini gizli anahtarları paylaşmadan kaydet.
- Tanılama panelinde sürümü, alarm, kasa ve başarısız aktarım sayısını not et.
- ZIP SHA-256 değerini `Get-FileHash -Algorithm SHA256 <dosya>` ile verilen SHA dosyasıyla kıyasla.
- `FAIL`/`NOT_RUN` çıkan testi başarılı diye işaretleme. Fiziksel Windows PC, canlı Google OAuth ve GitHub commit sonuçları doğrulanana kadar uygulama üretime hazır sayılmaz.
