# EMBASIC DeepSeek Agent — TUR 007 teknik/güvenlik raporu

**Sürüm:** v1.6.0 (TUR 007)  
**Tarih:** 09.11.2026  
**Temel:** v1.5.0 (TUR 006) kaynak ZIP, Chrome ZIP, SHA-256, rapor ve testler  
**Karar:** PC kabul adayı; üretim/canlı hesap işlemi kanıtlanmamıştır.

## 1. Bağımsız başlangıç doğrulaması

- `EMBASIC_DeepSeek_Agent_v1.5_TUR006_Chrome.zip` SHA-256: `e5a6c5e1aa9d672d766b0eb0b00fb32baccddb862ce6631d8fb03431d66e9c08`.
- `EMBASIC_DeepSeek_Agent_v1.5_TUR006_Source.zip` SHA-256: `2a6b54ad98e3c2a5c659051e9b7db25ff8a18bcd8d367977b41bd2e44e9e6012`.
- İki değer özgün TUR006 SHA belgesiyle birebir uyuştu. Kaynak ZIP açıldı ve `tests/run_all.sh` üzerinden eski 20 Node.js, paket denetimi ve simüle Chromium arayüz testi **22/22 PASS**. Gerçek unpacked MV3 worker **NOT_RUN**.

## 2. Kod değişiklikleri ve tehdit modeli

| Kimlik | Gerçek değişiklik | Önlenen risk | Kanıt |
|---|---|---|---|
| CONTEXT-07 | `background.js:runScheduler` içinde ağ sırasında değişmiş görev revizyonu, talimat, repo, dosya, dal, proje ve enabled alanının kilit öncesi tekrar denetimi | Eski repo verisinin yeni görev promptuna karışması | `test-tur007-context-race.cjs` |
| LEASE-07 | `assertLiveSyncLease` geçersiz sahip/yetki ve süresi dolmuş lease'i ayırır | Eski worker'ın yeni uzak yazma başlatması / yanlışlıkla başarılı sayma | `test-tur007-late-ack.cjs` ve eski TUR006 fence testleri |
| ACK-07 | Drive/GitHub upload'undan **sonra** ve lokal `synced` kaydından önce lease'in tekrar doğrulanması | HTTP ACK dönene kadar süresi dolan lease'i başarılı kaydetme | `test-tur007-late-ack.cjs` |
| PARENT-07 | `findDriveFolder` sonuçlarında bildirilmiş `parents` beklenen klasörle çelişirse işlemi durdurur | App-owned metadata taklidi / yanlış klasörle çakışma | `test-tur007-drive-ownership.cjs` |
| VAULT-07 | Çökme, açık depoya fallback, bozuk şifreli kayıt ve açık onaylı recovery adversarial tekrarı | Sessiz rollback/veri açığa çıkması | `test-tur007-vault-crash.cjs` |
| MV3-07 | Chrome gerçek worker probe için sıkı mod `EMBASIC_REQUIRE_MV3` ve `tools/test-mv3-windows.ps1` | `NOT_RUN` çıktısının yanlışlıkla kabul edilmesi | Windows üzerinde çalıştırılacak; henüz **NOT_RUN** |

Eski 20 Node.js test grubu korunmuştur. TUR006'nın eski 'expired => blocked' test beklentisi, daha güvenli `expired => retry+remote readback` davranışına uyarlanmıştır; **uzak mutasyonun engellenmesi koşulu değiştirilmemiştir**.

## 3. Test matrisi

| Test grubu | Durum | Not |
|---|---|---|
| Eski TUR001–006 regresyonları (20 Node.js) | PASS | v1.6 üzerinde yeniden çalıştırıldı |
| TUR007 dört adversarial Node.js testi | PASS | Context race; late ACK; encrypted crash; Drive parent conflict |
| Chrome Manifest V3 paket / ikon / UI ID kontrolü | PASS | Yerel yapısal test |
| Gerçek Chromium motoruyla **mock** extension runtime UI testi | PASS | Gerçek MV3 worker testi değildir |
| JS `node --check`, Python `py_compile` | PASS | Söz dizimi |
| Gerçek Windows Chrome MV3 servis çalışanı | **NOT_RUN** | Fiziksel PC kabul gerekli |
| Linux headless gerçek MV3 worker probe | **NOT_RUN** | Chromium worker'ı bu ortamda expose etmedi |
| Google OAuth hesabı / Drive gerçek dosya işlemi | **NOT_RUN** | Gerçek token ve yetki kullanılmadı |
| GitHub gerçek repo branch/commit ve readback | **NOT_RUN** | Testler mock API üzerinde |
| Windows 24 saat / sleep/wake | **NOT_RUN** | Uzun süreli PC kabul bekleniyor |
| DeepSeek Free otomatik sohbet | **NOT_IMPLEMENTED** | Kullanım koşullarını ihlal eden otomasyon eklenmedi |

**Sayım:** 24 Node.js + 1 paket + 1 simüle Chromium arayüzü = **26/26 PASS**. Bunların hiçbirisi gerçek hesap veya çalışan uzantı servis çalışanı kabulü değildir.

## 4. Değişmeyen güvenlik ilkeleri

- Chrome'un MV3 worker ömrü sınırlıdır; alarm zamanlaması PC uykudayken çalışmaz. Kullanıcının onayı olmadan rapor GitHub public'e yüklenmez. `main`/`master` commit, PR, merge, deploy yok.
- Depodaki içerik prompt'a **güvenilmeyen veri** olarak eklenir; otomatik kod yürütme yapılmaz.
- Yerel çalışma verisi AES-256-GCM kasada ve parola-türetilmiş anahtarda saklanır; anahtar tarayıcı oturumu ile sınırlıdır. Son sağlam şifreli kopya kesin anti-rollback sağlamaz.
- GitHub/Drive uzak yazmanın atomik 'exactly-once' garantisi yoktur. POST sonrası ACK kaybında uzak rapor baytı/metadata karşılaştırılmadan ikincisi yazılmaz; idempotency, etki alanına özgü bir iyi çaba korumasıdır.
- Basit `detectSecrets` regex'i kurum verisi / kişisel veri sızıntı önleme için yeterli değildir. Hassas dosyalarla test edilmemeli; OAuth erişimi ve PAT izinleri en aza indirilmeli.

## 5. Dış platformlar ve kabul kapıları

Resmî kaynaklar:
- Chrome MV3 worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- GitHub Contents REST API: https://docs.github.com/en/rest/repos/contents
- Google Drive Files API: https://developers.google.com/workspace/drive/api/reference/rest/v3/files

**PASS üretim izni değildir.** Gerçek Chrome worker ve canlı OAuth/GitHub/Drive hesap testleri geçmeden v1.6 güvenle üretim ortamına alınmış sayılmaz. Eklentinin işlevi DeepSeek Free web sohbetine otomatik mesaj göndermek değil, görev talimatı hazırlamak ve kullanıcı onaylı çıktıyı yetkili API üzerinden arşivlemektir.
