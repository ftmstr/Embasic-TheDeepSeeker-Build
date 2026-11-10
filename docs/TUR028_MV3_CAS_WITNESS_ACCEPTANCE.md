# TUR028 — gerçek MV3 / profil-arası CAS / tanık tazeliği kabul sınırı

## Kapsam ve delil düzeyleri

- `tests/test-tur028-cross-profile-boundary.cjs` **SYNTHETIC**: iki bağımsız profilin aynı `beforeOid` değerinden yarışması (mock sunucuda tek kazanan); kayıp Drive POST yanıtında iki profilin ayrı WAL'leri nedeniyle **çift POST**; gerçek ECDSA imzasıyla geçerli eski tanığın yeniden oynatılabilmesi. Canlı API, çoklu fiziksel cihaz veya bağımsız monotonik tanık **NOT_RUN / NOT_PROVEN**.
- `.github/workflows/ci.yml` Chromium işi önce **MOCK UI** çalıştırır, sonra ayrı isimli, izole gerçek **Linux Chromium MV3 unpacked worker** probunu `tests/test-mv3-extension.py` üzerinden başlatır. İki sonuç birbirine karıştırılmaz. `PASS MV3 REAL worker` ancak işçi gerçekten açılıp alarm, kilit, şifreli saklama, Web Locks ve tarayıcı yeniden başlatma doğrulandığında geçerlidir; başlatılamayan ortam veya süre aşımı **NOT_RUN**, gerçek assertion hatası **FAIL**.
- Linux CI'daki gerçek işçi probu başarılı olsa bile fiziksel Windows PC, Chrome masaüstü sürümü, 24 saat gerçek uyku/uyanma, birden fazla gerçek profil ve canlı sağlayıcı kabulünün yerini TUTMAZ. Bunlar ayrı tutanaklarla yapılmadıkça **NOT_RUN**.

## Dağıtık güvenlik sınırları

- GitHub GraphQL `updateRefs(beforeOid)` yalnız belirli Git ref'i için koşullu güncelleme modelidir. REST branch PUT, dosya yazımı ve Drive multipart POST üzerinde atomik bir dağıtık kilit veya exactly-once garantisi değildir. COMMIT ACK kaybında tekrar POST/MUTATION otomatik denenmez.
- Aynı-origin `navigator.locks` farklı Chrome profillerini veya fiziksel cihazları koordine etmez. Yerel şifreli WAL ve profil-bağımlı consent/lease ortak sunucu fence değildir.
- İmzalı eski ECDSA tanığı ve eski geçerli AES-GCM kasası birlikte geri alındığında salt imza doğrulaması tazeliği kanıtlamaz. Güvenilir dış anahtar pinleme, nonce, son kuşak/digest ve ayrı nonrollbackable monotonik anchor **yok**. `authenticated:true` gibi bayraklar güven sınırı OLAMAZ.

## Yetki, test ve teslimat kararı

- Testler sentetik içerik kullanır, OAuth token istemez, DeepSeek Free sohbet/web otomasyonu/scraping yapmaz. `main` merge/deploy yok.
- Kaynak/Chrome ZIP sadece exact Draft PR HEAD'den paketlenir; Git blob, ZIP CRC, Chrome paritesi, SHA-256 ve Drive raw-byte readback tamamlanmadan TUR028 teslim edildi denmez.
- Hazırlık puanı önceki **79/100**, güvenilmeyen kanıtla yükseltilmez: `PC_TEST_CANDIDATE / PRODUCTION_NO_GO`.
