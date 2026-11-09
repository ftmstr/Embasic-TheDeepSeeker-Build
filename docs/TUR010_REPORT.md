# EMBASIC DeepSeek Agent — TUR 010 Teknik ve Güvenlik Raporu

**Sürüm:** v1.9.0 · 09.11.2026  
**Karar:** PC_TEST_CANDIDATE; gerçek Chrome ve canlı API'lar doğrulanmadan üretime uygun ilan edilmez.

## 1. TUR009 kaynaklarının doğrulanması

- Chrome v1.8.0 SHA-256: `7d89602647c770d4fb059e3d6bfbebe88fe4152e95a4f2cc1a8b7a6495463b0e` — kayıt eşleşmesi **PASS**.
- Source v1.8.0 SHA-256: `e7df65848879321a3c2761f921b09ddbc07f4127e1aa04c490d7668f91e12e0e` — kayıt eşleşmesi **PASS**.
- Önceki 34 Node, 1 paket ve 1 Chromium DOM mock = **36/36 PASS** (`TUR010_baseline.log`).
- Gerçek MV3 worker'ı testin çalıştığı Linux Chromium'da elde edilemedi — **NOT_RUN**.

## 2. Uygulanan kod düzeltmeleri

1. **GitHub görünürlük yarışı:** Repo özelken verilen ilk yetki kontrolü tek başına yeterli sayılmaz. Rapor `PUT` öncesi depo görünürlüğü tekrar okunur, public ise `publicConsentAtCompletion` veya run özelinde `publicConsentManual` aranır. Talimat/lease kontrolü tekrar yapılır.
2. **Drive yükleme sonrası okuma kanıtı:** Uzak `file.id`, rapor dosya adı, MIME türü, hedef ebeveyn, uygulama işareti, run/task kimlikleri ve SHA-256 doğrulanır; `alt=media` ile dosyanın gerçek baytları raporla eşleştirilir. Çelişkili makbuz **fail-closed**, sessiz üzerine yazma yoktur.
3. **404 / ACK belirsizliği:** Başarılı `POST` sonrasındaki readback `HTTP 404` sunucu gecikmesi olabilir; kesin hata ilan etmek yerine transient retry yapılır. **İkinci POST aynı deneme içinde yapılmaz**; uzaktaki appProperties ve içerik daha sonraki turda yeniden denetlenir.
4. **OAuth/429 ek regresyon:** 403, 429 ve uzun Retry-After değerleri, istemcinin mutasyon isteğini otomatik tekrarlamamasını doğrular.
5. **Kilitli restart:** Zorunlu kasa, kilitli işlem reddi, alarm kaydı ve tekil bekleyen tur ömrü yeni testle korundu.

**Artık riskler:** Uzak provider tarafında atomik unique constraint yoktur; bağımsız istemciler eşzamanlı iki dosya üretebilir. İki visibility GET'i arasında değişim hâlâ mümkün; tüm sağlayıcı yarışlarının ortadan kalktığı iddia edilmez. Chrome `storage.session` worker/Chrome yaşam döngüsüne bağlıdır. Yerel üst-düzey işlemler OS destekli donanım anahtarında tutulmaz.

## 3. Test kapsamı

| Doğrulama | Durum |
|---|---|
| TUR009 36 yerel grup, aynen korunarak yeniden çalıştırma | PASS |
| Yeni GitHub visibility TOCTOU testi | PASS (mock) |
| Drive receipt parent/task/digest/byte readback testi | PASS (mock) |
| 403/429 mutasyon-replay ve Retry-After testi | PASS (mock) |
| Şifreli kasa kilitli restart/alarm testi | PASS (storage mock) |
| Drive yükleme sonrası geçici 404 testi | PASS (mock) |
| **39 Node + 1 package + 1 Chromium DOM mock** | **41/41 PASS** |
| Gerçek unpacked Chrome MV3 servis çalışanı, yeniden başlatma | **NOT_RUN** |
| Windows 24h/uyku-uyanma, canlı OAuth/GitHub/Drive | **NOT_RUN** |
| DeepSeek Free web insansız otomasyonu | **NOT_IMPLEMENTED** |

**Kanıt:** `EMBASIC_DeepSeek_Agent_TUR010_Test_Sonuclari.txt`, ZIP SHA-256 listesi. Simüle arayüz `chrome.*` mock içerir; fiziksel Chrome worker başarısı değildir.

## 4. Devam önerisi

Gerçek Windows Chrome v1.9.0 kurulumunda 41 yerel test + sıkı MV3 test betiği geçmeden üretim aşamasına ilerlenmemeli. Google OAuth Client ID kullanıcı ortamına özgüdür; örnek değeri geçersizdir. Canlı denemede yalnız sentetik proje ve izinli test deposu kullanılmalı. DeepSeek Free web otomasyonu eklemeyin.
