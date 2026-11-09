# EMBASIC TheDeepSeeker TUR 013 — v1.12.0 Teknik/Güvenlik Raporu

**Tarih:** 09.11.2026 (Europe/Istanbul)

## Başlangıç (kanıt)
- Önceki Draft PR #1, bootstrap/tur012-v1.11.0, SHA `62873b7c1e548332ef3781ceea4d9d10ac3aa8f9`. Önceki GitHub Actions iki olayda toplam 6/6 job SUCCESS.
- TUR012 Drive raporu / ILERLEME_DURUMU.md incelendi; TUR013 henüz yapılmamıştı.
- Önceki kaynak/Chrome ZIP dosyalarının SHA-256 kayıtları yeniden doğrulandı.

## Kod değişiklikleri
1. `normalizeState` içindeki `githubUncertainCommit` bayrağı kalıcı ve şifreli state olarak kabul ediliyor; eski arşivlerle uyumlu varsayılan `false`.
2. GitHub PUT öncesinde sağlayıcı kimliği, görev revizyonu, aktif lease, yazma yetkisi kontrol edilerek belirsiz işleme ilişkin **kalıcı niyet kaydı** diske yazılıyor. Kayıt hatasında PUT yapılmıyor.
3. PUT başlatılıp sunucu hata/ACK kaybı döndüğünde bayrak korunuyor; uzaktaki dosya görünmüyorsa başka PUT gönderilmiyor. Daha sonra aynı SHA/rapor içeriği GET üzerinden doğrulanırsa `synced` olabilir; farklı bayt varsa blocked.
4. Lease başka worker tarafından devralınırsa PUT öncesi kontrol değişmiş token'ı reddediyor.
5. Kasa kilitliyken GitHub belirsiz işlem sayısı tanılamada `null` tutuluyor; açıldığında sayı görülebiliyor. Token/parola içerilmiyor.
6. 4 yeni adversarial Node.js testi eklendi. GitHub Actions Linux/Windows beklenen test sayısı 50; Chrome manifest v1.12.0.

## Doğrulama
- TUR013 yerel: **50/50 Node.js PASS**; statik manifest/paket **PASS**; mock Chromium UI **PASS**. Toplam 52/52 yerel grup.
- GitHub Actions yeni SHA için sonuç commit sonrası ayrıca kontrol edilir.
- Gerçek Windows fiziksel Chrome MV3, 24 saat uyku/uyanma, uzantının canlı OAuth/Drive/GitHub API entegrasyonları: **NOT_RUN**.
- Sağlayıcı exactly-once garantisi verilmez; GitHub yetki/visibility TOCTOU yarışlarının küçük penceresi devam eder.

## Gelecek
- TUR014: GitHub karşılıklı bağımsız writer/CAS, branch-create belirsiz POST, doğrulama gecikmesi, 403/409/429; gerçek MV3 test ortamı.
- Kasıtlı DeepSeek Free web DOM otomasyonu yok. Main'e merge, canlı dağıtım yok.
