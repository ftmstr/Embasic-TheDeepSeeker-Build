# TUR014 v1.13.0 — Teknik Güvenlik ve Doğrulama

## Kapsam
- GitHub dalı oluşturulurken kalıcı AES-256-GCM journal; kayıp POST ACK ve 404 altında ikinci POST yok.
- 422 eşzamanlı dal oluşturma yarışında uzak SHA karşılaştırması; farklı HEAD fail-closed.
- Daha önce rapor PUT ACK kaybı varsa ilerlemiş HEAD ile dosya geri okuması, tam bayt eşleşmesi ve PUT tekrar yasağı.
- Google Drive klasör/rapor mutasyonundan önce şifreli intent; klasörde ebeveyn ve app-owned metadata readback.
- 401/429 mutasyonundan sonra token temizleme ve write replay engeli.
- Bozuk kasa kurtarma sonrası otomatik görevler ve tüm eski senkronizasyon onayları karantinaya alınıyor.
- Kaynak/manifest v1.13.0. 

## Kanıt ve sınırlar
57 Node.js testi + 1 statik paket testi + 1 mocked Chromium UI testi yerel olarak çalıştırılır. Gerçek Windows Chrome MV3, 24 saat bekleme/uyku-uyanma, canlı OAuth/Drive/GitHub API mutasyonları: ancak gerçekten çalıştırılırsa PASS, aksi hâlde NOT_RUN. GitHub Actions durumunun SHA ile doğrulanması ayrı adımdır.

Bu uygulamanın salt Chrome storage tabanlı lease mekanizması dağıtık compare-and-swap ya da hardware anti-rollback değildir. Gerçek bağımsız eşzamanlı istemcilerle yazma tekilliği ispatlanmış değildir. Güvenilmeyen 404 ve uzak izin/visibility yarışlarında güvenli bloke olma tercih edilir. DeepSeek Free otomasyonu eklenmedi. `main`e merge/deploy yapılmadı.
