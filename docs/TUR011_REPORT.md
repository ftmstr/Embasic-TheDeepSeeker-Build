# EMBASIC DeepSeek Agent — TUR 011 Teknik ve Güvenlik Raporu

**Sürüm:** 1.10.0  
**Başlangıç:** TUR 010 / 1.9.0  
**Karar:** `PC_TEST_CANDIDATE` — üretim/kullanıcı hesabı kabulü tamamlanmadı  
**Model kısıtı:** DeepSeek Free web otomasyonu **NOT_IMPLEMENTED**; hiçbir DOM scraping, otomatik mesaj gönderimi, CAPTCHA/limit aşma yapılmadı.

## 1. Tedarik zinciri / doğrulanan girdi

TUR010 kaynak ve Chrome ZIP arşivlerinin SHA-256 değerleri `EMBASIC_DeepSeek_Agent_v1.9_TUR010_SHA256.txt` kayıtlarıyla tam eşleşti:

- Chrome ZIP: `2c05e5a0ce2875b0019c0616fd7446304e5d72f3c2c56584df700721a396094c`
- Kaynak ZIP: `b3991861abaabef2ae02a6ee8ceb35d50e20e24ae41b0134dab9baeac3c40f8e`

Önceki 39 Node.js regresyon testi, paket kontrolü ve Chromium DOM mock testi yeniden çalıştırıldı: **41/41 PASS**.

## 2. Somut değişiklikler

### Drive belirsiz dosya yüklemesi

`extension/background.js` içinde, Google Drive `files.create`/`upload` işlemi başladıktan sonra alınan ağ hatası, geçerli ID olmaması, readback HTTP 404, geç readback veya lease kaybı gibi olaylar `driveUncertainCommit=true` şeklinde **kalıcı görev durumuna** işlenir. Sonraki senkronizasyon uzaktaki `run.id`, `task.id`, proje klasörü, `SHA-256` ve gerçek içerik baytlarını doğrulamadan ikinci `POST` göndermez. Doğru uzak kayıt bulunursa kesinlik işareti temizlenir. Bulunamazsa otomatik yeniden yazma yerine kontrollü `retry`/`blocked` yolu kullanılır.

### Drive belirsiz klasör oluşturma

`driveUncertainFolder={name,parent}` alanı, daha önce oluşturulmuş olabilecek root veya proje klasörünü ikinci kez üretmeyi önler. `name+parent` eşleşmesi bulunup izinli ve sahipliği doğrulanmış mevcut klasör tespit edilene kadar ikinci `files.create` isteği gönderilmez. Klasör API'sinin bozuk ID makbuzu da uzak COMMIT sonucu bilinmiyor kabul edilir.

### Kasa ve tanılama

Yeni alanlar `normalizeState` içinde şema tipi kontrolüyle taşınır, mevcut AES-256-GCM şifreli arşiv korunur. Tanılama, kasa **açıkken** iki belirsiz işlem sayısını verir; kasa kilitliyken her iki sayı `null` kalır. `dashboard.js` bunları anlaşılır biçimde gösterir.

### MV3 kabul ölçütleri

Gerçek Windows Chrome `test-mv3-extension.py` betiğine belirsiz durum sayılarının başlangıçta ve yeniden başlatma sonrasında sıfır kalması doğrulaması eklendi; betik **geliştirildi ama gerçek Windows Chrome'da çalıştırılamadı**. Bu kontrol `NOT_RUN` olarak kaydedildi.

## 3. Gerçek test sonucu

| Kanıt türü | Sonuç |
|---|---|
| Önceki TUR010 Node.js regresyonu | 39/39 PASS |
| Yeni TUR011 Node.js adversarial testleri | 5/5 PASS |
| `tests/test-package.py` manifest ve paket yapısı | PASS |
| `tests/test-ui-smoke.py` Chromium DOM (Chrome API mock) | PASS |
| Toplam yerel grup | **46/46 PASS** |
| JavaScript syntax / Python compile | PASS |
| Gerçek Chrome unpacked MV3 worker | **NOT_RUN** |
| Fiziksel Windows Chrome yeniden başlatma/uyku-uyanma | **NOT_RUN** |
| Gerçek Google OAuth / Drive upload | **NOT_RUN** |
| Gerçek GitHub repo yazma | **NOT_RUN** |

Beş yeni test:
1. `test-tur011-drive-uncertain-upload.cjs`: ACK kaybından sonra no duplicate POST, uzak içerikle kesin sonlandırma.
2. `test-tur011-drive-uncertain-folder.cjs`: root klasör belirsiz COMMIT, `name+parent` kapsamı ve güvenli kurtarma.
3. `test-tur011-media-404.cjs`: yükleme makbuzundan sonra medya okuma 404, no replay.
4. `test-tur011-vault-uncertainty.cjs`: belirsizlik göstergesinin AES-256-GCM içinde korunması ve kilitli tanılama gizliliği.
5. `test-tur011-malformed-folder.cjs`: bozuk klasör makbuzunun tekrar `POST` açmaması.

Daha önceki `test-sync.cjs` fiilen güvenliği zayıflatan eski 503 beklentisi yerine **sunucu COMMIT başarılı fakat HTTP 503 döndü** senaryosuna geçirildi. İkinci upload yapmadan uzak baytlarla uzlaşma aranıyor.

## 4. Sınırlar / bilinen riskler

- Chrome `storage.local` tek başına dağıtık transaction/compare-and-swap hizmeti değildir. Worker'lar arası kesin *exactly once* garanti edilemez.
- Uzak kayıt ısrarla bulunamazsa otomatik aktarım güvenlik gereği durabilir ve **manuel Drive incelemesi** gerekebilir. Yanlışlıkla ikinci `POST` oluşturmamak bu tasarımın önceliğidir.
- Google OAuth manifestindeki gerçek Client ID kullanıcı tarafından yapılandırılmadan canlı Drive erişimi kurulamaz.
- GitHub `main` veya `master` üzerinde otomatik yazma, merge, deploy veya izinsiz public rapor yoktur.
- Açık tarayıcı / kilidi açılmış kasa / geçerli izin olmadan saatlik görev oluşturulması garanti edilemez. Eklenti **DeepSeek Free web sohbetini insansız çalıştırmaz**.
- DLP gizli anahtar deseni filtreleme heuristiktir; hassas soruşturma veya kişisel dosyalar ilk PC denemesinde kullanılmamalıdır.

## 5. Sonraki kabul kapıları

Gerçek Windows Chrome MV3 servis çalışanı, alarm yeniden kurulumu, 24 saat çalışma/uyku-uyanma, Google OAuth bağlantısı, test Drive klasörü, test GitHub deposu ve belirsiz COMMIT altında canlı provider doğrulaması; hepsi gerçek kanıt alınmadan `NOT_RUN` kalır.
