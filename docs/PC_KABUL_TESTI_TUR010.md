# TUR 010 — Windows Chrome Kabul Kılavuzu (v1.9.0)

## 1. Hazırlık

- Chrome masaüstü (güncel), Windows 10/11, Node.js 20+, Python 3.11+, Python Playwright (`pip install playwright`) gerekir.
- `v1.9` ZIP'ini kalıcı bir klasöre çıkar; `manifest.json` klasör kökünde olmalı.
- **Var olan Chrome eklentisini kaldırma.** Önce parolalı `.emback` yedeğini başka diske kaydet. Aynı uzantı kimliği/depolaması korunacaksa mevcut uzantı dizininin içeriğini güncelle, ardından `chrome://extensions` sayfasında Yeniden Yükle'ye bas.
- Yeni kurulum için `chrome://extensions` -> Geliştirici Modu -> Paketlenmemiş Öğe Yükle. Kasa oluşturulmadan gerçek proje, token ve kişisel veri kullanma.

## 2. Yerel otomatik testler (kaynak ZIP)

Kaynak ZIP'i ayrı dizine çıkarıp Windows PowerShell'de:

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1
```

Beklenen: **39 Node + 1 paket/manifest + 1 Chromium DOM mock = 41 PASS**. Kaynak testleri `tests/run_all.sh` ile Linux/macOS üzerinde de çalışır. Mock UI **gerçek extension worker değildir**.

## 3. Gerçek MV3 testini ayrıca çalıştır

```powershell
powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1
```

Bu test **gerçek** Chrome profilinde (yalnız geçici sentetik profil), unpacked MV3 worker başlatma, 1 dakikalık alarm, kasa kurulumu, kilitle/aç, çalışan durumdan yeniden başlatma ve bekleyen turun korunmasını kontrol eder. Gerçek worker bulunamazsa **FAIL** vermelidir. Playwright/Chrome kurulum eksikse bunun sonucu PASS değil; NOT_RUN veya hata olarak kaydedilir.

## 4. Kabul kontrol çizelgesi

| Test | Windows üzerinde doldurulacak durum |
|---|---|
| Gerçek MV3 extension worker'ın başlaması | NOT_RUN |
| Kilitli kasadan görev okuma reddi | NOT_RUN |
| Chrome kapat/aç ve pending tur korunması | NOT_RUN |
| Uyku/uyanma ve saatlik alarm (en az 24 h) | NOT_RUN |
| Fine-grained PAT ile test deposunda ayrı dalda commit | NOT_RUN |
| Google OAuth `drive.file` ile yeni proje klasörü/rapor | NOT_RUN |
| Ağ kopması ardından uzak readback ile mükerrer önleme | NOT_RUN |
| DeepSeek web modelinin insan olmadan ilerletilmesi | NOT_IMPLEMENTED |

## 5. Gizlilik ve hesap bağlantıları

- **Önce yalnız sentetik içerik kullan.** Gerçek hukuki dosya, resmî evrak veya hassas verilerle deneme yapma.
- Google hesabı bağlanacaksa `manifest.json > oauth2.client_id` için Chrome Extension OAuth Client ID oluşturup ilgili uzantı kimliğine bağla; varsayılan örnek gerçek yetki vermez. `drive.file` kapsamıyla sınırla.
- GitHub için yalnız test deposu erişimli fine-grained PAT kullan; `main` yerine `embasic-agent/<task-id>` dalına yazılır. Public yazımda tur özelinde izin aranır.
- Hesap bağlantıları gerçek ortamda test edilmediği için Chrome üzerindeki hata ekranını ve redakte edilmiş tanılamayı raporla. Token, parola veya kullanıcıya özel dosyaları paylaşma.
