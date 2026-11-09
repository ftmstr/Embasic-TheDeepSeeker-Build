# EMBASIC DeepSeek Agent v1.8.0 — TUR009 Windows PC kabul kılavuzu

**Durum:** Yerel 36/36 PASS; gerçek Windows Chrome MV3, 24 saat uyku/uyanma ve gerçek GitHub/Drive işlemleri **NOT_RUN**. Yalnızca sentetik verilerle başla.

## 0. Yedek ve güvenli güncelleme

- Önce mevcut eklentiden şifreli `.emback` yedeği al; parolayı ayrı ve güvenli sakla. Eski uzantıyı Chrome'dan **kaldırma**.
- `EMBASIC_DeepSeek_Agent_v1.8_TUR009_Chrome.zip` dosyasını çıkar; kökte `manifest.json` olmalı.
- Eski uzantı klasörünün içeriğini yeni dosyalarla değiştir; `chrome://extensions` → **Yeniden yükle**. Veya yeni kurulumda **Paketlenmemiş öğe yükle**.
- Chrome uzantısı sayfasında sürüm **1.8.0**; çalışan `background.js` servisi ve sistem tanılamasını kontrol et. Yeni klasöre geçince uzantı kimliği değişebileceği için önce eski profil verisini yedekle.

## 1. Yerel testler (canlı hesap gerekmez)

1. Node.js 20+, Python 3 ve Playwright/Python Chromium kurulumunu yalnızca testler için kullan.
2. Kaynak paketi çıkar. PowerShell'de `powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1` çalıştır.
3. Beklenen: **34 Node + paket + DOM mock = 36 PASS**; bu sonuç gerçek Chrome MV3 demek değildir.
4. Gerçek GUI Chrome kabulü: `powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1` (gerekirse önce `python -m pip install playwright`). `CHROMIUM_PATH` kurulu Chrome yolunu gösterebilir.
5. Bu gerçek test; worker başlatma, alarm, kasa oluştur/lock/unlock, gerçek tarayıcı yeniden başlatma, görev tekilliği, şifreli depolama ve gizliliği kontrol eder. **PASS çıktısını ve sürüm numarasını kaydet**. Hata veya worker görünmüyorsa FAIL'dir; PASS yazma.

## 2. Kullanıcı arayüzü kabulü (sentetik)

- Taze profilde kasayı oluşturmadan görev oluşturmanın engellendiğini doğrula.
- 12+ karakter parola ile AES-256-GCM kasasını oluştur. İki ayrı projede birer görev tanımla.
- Saatlik alarmı `Tanılama` panelinde gör; bir turu tamamla, ikinci turu bekleyen durumdayken manuel test et. Aynı görev için iki bekleyen tur olmamalı.
- Kasayı kilitle: görev ve rapor içeriği görünmemeli. Chrome'u kapat/aç ve kilidin kapalı geldiğini doğrula.
- Her görev için bağımsız talimat ve devam özeti; yeniden başlatma sonrası tekrar oluşmayan bekleyen tur; şifreli kurtarma onayı denetle.
- Uzun süre (ör. 24 saat, uyku/uyanma) alarmın kaçan çalışmaları biriktirip tekrar üretmediğini ayrıca kaydet. PC uyurken yeni turun gerçekten işlenmesi **beklenmez**.

## 3. Hesap bağlantı kabulü (yalnız izinli sentetik depo / klasör)

- Google Cloud'da **Chrome Extension OAuth client** yapılandırıp `oauth2.client_id` alanını doldur. `drive.file` kapsamını koru. Google oturum ekranından izin ver; kendi test Drive alanında sentetik dosya oluştur.
- GitHub'da yalnızca test deposuna erişen fine-grained PAT kullan. Gerekliyse `Contents: Read and write`. `main` üzerinde commit/merge olmamalı; yalnız `embasic-agent/<task-id>` rapor dalı oluşturulmalı.
- Çekilen raporun SHA-256, Run ID, Task ID ve Drive klasör ebeveyni eşleşmesini test et. İzin geri alınırsa yeniden deneme beklesin/dursun.
- Yapay bir 429 ya da ağ kesilmesi durumunda yeniden deneme ve tekrar rapor üretmeme senaryosunu **gerçekten test ettiysen** PASS yaz; canlı test yapılmadıysa `NOT_RUN` olarak koru.
- Gerçek DeepSeek sohbeti otomatikleştirilmez, yalnız kullanıcı onaylı çıktı arşivlenir.

## 4. Karar kaydı

| Kabul kapısı | Bu turda |
|---|---|
| 34 Node.js regresyon | PASS (yerel) |
| Paket & mock UI | PASS (yerel) |
| Gerçek MV3 browser worker & yeniden başlatma | NOT_RUN |
| Gerçek GitHub / Google OAuth / Drive mutasyonu | NOT_RUN |
| Windows 24 saat uyku/uyanma | NOT_RUN |
| Ücretsiz DeepSeek web sohbetinde insansız ilerleme | NOT_IMPLEMENTED |

Canlı hesap ve fiziksel kabul kanıtları tamamlanana dek: **PC_TEST_CANDIDATE / NOT_PRODUCTION_VERIFIED**.
