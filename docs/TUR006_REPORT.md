# EMBASIC DeepSeek Agent — TUR 006 teknik, güvenlik ve test raporu

**Tarih:** 09.11.2026  
**Önceki sürüm:** v1.4.0 / TUR 005  
**Yeni sürüm:** v1.5.0 / TUR 006  
**Karar:** PC kabul adayı; gerçek Windows Chrome, canlı OAuth ve GitHub/Drive hesap erişimi **NOT_RUN**.

## 1. Yeniden doğrulanan baseline

- TUR005 Chrome ve Source ZIP SHA-256, TUR005'in özgün `EMBASIC_DeepSeek_Agent_v1.4_TUR005_SHA256.txt` dosyasıyla birebir eşleşti.
- ZIP üyeleri açıldı; TUR005 teknik raporu, kabul kılavuzu ve 16 Node.js testi yeniden incelendi.
- **16 eski Node.js + manifest + Chromium DOM mock = 18/18 PASS.**
- TUR005 gerçek Chrome MV3 worker probe = **NOT_RUN** (headless Linux Chromium worker expose etmedi).

## 2. TUR006 değişiklikleri

| Kimlik | Kod | Karar / test |
|---|---|---|
| LEASE-01 | `assertLiveSyncLease()` | Geçerli görev, proje, yetki, provider, run ID, owner ve son kullanma zamanı yeniden doğrulanır |
| LEASE-02 | `githubUpload`, `ensureGithubBranch`, `driveUpload`, `ensureDriveFolder` | Uzak POST/PUT öncesinde lease fencing; mükerrer commit ve belirsiz ACK için önceki byte/metadata kontrolleri korunur |
| SCHED-03 | `runScheduler` | Beklenmedik GitHub bağlamı istisnası diğer görevlerin planını bloke etmez; sorunlu görev due kalır |
| SCHED-04 | `schedulerCheckpoint` | Son tick ve ertelenen görev sayısı AES-256-GCM kasasında tutulur; kilitli durumda tanılama verisi açıklanmaz |
| OAUTH-05 | `driveRequest` | Art arda 401 durumunda ikinci geçersiz erişim token'ı da cache'den silinir; noninteractive tek yenileme |
| DIAG-06 | `safeDiagnostics` + dashboard | stale lease, son tick, geciken context, sıradaki görev; hassas proje verisi/log içeriği yok |
| MV3-07 | `test-mv3-extension.py` | Gerçek worker testine şifreli yerel veri/no-plaintext, kilitli session key, yeniden başlatılan alarm kontrolü eklendi |
| REG-08 | 4 TUR006 `.cjs` testi | Drive/GitHub uzak yazmaya geç kalma, lease sahibi değişimi/izin iptali, OAuth, proje zamanlayıcı yalıtımı |

## 3. Test matrisi

| Kontrol | Durum |
|---|---|
| 16 eski Node.js test grubu | **PASS** |
| TUR006 4 yeni Node.js regresyon grubu | **PASS** |
| Manifest/arayüz dosya ve sürüm denetimi | **PASS** |
| Chromium DOM arayüzü (mocked extension runtime) | **PASS** |
| JavaScript sözdizimi ve Python derleme kontrolü | **PASS** |
| Gerçek Linux Chromium MV3 worker (headless) | **NOT_RUN** — worker expose edilmedi |
| Xvfb üzerinden fiziksel worker denemesi | **NOT_RUN** — zaman aşımı; başarılı kabul sayılmadı |
| Windows Chrome fiziksel servis çalışanı, alarm, restart | **NOT_RUN** |
| Google OAuth / Drive canlı read-write | **NOT_RUN** |
| GitHub gerçek repo branch ve commit | **NOT_RUN** |
| 24 saat/uyku-uyanma kararlılık testi | **NOT_RUN** |
| DeepSeek Free web otomasyonu | **NOT_IMPLEMENTED** — hizmet sınırlarını ihlal eden yöntem eklenmedi |

Toplam yerel doğrulama: **20 Node.js + 1 manifest + 1 Chromium DOM mock = 22/22 PASS**. Bağımsız gerçek worker probe yerel grup sayısına dahil değildir.

## 4. Güvenlik ve açık riskler

1. **Lease fencing sınırlıdır.** İki süreçte ağ değişkenliği/çökme sırasında mutlak *exactly-once* ispatı değildir. Uzak post-commit ACK kaybı, sonradan metadata/bytes readback ile ele alınır; sürüm/fencing token'ı resmî GitHub/Drive API tarafından atomik doğrulanmaz.
2. **MV3 geçicidir.** Chrome servisi 30 saniye boşlukta askıya alınabilir; worker belleğine güvenilmemeli. Zamanlayıcı alarmı Chrome kapalı/PC uykuda yürütmez. <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
3. **AES-256-GCM kasa anti-rollback değildir.** Son şifreli checkpoint'in geri yüklenmesi en yeni turu kaybettirebilir; kasa parolası unutulursa bağımsız kurtarma anahtarı yoktur. Kalıcı session key değil `storage.session` kullanılır; canlı oturumun zararlı yazılıma karşı güvenli olduğu iddia edilmez.
4. **Gerçek Chrome OAuth Client ID** verilmedikçe Google Drive bağlantısı çalışmaz. Kapsam `drive.file`; `chrome.identity` yalnız kullanıcı etkileşimli bağlantıyı başlatır, arka planda noninteractive token alınır. <https://developer.chrome.com/docs/extensions/reference/api/identity>
5. **Public GitHub** izinli olsa bile gerçek hukukî/hassas belgeyi göndermeyin; regex tabanlı anahtar tespiti kapsamlı DLP değildir. Yalnız seçilmiş depo fine-grained PAT'ı kullanılmalı.
6. **Eski kayıtların fiziksel silinmesi** dosya sistemi/SSD geri alma alanları bakımından garanti edilmez. Kasa kilitlenmesi hareket hâlindeki işlemi yarıda kesmek için kullanılmamalı.
7. **DeepSeek Free web otomatik mesaj/yanıt toplama yoktur.** Saatlik görev yalnız kullanıcıya *talimat hazırlar*; kullanıcının onayladığı yanıtın Drive/GitHub'a aktarımı otomatik çalışabilir.

## 5. Kabul ve devam kapıları

- **PASS:** Baseline SHA, 22 yerel grup, paket içerik/manifest, ek güvenlik testleri, kaynağa dayalı teknik dokümantasyon.
- **PENDING / NOT_RUN:** Windows gerçek MV3 servis çalışanı ve Chrome'da açılma, OAuth, Drive/GitHub canlı doğrulama, 24 saat uyku/uyanma.
- **BLOCK:** Üretim/onaysız public yayın, `main` commit, otomatik merge/deploy, gerçek hassas evrak, DeepSeek Free kullanım sınırlarını aşan otomasyon.
