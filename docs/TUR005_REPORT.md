# EMBASIC DeepSeek Agent — TUR 005 teknik ve güvenlik raporu

**Tarih:** 09.11.2026  
**Başlangıç:** v1.3.0 / TUR004  
**Yeni sürüm:** v1.4.0 / TUR005  
**Karar:** PC kabul adayı; üretim / canlı OAuth / gerçek GitHub veya Drive yazma **ONAYLANMADI**.

## Baseline kontrolü

- TUR004 Chrome ZIP SHA-256: `03d65d41264094eec5a2944d485540ed62ccdbc04d938dfe886b58f97a5cc5fb` — **PASS**.
- TUR004 Source ZIP SHA-256: `e79aecc9b42b79f19a6ccc670a4ef026dd83729d069e16f22505ef9fc106964c` — **PASS**.
- Eski 11 Node.js regresyonu + HTML/manifest kontrolü + Chromium mock UI = **13/13 PASS**. Gerçek MV3 Chrome worker = **NOT_RUN** (mevcut Linux ortamında extension worker görünmedi).
- Önceki rapor ve kabul yönergesi incelendi; temel API ve DeepSeek kısıtları korunmuştur.

## Somut kod değişiklikleri

| ID | Değişiklik | Test | Güvenlik etkisi |
|---|---|---|---|
| VLT-01 | Recovery aktif kasayı kendi salt + PBKDF2 parametreleriyle doğrular | `test-tur005-vault.cjs` | Sağlam aktif kasanın farklı saltlı yedek anahtarıyla yanlış rollback edilmesini engeller |
| LEASE-02 | Manuel yeniden deneme geçerli Drive/GitHub lease kaydını silmez | `test-tur005-leases.cjs` | MV3 suspend/restart sonrası iki worker kaynaklı mükerrer gönderim riskini azaltır |
| DRIVE-03 | Aynı worker içinde klasör oluşturma single-flight | `test-tur005-cloud.cjs` | Paralel çağrıda çift klasör riskini azaltır |
| DRIVE-04 | POST yanıtı kaybolunca app-owned etiketli klasör yeniden okunur; belirsizlikte blok | `test-tur005-cloud.cjs` | Uzak COMMIT belirsizliğinde idempotent kurtarma iyileşir |
| DIAG-05 | Alarm, sürüm, kasa, aktif lease, retry/blocked sayıları; hassas içerik hariç | `test-tur005-diagnostics.cjs`, `test-ui-smoke.py` | Tanı kolaylaşır, tanı yoluyla bilgi sızma yüzeyi daralır |
| OAUTH-06 | Google 401 önbellek temizleme ve noninteractive token yenileme; 403 fail-closed regresyonu | `test-tur005-oauth.cjs` | Resmî OAuth akışı, yetki asgariliği; gerçek Google hesabı **NOT_RUN** |
| MV3-07 | Gerçek worker kabul betiğine tarayıcı kapanma/açılma ve session key temizliği senaryosu | `test-mv3-extension.py` | Windows fiziksel kabulünde daha sağlam doğrulama; **mevcut ortam NOT_RUN** |
| UI-08 | v1.4.0 / TUR005 sürümü, diagnostics görünümü | UI mock | Kullanıcı tanılama kapsamını genişletir |

## Test sonuçları

| Kategori | Durum | Açıklama |
|---|---|---|
| 11 eski Node.js test grubu | **PASS** | HTTP API mock / VM simülasyonu |
| 5 yeni TUR005 Node.js test grubu | **PASS** | Salt/rollback, lease, Drive loss-of-ACK, no-leak diagnostics |
| Manifest ve HTML statik testi | **PASS** | MV3, izinler, ID ve dosya varlığı |
| Chromium DOM arayüz testi | **PASS** | Chrome runtime **MOCK**; gerçek uzantı değil |
| Gerçek Chrome MV3 worker + restart | **NOT_RUN** | Headless Linux Chrome extension worker testte görünmedi |
| Windows Chrome fiziksel kurulum | **NOT_RUN** | Kullanıcı PC testi gerekli |
| Gerçek Google OAuth ve Drive read/write | **NOT_RUN** | Gerçek OAuth istemcisi / hesap kullanılmadı |
| Gerçek GitHub API commit/ref + 409 yarış | **NOT_RUN** | Gerçek depo / token kullanılmadı |
| Chrome PC uyku/uyanma 24 saat | **NOT_RUN** | Uzun süreli fiziksel kontrol yapılmadı |
| DeepSeek Free insansız web otomasyonu | **NOT_IMPLEMENTED** | Kullanım koşullarını ihlal edebilecek otomasyon eklenmedi |

**Özet:** 16 Node + 1 manifest + 1 mock UI = **18/18 yerel grup PASS**; gerçek worker ve canlı uzak servis **NOT_RUN**.

## Bilinen riskler ve sınırlar

1. Şifreli kurtarma noktası bağımsız hardware trust anchor, tam anti-rollback veya anahtar kurtarma sistemi değildir. Bozulmadan önceki son işlemin kaybı mümkündür.
2. MV3 `chrome.alarms` PC kapalı veya uykudayken işlem garantisi vermez; kasa kilitli ise görevler özellikle durdurulur.
3. `chrome.storage.local` şifreli durum tutar. Eski sürümlerdeki açık metin kayıtlarının SSD/Windows geri alma alanlarında güvenli silindiği iddia edilemez.
4. Tek worker single-flight dağıtık kilit değildir; farklı Chrome örnekleri veya uzak API eşzamanlı değişiklikleri arasında tam exactly-once garantisi yoktur. Drive kimlik ve SHA doğrulaması, GitHub mevcut içerik kontrolü bunun için sınırlı koruma sağlar.
5. `githubSessionToken` chrome.storage.session belleğindedir; token ve OAuth erişim anahtarları kaybolabilir/çalışma sırasında kötü amaçlı bir yerel kullanıcı tarafından ele geçirilebilir. Gerçek gizli belgeler test edilmemelidir.
6. Kullanıcının manuel olarak onayladığı sonuçta hassas veri varsa regex tabanlı gizli anahtar kontrolü tüm kişisel verileri yakalamaz. Herhangi bir public aktarım öncesi insan incelemesi gereklidir.
7. Birden fazla proje kimliği birbirinden ayrılır; ancak **gerçek dosya sistemi/GitHub repo izinleri** kullanıcının seçtiği hesabın yetkileriyle sınırlıdır. Her proje için en az yetki uygulanmalıdır.
8. DeepSeek web sohbetine otomatik mesaj, cevap toplama veya kullanım kotası aşma eklenmedi. Örneğin DeepSeek web Free sınırsız API erişimi sanılmamalıdır.

## Kabul kapıları

- **PASS:** SHA ile baseline, 18 yerel grup, yeni kod ve kaynak derleme/sözdizimi, deterministik paketleme.
- **PENDING:** Windows PC Chrome MV3 gerçek worker, Google OAuth ve GitHub/Drive canlı test, uyku/uyanma, 24 saat güvenilirlik.
- **BLOCK:** Otomatik merge/deploy, kişisel/hukuki hassas kayıtlar, public depoya izinsiz aktarım, DeepSeek Free web otomasyonuna ilişkin doğrulanmamış otonomi iddiası.
