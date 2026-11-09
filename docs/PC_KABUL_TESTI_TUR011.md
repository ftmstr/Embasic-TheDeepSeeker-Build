# EMBASIC DeepSeek Agent v1.10.0 — Windows PC kabul kılavuzu

## Ön koşullar

- Windows 10/11 masaüstü ve güncel Google Chrome.
- Yalnızca hakları temiz **sentetik görev ve raporlar**.
- Kaynak ZIP içindeki yerel testler için Node.js 20+ ve Python 3 gerekir.
- Gerçek MV3 kabulü için Python Playwright: `python -m pip install playwright`.
- Kullanıcıya ait gerçek Google Drive ve GitHub içerikleri ilk denemede kullanılmamalıdır.

## Güncelleme ve veri koruması

1. Eski v1.9 uzantısı kuruluysa önce uygulama üzerinden **şifreli yedek** al; dosya ve parolayı güvenli yerde sakla.
2. Chrome'dan eski uzantıyı kaldırma. v1.10 Chrome ZIP dosyasını çıkar ve `manifest.json` bulunan **aynı fiziksel uzantı klasöründeki dosyaları** güncelle.
3. `chrome://extensions` → ilgili uzantı → **Yeniden yükle**. Sürüm `1.10.0` olmalı. İlk kurulumda **Paketlenmemiş öğe yükle** menüsünü kullan.
4. Yan panelden şifreli kasayı kilitle/aç; görevler ve geçmiş korunmalı. Bir sorun çıkarsa mevcut dosyaların üzerine yazmadan önce arşivin kopyasını al.

## Kaynak ZIP ile çevrimdışı test

PowerShell'de kaynak klasörüne geç:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\test-windows.ps1
```

Beklenen: **44 Node.js + 1 paket kontrolü + 1 simüle Chromium UI = 46 PASS**. Bu, gerçek Chrome worker kabulü değildir.

Gerçek Chrome uzantı worker testi (kişisel Chrome profili yerine Playwright geçici profili kullanır):

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\test-mv3-windows.ps1
```

Bu test gerçek worker'a erişemezse **FAIL** olmalıdır; `PASS` varsayılmamalıdır. Mevcut çalışma ortamında **NOT_RUN**. Test sonrası Chrome üzerinde eklentinin tanılama sayfasındaki alarm, şifreli kasa ve geciken Drive işaretlerini incele.

## İşlev senaryoları

1. Kasa olmadan görev yazımının reddedilmesi; ardından güçlü parolayla kasa oluşturma.
2. Sentetik proje oluşturup tur üretme; aynı tur beklerken ikinci kopya üretilmemesi.
3. Kasayı kilitleyince görev içeriğinin görünmemesi ve belirsiz Drive sayaçlarının gizlenmesi.
4. Tarayıcı kapatılıp açıldıktan sonra kasanın kilitli olması ve tur geçmişinin korunması.
5. Google OAuth Client ID (kendi OAuth istemcin) yapılandırıldıktan sonra yetkilendirilmiş **test Drive** klasöründe aktarım.
6. Test GitHub deposunda sadece `embasic-agent/<task-id>` rapor dalına yazım; `main` değişmemeli. Public depoda ek tur onayı aranmalı.
7. HTTP 401, 403, 429 ve COMMIT sonucu belirsiz API durumları; canlı test ancak güvenli kontrollü test hesabıyla.

## Kabul matrisi

| Kontrol | Mevcut kanıt |
|---|---|
| Yerel 46 grup | PASS |
| Gerçek Windows MV3 worker | NOT_RUN |
| Chrome 24 saat ve uyku/uyanma | NOT_RUN |
| Canlı Google OAuth / Drive | NOT_RUN |
| Canlı GitHub commit | NOT_RUN |
| DeepSeek Free otomatik sohbet | NOT_IMPLEMENTED |

**Kural:** Doğrulanmayan canlı işlev üretim özelliği sayılmaz. Kasa parolası ve GitHub token'ını hata raporlarına yapıştırma.
