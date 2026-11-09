# EMBASIC DeepSeek Agent v1.0 — 08.11.2026 teknik sürüm raporu

**Özet:** v0.1 üzerine kaynak temelli ürün revizyonu yapıldı. Saatlik görevleri hazırlayan, kullanıcı onaylı DeepSeek yanıtlarını proje bazında saklayan ve resmî GitHub/Drive API'larına güvenli aktarabilen Chrome MV3 eklentisi v1.0 olarak paketlendi. Otomatik DeepSeek Free sohbet ilerletmesi yoktur; bu kısım teknik/uyum sınırına takılır.

## v0.1 → v1.0 farkları

- `embasicStateV1` → `embasicStateV2` yerel veri geçişi; açık metin legacy kalıcı GitHub token'ını silme.
- GitHub token'ında oturumluk saklama ve isteğe bağlı PBKDF2-SHA-256 + AES-256-GCM şifreli kasa.
- Kimlik tabanlı proje Drive klasörleri ve görev kimliği tabanlı GitHub ajan yolları; repo değişimi halinde fail-closed.
- GitHub public depoya göreve özel açık onay; global anahtar varsayılan kapalı.
- Onaylı raporlarda kaba gizli anahtar desenleri kontrolü; sessiz sızıntı yerine blok.
- Google Drive ve GitHub senkronu için bağımsız durum/deneme/backoff alanları; 408/429/5xx transient sınıflaması; diğer 4xx durumunda bloke etme.
- Senkronizasyon kapalıyken uzaktan yüklemeyi durdurma, manuel yeniden deneme ve başarılı yüklemeyi tekrar etmeme.
- JSON geri yükleme doğrulaması: kaynak görevler duraklatılır, geçmiş bulut senkronları iptal edilir; tokenlar dışa aktarılmaz.
- Görev başına bekleyen tur iptali, kullanıcı bildirimleri, badge, yerel tanılama ekranı.
- Host izinleri iki API alan adıyla sınırlandı; DeepSeek DOM/scripting erişimi kaldırıldı.
- 200 görev üst sınırı, her zamanlayıcı turunda 4 yeni çalışma ve 6 senkron işlemi limitleri.

## Otomatik test sonuçları

- `node tests/test-core.cjs`: **PASS**.
- `node tests/test-security.cjs`: **PASS**.
- `node tests/test-sync.cjs`: **PASS** (her iki servis mock; consent, idempotent, retry, yanlış repo koruması, disable).
- `python tests/test-package.py`: **PASS**.
- `python tests/test-ui-smoke.py`: **PASS** (Chromium üzerinde görünüm ve davranış, mock Chrome runtime).

## Gerçek dünyada doğrulanmayanlar

- Gerçek Windows + masaüstü Chrome uzantısının servis çalışanıyla fiziksel kabulü: **NOT_RUN**. Bu ortamda servis çalışanı test sürecinde tespit edilemedi; GUI extension denemesi zaman aşımına uğradı. Mock DOM testi bunun yerine geçmez.
- Google Cloud OAuth istemcisinin canlı kurulumu, gerçek Drive yüklemesi: **NOT_RUN**.
- Gerçek GitHub kimlik doğrulaması, repo dalı oluşturma ve commit: **NOT_RUN**.
- Bilgisayar uyku/uyanma, Chrome otomatik güncellemesi sonrası alarm davranışı: **NOT_RUN**.
- DeepSeek Free web hesabında insansız mesaj/yanıt çevrimi: **NOT_IMPLEMENTED**.

## Güvenlik ve maliyet değerlendirmesi

- Yerel depoda yazılan prompt ve yanıtlar şifrelenmez; hassas iş belgeleri için uygun olduğu iddia edilemez.
- Aktarımlar hak sahibi kullanıcıların resmî OAuth / fine-grained token izinlerine bağlıdır.
- Chrome ve API hizmetlerinin güncel kota/limitleri uygulamaya etki edebilir. Saatlik görev sayısı sınırsız değildir.
- Eklenti harici ücretli API satın almaz, fatura oluşturmaz. Drive/Google hesabı API kotası ve depolama sınırları ayrıca geçerlidir.
- Otomatik kod geliştirip GitHub'a PR açma veya main'e merge etme yoktur. Github API sadece context okuma ve ayrı ajan dalına rapor yazma için kullanılır.

**Ürün sınıflandırması:** `v1.0 PC testine hazır aday` — gerçek hesaplarda ve fiziksel Windows Chrome'da kabul gerçekleşmeden `production verified` denmemelidir.
