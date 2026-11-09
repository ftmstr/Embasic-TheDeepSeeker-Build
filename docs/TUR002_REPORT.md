# EMBASIC DeepSeek Agent TUR 002 — Teknik ve test raporu

**Tarih:** 08.11.2026  
**Başlangıç:** v1.0.0, önceki SHA256 manifestosu eşleşerek doğrulandı.  
**Çıktı:** v1.1.0 — yalnızca masaüstü Chrome için kurulabilir test sürümü.

## Başlangıç envanteri

- v1.0 kaynak ZIP'inden tam kod, 5 test grubu ve Windows kabul belgesi incelendi.
- `node tests/test-core.cjs`, `test-security.cjs`, `test-sync.cjs`, `python test-package.py` ve `test-ui-smoke.py` başlangıçta **PASS**.
- Önceki raporun `NOT_RUN` niteliğindeki canlı GitHub, Google Drive ve fiziksel Chrome testleri devam ediyor; iddia düzeyi yükseltilmedi.

## Güvenlik bulguları ve giderimler

| ID | Önceki açık / risk | TUR002 değişikliği | Kanıt |
|---|---|---|---|
| ISO-01 | Bekleyen görevde proje/bağlam değiştirilebilir, özet yanlış projeye taşınabilir | Proje kimliği değişmez; pending içerik dondurulur; revizyon kontrolü ve bağlam sıfırlama | `test-isolation.cjs` |
| PUB-02 | Sonradan public izin açmak tamamlanmış eski raporları yayınlayabilir | Tamamlanma anı onayı snapshot'ı + rapora özel manuel onay | `test-sync.cjs` |
| BAK-03 | Dışa aktarılan düz JSON tüm talimat ve yanıtları içerir | AES-256-GCM şifreli `.emback`, yanlış parola/bozma ret | `test-backup.cjs` |
| SYNC-04 | Aktarım sürerken silme/restore/ayar değiştirme yarışları | Eşzamanlı kritik işlem kapıları | `test-races-and-limits.cjs` |
| RETRY-05 | HTTP 429/403 rate-limit yanıtlarında sunucunun bekleme tercihi dikkate alınmaz | `Retry-After`, GitHub reset/remaining okuma, en çok 1 saat bekleme | `test-races-and-limits.cjs` |
| SECRET-06 | Talimat ve GitHub dosya bağlamına key desenleri alınabilir | Görev giriş kapısı + GitHub alıntı engelleme | `test-isolation.cjs`, `test-security.cjs` |
| STORE-07 | Yerel arşiv sınırsız büyüyebilir | 32 MB fail-closed yazma sınırı | `background.js` (statik kontrol) |

## Test matrisi

- `node tests/test-core.cjs` — **PASS**
- `node tests/test-security.cjs` — **PASS**
- `node tests/test-sync.cjs` — **PASS**, mock GitHub/Google Drive API
- `node tests/test-isolation.cjs` — **PASS**
- `node tests/test-backup.cjs` — **PASS** (WebCrypto gerçek kripto)
- `node tests/test-races-and-limits.cjs` — **PASS**, kontrollü simüle edilmiş ağ yarışı
- `python tests/test-package.py` — **PASS**, kaynak/manifest kontrolü
- `python tests/test-ui-smoke.py` — **PASS**, gerçek Chromium DOM + **MOCK Chrome runtime**
- Fiziksel Windows Chrome `chrome.runtime` + MV3 servis çalışanı — **NOT_RUN**. Linux Chromium persistent-headless deneyinde worker tespit edilemedi; başarı olarak raporlanmaz.
- Canlı Google OAuth / gerçek Drive API yüklemesi — **NOT_RUN**.
- Canlı GitHub commit/branch — **NOT_RUN**.
- Saatlik uyku/uyanma gerçek cihaz testi — **NOT_RUN**.
- DeepSeek Free insansız yanıt döngüsü — **NOT_IMPLEMENTED** (tasarım/koşul sınırı).

## Kalan önemli riskler

1. **Üretim onayı yok:** Fiziksel Windows Chrome ve gerçek servis API uçtan uca kabulü gerekir.
2. **Yerel arşiv şifresiz:** Şifreli dışa aktarma local saklama koruması değildir; hassas belge için kullanılmamalıdır.
3. **Kullanıcı onayının zorunluluğu:** DeepSeek Free web sohbeti gerçek saatlik otonom model yürütücüsü değildir.
4. **Olası mükerrer bulut kayıtları:** Ağ yanıtı kaybı nedeniyle Drive'da tekillik garantisi yok; kontrol için klasör ve UUID kullanılmaktadır.
5. **Güvenlik filtresi sınırlıdır:** Gizli veri tespitleri regex tabanlı; kişisel veri sızdırmazlığı garantisi yoktur.

## Yayın kapıları

`Chrome.zip` PC kabul içindir; kendiliğinden Chrome Web Store'a, GitHub'a veya Google Drive'a gönderilmemiştir. Otomatik deploy, main'e merge, paralı API tüketimi yoktur. Paket SHA-256 ile denetlenebilir. Testler sadece yerel koşullarda yapıldı.
