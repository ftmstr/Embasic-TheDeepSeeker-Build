# EMBASIC TheDeepSeeker — TUR016 v1.15.0 Teknik ve Güvenlik Raporu

**9 Kasım 2026 | Geliştirme paketi | PC_TEST_CANDIDATE / PRODUCTION_NO_GO**

## TUR015 kanonik başlangıç

- Public `ftmstr/Embasic-TheDeepSeeker-Build` stacked Draft PR #1-#4 doğrulandı; TUR015 Draft PR #4 HEAD `54be998b955c6a52a583b4805b01c0096e4baba0`, base TUR014 dalı, merge/deploy yok.
- GitHub Actions TUR015 run `42598367449` 3/3 SUCCESS (Windows Node/manifest, Ubuntu Node/manifest, Chromium **MOCK** UI). Drive TUR015 raporu ve merkez `ILERLEME_DURUMU.md` aynı SHA/run içeriyor.
- TUR015 Source ZIP `de76ed95f5563f5566fa171f17ddb39b4659ff75d01c76f1825201098ef50d8d`, Chrome ZIP `e9ba56ad2160c205d8d23c51734f0ca55fa3da1920e87b881e4be952da2a9b22`, CRC testleri PASS; 121/121 GitHub-takipli dosya Git blob eşleşmesi önceki turda doğrulanmış.
- TUR014 Drive kaynak ZIP köken uyuşmazlığı korunur; kanonik yeni TUR016 kaynağı TUR015 GitHub HEAD ve eşdeğer Source ZIP'tir.
- TUR016 mevcut PR/rapor bulunmadığı için yineleme yapılmadı.

## TUR016 somut değişiklik

- `serialize()` artık Web Locks API varsa `embasic-sealed-state-write-v3` adını exclusive alır; aynı uzantı-origin'inde farklı çalışanların kasa/lease/journal yazmasını sıraya koyar. Web Lock isteği hata verirse kilitsiz fallback yok. API yoksa iyimser stamp koruması kalır; bunun eksiksiz CAS olmadığı tanılama `crossContextWebLock=false`, `distributedCas=false` ile görünür.
- `assertLiveSyncLease`, lease edinim ve son `synced` commit içindeki `recoveryQuarantined` kontrolleri savunma derinliği için eklendi. Kurtarılmış önceki run'ın stale context yardımıyla yayınlanması engellenir.
- Gerçek Chrome MV3 test betiği Web Locks API'nin worker'da gerçekten bulunmasını denetler (worker bulunmazsa Linux NOT_RUN, Windows strict FAIL). Dashboard tanılamasında lock API durumu ve dağıtık CAS sınırı görünür.
- Testlerde Web Locks ortak sıraya almada bağımsız VM worker mock, başarısız lock acquire, bağımsız worker + Drive global WAL, OAuth 403/429, GitHub 422/404 ACK belirsizliği, anti-rollback olmadan eski geçerli ciphertext tekrar kabulü (**beklenen olumsuz kanıt**) ayrı adversarial senaryolardır.
- Gizli token, gerçek kullanıcı raporu, canlı OAuth/Drive/GitHub ve DeepSeek web sohbeti otomasyonu eklenmedi.

## Test matrisi

- Önceki 64 Node grubunun tamamı tekrar doğrulanacak; 6 yeni TUR016 Node grubuyla 70 Node hedefi.
- Paket/manifest 1, simüle Chromium UI 1: toplam **72 yerel grup hedefi**. Gerçek Chrome Worker NOT_RUN; Windows fiziksel ve canlı hesap testi NOT_RUN.
- Test koşumunun gerçek PASS/FAIL ve varsa CI run/job kimliği ek tamamlayıcı raporda doğrulanacaktır. Bu taslak CI başarı beyanı değildir.

## Güvenlik sınırı ve yayın kararı

Web Locks aynı Chrome profili/origin'ine bağlıdır; farklı cihaz, aynı repo için iki uzaktan bağımsız writer, yitirilmiş ACK veya haricî tam ciphertext rollback için atomik distributed transaction sağlamaz. Kasıtlı geçerli eski ciphertext geri yüklemesi AES-GCM ile tespit edilemez. Gerçek fiziksel Chrome MV3 ve canlı resmi API doğrulanmadığı sürece `PRODUCTION_NO_GO`. Main'e merge veya deploy YOK.

**Ölçüm:** TUR015 %74 ağırlıklı mühendislik hazırlığı; TUR016 için önerilen %77 (çekirdek 34/35, kasa/scheduler 17/20, bulut 17/20, gerçek MV3 0/15, dokümantasyon 9/10). Bu performans / üretim uygunluğu ölçümü değildir.
