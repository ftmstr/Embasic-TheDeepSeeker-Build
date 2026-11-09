# EMBASIC DeepSeek Agent v1.11.0 — TUR 012

**Durum: PC_TEST_CANDIDATE / NOT_PRODUCTION_VERIFIED**. DeepSeek Free web sohbetini otomatik çalıştırma, otomatik DOM okuma veya kullanıcı müdahalesiz model çağrısı **yoktur**. Saatlik alarm kullanıcı onayına sunulacak talimat oluşturur; onaylanmış sonuçlar izinli resmi Google Drive / GitHub API'larıyla arşivlenebilir. Bilgisayar kapalı/uykuda ya da şifreli kasa kilitliyken otomatik çalışma garantisi yoktur.

## TUR 012 — Drive API şema doğrulaması

- Drive list yanıtında `files` eksik, null veya geçersiz yapıdaysa ikinci POST gönderilmez; fail-closed.
- İlk depo aktarımı: `ftmstr/Embasic-TheDeepSeeker-Build`, `bootstrap/tur012-v1.11.0` dalı. `main` üzerinde doğrudan yayın yok.
- 46 Node regresyonu, 1 paket/manifest ve 1 simüle Chromium UI kabulü = **48/48 yerel PASS**. Canlı Chrome MV3, OAuth, GitHub ve Drive **NOT_RUN**.

## TUR 011 — Belirsiz Drive COMMIT koruması

- `driveUncertainCommit` ve `driveUncertainFolder` durumları şifreli görev arşivinde saklanır. Google Drive `files.create` veya `upload` isteğinin sunucuda gerçekleşip ACK'sının kaybolduğu şüpheli ise, sonraki saatlik tetikleme **ikinci bir POST göndermez**. Önce uygulamanın oluşturduğu uzak kayıt aranır, sahiplik, proje/tur kimliği ve gerçek rapor baytları doğrulanır.
- Uzak arama sonuç vermiyorsa, kayıt `retry`/sonunda `blocked` olur. Bu kasten güvenli durdurmadır; Google Drive'ın eventual consistency davranışı altında tam *exactly-once* garantisi verilmez. Kullanıcı uzak Drive dosyalarını gözden geçirmelidir.
- Root klasör ve proje klasörü belirsizlik işaretleri birbirinden, `name + parent` ile ayrılır. Bozuk klasör oluşturma makbuzu, uzak sonuç bilinmediği için belirsiz olarak değerlendirilir.
- İlk yükleme sonrasında metadata veya içerik okuması HTTP 404 döndürürse mutasyon yeniden oynatılmaz. Kasa kilitliyken belirsiz aktarım sayıları tanılamaya verilmez.
- **Testler:** Önceki 39 Node regresyon testi korundu; 5 TUR011 adversarial Node testi + paket + Chromium DOM mock = **46/46 yerel PASS**. Gerçek MV3, Windows Chrome uyku/uyanma, canlı Google OAuth/Drive ve GitHub **NOT_RUN**.

## TUR 010 iyileştirmeleri

- **GitHub privacy recheck:** İlk `GET /repos/{owner}/{repo}` sonrasında ve tam `PUT` öncesinde depo visibility bir kez daha kontrol edilir; repo `private -> public` olmuşsa, run'a özel açık onay olmadıkça işlem reddedilir. Bu ek kontrol kalan TOCTOU yarışını matematiksel olarak ortadan kaldırmaz.
- **Drive post-upload readback:** `files.create` başarılı makbuz döndüğünde `files.get` ile id, ad, mimeType, parents, appProperties (run/task/hash) ve gerçek rapor içeriği doğrulanmadan `synced` durumuna geçilmez.
- **Belirsiz yeni dosya görünürlüğü:** Yeni oluşturulan dosyanın readback'i geçici HTTP 404 döndürürse işlem retry sayılır; aynı POST otomatik tekrarlanmaz. Sonraki tur uzaktaki kaydı yeniden arar. Sağlayıcıda garanti edilmiş exactly-once iddiası yoktur.
- **Rate limit ve OAuth:** 403/429 altında mutating POST replay yapılmadığı bağımsız testlerle tekrar doğrulandı.
- **Şifreli kasada kilitli restart:** session anahtarı yokken görev içeriğine erişilmez; alarm yeniden kurulur, bekleyen tur korumalı kalır (yerel Chrome storage mock testi).

**Test kanıtı:** önceki TUR009 34 Node + paket + UI mock = 36/36 PASS yeniden doğrulandı. TUR010 5 yeni Node testiyle 39 Node + 1 paket/manifest + 1 Chromium DOM mock = **41/41 PASS**. Gerçek uzantı worker'ı, Windows Chrome 24 saat/uyku-uyanma, canlı Google OAuth, GitHub commit/Drive upload: **NOT_RUN**.

**Temel güvenlik sınırı:** Kasa AES-256-GCM ve PBKDF2-SHA256; Chrome yerel depolaması OS-level secure enclave/anti-rollback değildir. Kasıtlı public izin riski kullanıcıya aittir. Gizli anahtar sızıntısı engelleyicileri heuristik düzeydedir. Aşırı yetki/gerçek dosya ile test yapmayın.

## TUR 009 — v1.8 Başlangıç, görev revizyonu ve Drive yalıtımı

- Chrome başlangıcında kasa zorunluluğu yeniden uygulanır; önceki açık veriler **kullanıcı onaylı şifreli geçiş** yapılmadan değiştirilemez.
- Uzak senkronizasyonda görev/tur revizyonu, lease edinimi, yazma ön kontrolü ve son kayıt anında uyuşmalı. Eski bağlamın yeniden yayımlanması `blocked` açıklamasıyla engellenir.
- Drive klasör/rapor aramalarında parent metadata zorunludur; bozuk kimlik ve başka klasörün kayıtları reddedilir. Aynı klasörü isteyen farklı görevler her biri kendi lease hakkını doğrular.
- Google 429 Retry-After ve GitHub 403 rate limit davranışları, POST'u otomatik çoğaltmadan doğrulandı.
- **34 Node.js + paket + Chromium DOM mock = 36 yerel PASS.** Gerçek MV3 hâlâ NOT_RUN. Ayrıntılar: `docs/TUR009_REPORT.md` ve `docs/PC_KABUL_TESTI_TUR009.md`.

## TUR 008 — v1.7 atomik kayıt ve Drive güvenliği

- **Atomik lease commit fencing:** uzak aktarım sonucu, şifreli durumun `synced` işaretlendiği mutasyon içinde yeniden denetlenir. Son anda biten lease yeniden doğrulanacak `retry` durumuna alınır.
- **OAuth mutasyon geri oynatma engeli:** Drive'a yapılan POST 401 dönerse token temizlenir ama ikinci POST aynı API çağrısı içinde otomatik gönderilmez; bir sonraki tur uzaktaki durumu önce okur.
- **Drive klasör ebeveyni ve yükleme makbuzu:** Uzak raporun `parents` listesi, hedef klasörle çelişirse engellenir. Yeni upload'da geçersiz `id` başarı sayılmaz.
- **Hata kaydı redaksiyonu:** yaygın token biçimleri ve Bearer başlıkları, günlük ve bağlam hatalarından maskelenir. Evrensel DLP yerine geçmez.
- **5 yeni adversarial test:** 24 eski Node.js testi korundu; yeni 5 Node testi + paket + Chromium DOM mock ile toplam **31 PASS**; gerçek MV3 **NOT_RUN**.
- Ayrıntılar: `docs/TUR008_REPORT.md`, `docs/PC_KABUL_TESTI_TUR008.md`.

## TUR 007 — v1.6 güvenilirlik ve güvenlik yenilikleri

- **Eşzamanlı görev düzenleme / GitHub bağlamı:** Eski GitHub içeriği ağdan dönerken görev talimatı, revizyon, depo, yol veya dal değiştirilmişse bekleyen tur **oluşturulmaz**. Sonraki alarm yeni sürümü yeniden okur; diğer projeler çalışmaya devam eder.
- **Lease sonrası geç API yanıtı:** GitHub/Drive POST veya PUT sunucuda tamamlandıktan sonra geç ulaşırsa, süresi dolmuş 10 dakikalık lease ile tur *synced* olarak işaretlenmez. Eşleşme yeniden doğrulanabilsin diye gecikmeli `retry` verilir; yeniden denemede uzak bayt ve metadata eşleştirme korunur. Bu yine de **garantili exactly-once değildir**.
- **Drive klasör ebeveyni denetimi:** `files.list` yanıtının beyan ettiği `parents` alanı beklenen klasörle çelişirse appProperties işareti doğru görünse bile başka klasör altında kayıt oluşturulmaz.
- **Kasada çökme/kurtarma regresyonu:** Şifreli yazmanın ortasında depolama hatası, kilitli çalışma, bozuk etkin kasa ve son sağlam şifreli kopyanın **yalnız açık onayla** kurtarılması tekrar sınandı.
- **Gerçek Chrome PC testinde sıkı başarısızlık:** Kaynak ZIP içindeki `tools/test-mv3-windows.ps1`, `EMBASIC_REQUIRE_MV3=1` ile açılan gerçek Chrome uzantı worker'ı bulunamadığında **FAIL** verir; masaüstü Chrome kabulü yapılmış gibi göstermez. Eski Linux testinde worker yoksa **NOT_RUN** kalır.
- **Yeni yerel doğrulama:** Önceki 20 Node.js testine dört bağımsız adversarial test eklendi; toplam **24 Node.js + 1 paket/manifest + 1 Chromium DOM mock = 26 yerel grup**. Gerçek Chrome/Drive/GitHub hesap testi buna dahil değildir.

**Bu sürümün sınırı:** DeepSeek Free web sohbetine otomatik mesaj gönderilmez, DOM kazıma veya kullanım limitini aşma işlevi yoktur. Kullanıcı onayladığı yanıtı yerel arşive kaydeder; açıkça yetkilendirdiği aktarım denenir. Chrome kapalıyken veya PC uykudayken saatlik çalışma gerçekleşmez.



## TUR 006 — korunan güvenlik ve güvenilirlik düzeltmeleri

- **Lease fencing:** Drive klasörü/rapor POST ve GitHub dal/rapor yazmaları öncesinde görev ve proje kimliği, aktif yetki, kayıtlı lease kimliği ve süresi kontrol edilir. MV3 askıya alınıp başka worker aynı işi devraldıysa eski worker artık yeni uzak yazma başlatamaz. Dağıtık, kesin *exactly-once* garantisi **değildir**; API yanıtının kaybolması durumunda uzak içerik doğrulaması zorunlu kalır.
- **Zamanlayıcı yalıtımı:** Beklenmedik proje-bağlamı işleme hatası diğer projelerin saatlik görevlerini durdurmaz; sorunlu görev zamanı dolmuş şekilde sonraki tick'i bekler. Var olan GitHub ağ hata uyarısı davranışı korunur.
- **Şifreli checkpoint:** Son tamamlanan zamanlayıcı turu ve ertelenmiş görev sayısı şifreli çalışma arşivine yazılır. Kilitli arşivde bu istatistikler görüntülenmez.
- **OAuth 401 ikili hata:** Bir 401 ardından gelen ikinci 401 durumunda ikinci geçersiz token da önbellekten çıkarılır; otomatik etkileşimli yeniden yetkilendirme veya sonsuz yenileme döngüsü yoktur.
- **Tanılama:** Süresi geçmiş lease sayısı, sıradaki görev tarihi, son zamanlayıcı checkpoint'i ve ertelenen görev sayısı; parola, token ve proje adları hariç tutulur.
- **Dört yeni adversarial Node.js testi:** Geç gelen worker, değişen lease sahibi, yetki iptali, iki ardışık 401, projeler arası planlayıcı yalıtımı ve kilitli arşiv gizliliği.

### TUR 005 — korunan geliştirmeler

- **Sağlam kasa geri alma koruması:** kurtarma kopyası ile etkin kasanın tuzları farklı olsa bile etkin kasa kendi parola türetme parametreleriyle doğrulanır; sağlıklı etkin kasaya geri alma uygulanmaz.
- **Lease güvenliği:** ``Senkronizasyonu yeniden dene`` eylemi, eski MV3 worker'ın henüz geçerli olan Drive/GitHub lease'ini sıfırlamaz; süre bitince yeniden doğrular.
- **Drive klasörünü güvenle bulma:** ağ bağlantısı klasör oluşturulduktan sonra koparsa uygulama sunucudan sahiplik etiketli klasörü yeniden arar; aynı worker içindeki paralel talepler tek oluşturma işlemine birleşir. Çift/şüpheli eşleşmede yazma engellenir.
- **Gizliliği koruyan tanılama:** alarmın varlığı ve periyodu, kilitli/açık arşiv, senkronizasyon lease sayısı; parolalar, tokenlar, görev talimatları veya proje adları tanılama yanıtına alınmaz.
- **OAuth yeniden yetkilendirme:** 401 sonrası önbellekteki token temizlenip tek seferlik noninteractive tazeleme, 403 durumunda yetkiyi aşmaya çalışmama regresyonu eklendi.
- **MV3 kabul betiği genişletildi:** gerçek Chrome açıldığında tarayıcı kapat/aç, kasa anahtarının temizlenmesi, geçmişin yeniden açılması ve bekleyen tur tekilliği sınanır. Linux Chromium bu ortamda worker'ı açamadığı için **NOT_RUN**.

Kalan kritik sınır: **DeepSeek Free web sohbetine otomatik mesaj gönderimi yoktur.** Saatlik talimat hazırlama ve kullanıcı onaylı cevap arşivleme uygulanmıştır. Chrome kapanıp uykuya girerse alarmın çalışması garanti değildir.

## 1. Güvenli kurulum / yükseltme

1. **Mevcut eklentiyi Chrome'dan kaldırma.** v1.2 arşivini uygulama üzerinden bir şifreli `.emback` dosyasına yedekle; dosyayı ve parolasını ayrı güvenli yerde sakla.
2. `EMBASIC_DeepSeek_Agent_v1.10_TUR011_Chrome.zip` dosyasını çıkar. ZIP'in en üstünde `manifest.json` bulunur.
3. **İlk kurulum:** Chrome → `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → çıkartılan klasörü seç.
4. **Güncelleme:** Eski `manifest.json`'ın bulunduğu **aynı klasördeki dosyaların** yeni sürümlerini değiştir, Chrome uzantı ekranındaki **Yeniden yükle** düğmesine bas. Farklı konumdan kurulum yeni uzantı kimliği üretebilir; eski Chrome yerel verileri taşınmayabilir.
5. Kontrol panelinde sürüm `1.8.0` olmalı. Önce **yerel arşiv kasası** oluştur (güçlü, benzersiz, 12+ karakter parola; iki kez gir). v1.0/v1.1/v1.2 açık arşivi şifreli kasaya taşımadan yeni görev veya bulut işlemi yapılmaz.
6. Kasayı **kilitle/aç** işlevlerini sınayıp kapatma/açma sonrasında arşivin kilitli geldiğini doğrula. Eski veriler fiziksel disk katmanında güvenli silinmiş sayılmaz.
7. GitHub token'ını ve Google OAuth yetkisini **ayrı ayrı** yapılandır; sentetik test görevleriyle başlamadan önce gerçek hassas dosya yükleme. Açık GitHub deposuna rapor yazdırmak için tur başında veya tur özelinde ek kullanıcı onayı gerekir.

**İlk kurulum güvenliği:** Kasa kurulmadan görev oluşturma, yanıtı kaydetme, hesap bağlantısı ve otomatik senkronizasyon engellenir. Şifreli kasa kullanıldığında anahtar yalnız Chrome `storage.session` içinde bulunur, kalıcı çalışma arşivi AES-256-GCM ile şifrelenir. Tarayıcı yeniden başlatılınca arşiv açma parolası yeniden gerekir.

## 2. Görev sistemi

- En çok **200 görev**; her görev için 1–168 saat aralığı ve isteğe bağlı tur sınırı.
- Bekleyen tur bitmeden aynı göreve ikinci tur açılmaz; bilgisayar kapalıyken kaçırılan saatler sonradan topluca otomatik oynatılmaz.
- Görevler proje kimliği, depo, önceki tur özeti ve rapor dalı bakımından ayrılır.
- İşletim sistemi uykuda/kapalıysa Chrome alarmı görevleri o anda yürütmez. Chrome açıldığında yeni alarm kurulup süresi dolmuş görevler kontrol edilir.
- Model çağrısı **yoktur**; DeepSeek web sayfasına otomatik mesaj veya tarayıcı üzerinden yanıt kazıma **yoktur**.

## 3. GitHub ve Drive

- GitHub: Yalnız seçilen depoda `embasic-agent/<task-id>` rapor dalına yazar; `main`/`master` üzerinde otomatik commit, merge, PR ya da deploy **yapmaz**. Fine-grained PAT ile yalnız ilgili depoda *Contents: Read and write* yetkisi önerilir; token'ı üçüncü kişilere gönderme. Token, yalnız oturumda veya ayrı parolayla şifreli kasada tutulabilir.
- Google Drive: `https://www.googleapis.com/auth/drive.file` OAuth kapsamı. Kullanıcının erişim izni verdiği dosyalar ve eklentinin oluşturduğu klasör/dosyalar; proje başına raporlar.
- TUR004 Drive klasör ve raporlarında uygulama tarafından oluşturulduğunu belirleyen `appProperties` kullanır. Önceki sürümün etiketlenmemiş klasörlerini otomatik devralmayabilir: **veri üzerine yazma yerine yeni klasör oluşturur**.
- Drive raporu mevcutsa hem metadata görev/tur kimliği, SHA-256 hem **sunucudaki gerçek dosya baytları** uyuşmalı; uyuşmazsa otomatik üzerine yazılmaz.
- GitHub raporu mevcut ve içerik aynıysa ikinci commit atlanır; farklı içerik varsa üzerine yazılmaz.
- `Retry-After` ve üstel geri çekilme; Drive/GitHub senkronizasyonunda **10 dakikalık kalıcı lease**. İşlem ortasında servis çalışanı kapanırsa lease süresi dolduğunda yeniden kontrol edilir; kullanıcı onaylı yeniden deneme seçeneği de vardır.

Google OAuth istemci kimliği `extension/manifest.json` dosyasındaki `oauth2.client_id` alanına geçerli bir **Chrome Extension OAuth client** olarak yazılmalı. Bu ayar yapılmadan Google bağlantısı **çalışmaz**. Kaynak pakette `tools/configure-google-oauth.ps1` yardımcı komutu ve Windows kabul rehberi bulunur.

## 4. Kurtarma

- Her başarılı şifreli değişiklikten önce bir önceki **yalnız şifreli** arşiv kontrol noktası saklanır (`embasicStateRecoveryV4`).
- Etkin kasanın şifreli verisi bozulmuşsa ekrandaki **Son sağlam şifreli kopyadan kurtar** seçeneğini kullan. Kasa parolasını ve `KURTAR` onayını gerektirir; sağlam etkin kasayı sessizce geri almayı reddeder.
- Kurtarma **son işlemin kaybına** yol açabilir. Farklı bir diskte ayrıca `.emback` şifreli yedek bulundur. Bu bir anti-rollback / bağımsız güven kökü değildir.
- v1.0–v1.2 arşiv geçişi sırasında önce şifreli kayıt yazılır, sonra açık kayıt silinir. Çökme sonrası kasa kilidini açınca kalan açık anahtarlar temizlenir.

## 5. Yerel testler

Kaynak paketinde:

```bash
bash tests/run_all.sh
```

- **24 Node.js test grubu + 1 paket/manifest kontrolü + 1 Chromium DOM mock arayüz testi = 26 PASS** (TUR007 ortamında).
- Gerçek uzantı servis çalışanı için ayrı probe: `python tests/test-mv3-extension.py`. Linux Chromium ortamında worker expose edilemedi: **NOT_RUN**. Windows fiziksel PC kontrolünü bu testin yerine geçmiş sayma.
- Gerçek Drive OAuth, GitHub commit, hata sonrası canlı karşılaştırmalar, 24 saat alarm çalışması ve PC uyku/uyanma: **NOT_RUN**.

Windows test rehberi: `docs/PC_KABUL_TESTI_TUR007.md`. Gerçek MV3 kabul komutu: `powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1`. Teknik ve güvenlik raporu: `docs/TUR007_REPORT.md`.

## Güvenlik sınırları

Bu bir tarayıcı eklentisidir; işletim sistemi düzeyinde güvenilir kasa veya sertifikalı DLP değildir. Yerel kötü amaçlı yazılım, yetkili Chrome profilinin ele geçirilmesi, parolanın unutulması, Drive/ GitHub servis kesintisi ve bilinçli public yayın onayı gibi riskler devam eder. Gerçek soruşturma evrakı, kişisel veri veya kurum sırrı ile kabul testi **yapma**.

DeepSeek kullanım koşullarını ve Chrome MV3 yaşam döngüsünü ayrıca kontrol et: <https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html> ve <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers>.
