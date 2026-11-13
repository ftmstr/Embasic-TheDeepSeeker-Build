# TUR058 — TheDeepSeeker Windows PC ilk kullanım / gerçek ürün sınırları

**DENEME ADAYI — PC_TEST_CANDIDATE / PRODUCTION_NO_GO.** Bu paket bir Windows `.exe` veya sistem hizmeti değildir. **Google Chrome 120+ için bir Manifest V3 uzantısıdır.** İmzalı Chrome Web Store paketi değildir; yalnız güvendiğin kendi test PC'nde, ayrı bir Chrome profiliyle dene. Fiziksel Windows kurulumu henüz kanıtlanmadı (`NOT_RUN`).

## 5 dakikalık yerel deneme

1. `TUR058_PC_TEST_KIT.zip` dosyasını Windows'ta **tamamen** ayrı, boş bir klasöre çıkar. ZIP içindeki `EMBASIC_EXTENSION` klasörünü seçmelisin; kaynak ZIP'i veya üst klasörü seçme. PowerShell istiyorsan terminalde `./verify-pc-kit.ps1` çalıştırarak 15/15 SHA-256 doğrulaması yapabilirsin; betik yalnız **okur**, kurulum veya internet bağlantısı başlatmaz. PowerShell politikası engellerse zorlamadan Chrome ile manuel kurulum adımlarına geç.
2. Google Chrome'u aç, adres çubuğuna `chrome://extensions` yaz. **Geliştirici modu**nu aç, **Paketlenmemiş öğe yükle**yi seç ve `EMBASIC_EXTENSION` klasörünü göster. Chrome uzantısının gerçekten yüklendiğini ve hata göstermediğini kontrol et. Uyarı çıkarsa devam etmeden önce dosyaları ve izinleri incele.
3. Uzantı simgesinden **Görev panelini aç**. İlk açılışta **yerel şifreli kasa** için en az 12 karakterlik benzersiz parola oluştur. Parolayı kaybedersen şifreli arşiv kurtarılamayabilir. Denemede gerçek kişisel / mesleki dosya kullanma.
4. **Bağlantılar** sekmesinde Google Drive ve GitHub **kapalı** kalmalı. Google OAuth `manifest.json` içindeki istemci kimliği **örnek değer** olduğundan Drive bağlantısı bu pakette hazır değildir; bu eksiklik ilk yerel denemeye engel değildir. Kullanıcıdan token istemiyoruz.
5. **Görevler** bölümünde proje `Deneme`, görev `Yerel prova`, talimat `Özgün ve kişisel veri içermeyen kısa örnek çıktı hazırla.` yaz. **GitHub deposunu boş bırak**, **public onayı işaretleme**, **Tur sınırı 1**. Kaydet. İlk hazırlanmış talimat **Çalışma alanı** bölümünde beklemelidir.
6. Talimatı istersen DeepSeek'e **kendin** kopyalayıp gönder; uzantı DeepSeek web sohbetini otomatik okumaz/göndermez. İlk testte siteye gitmeden sentetik cevap da yapıştırabilirsin: `Bu yalnız yerel deneme yanıtıdır. SONRAKİ TUR ÖZETİ: Kayıt doğrulandı.` **Yanıtı kaydet**. Tamamlanan tur sayısı 1, Drive/GitHub senkron durumları **disabled** olmalı.
7. **Kurulum ve tanılama**da uzantı sürümü, worker ve alarm durumunu oku; Chrome'u kapatıp açarak kasanın parola sorup sormadığını denetle. Bu kısa deneme **24 saatlik uyku/uyanma** kabulünün yerine geçmez.

## TUR058 ürün boşlukları / TUR060 karar kapısı

| Ürün alanı | Kaynak incelemesi | Kabul eşiği |
|---|---|---|
| Windows dağıtım | Yalnız `extension/` ve `Chrome_MV3.zip`; imzalı `.exe/.msi` yok | Manuel **Load unpacked** paketi + test kılavuzu ve SHA kontrolü |
| Gerçek yerel kullanım | Şifreli kasa, görev, prompt, elle yanıt kaydı kodda mevcut | Gerçek Chromium MV3 **UI** üzerinden ilk kullanıcı akışı PASS; fiziksel Windows ayrıca NOT_RUN |
| İlk kurulum UX | HTML üstbilgi/footer eski `v1.5 TUR006`; uzun genel README | Doğru sürüm/sınırlar ve 7-adımlı yerel başlangıç |
| Bulut OAuth | Google Chrome Extension `client_id` hâlâ `YOUR_...` | İlk denemede KAPALI; gerçek Drive/GitHub ancak ayrı açık onaylı testle |
| DeepSeek Free | Sitede otomatik mesaj ve DOM kazıma yok | Kullanıcı tarafından elle aktarım açıkça belirtilir |
| Üretim güvenlik | WORM, gerçek Windows reparse/24h, iki cihazlı live CAS yok | **PRODUCTION_NO_GO**; hiçbir deneysel paket üretim olarak sunulmaz |

**TUR060 kesin karar:** Yalnız yerel kapsamda, gerçek Chrome MV3 GUI + ZIP/manifest/SHA + kasa/task/prompt/yanıt + varsayılan sıfır bulut mutasyonu doğrulanırsa `EXPERIMENTAL_PC_TEST_GO`; herhangi bir zorunlu adım başarısızsa `EXPERIMENTAL_PC_TEST_NO_GO`. **Her iki halde de PRODUCTION_NO_GO**; fiziksel Windows testi yapılmadan Windows testine GO denmez. TUR060'ta ek turlar otomatik açılmaz: eksikler ve GO/NO-GO tek rapora bağlanır.

## Kısıtlar

`2MiB` parent-owned bounded pipe, strict EOF, native Chromium MV3 işaretleri, AES-256-GCM, pinned POSIX dirfd/ACL ve üretim witness `NO_GO` kapıları korunur. `main` merge/deploy, canlı API mutasyonu veya izinsiz DeepSeek Free otomasyonu bu kurulum kitiyle **yapılmaz**. Dış WORM/monotonic witness, fiziksel Windows reparse ve 24 saat sleep-wake ile canlı OAuth/GitHub için **NOT_RUN**; kalıcı anti-rollback ve cross-provider exactly-once **NOT_PROVEN**.
