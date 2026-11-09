# TUR014 v1.13.0 — Windows Chrome PC kabul

**Yalnız sentetik test verisi kullan. Gerçek Windows/Chrome kabulü henüz yapılmadıysa NOT_RUN yaz.**

1. Mevcut Chrome eklentisini kaldırmadan `.emback` şifreli yedeği al. Aynı uzantı klasöründeki dosyaları değiştir; extension ID, OAuth client ID ve kullanıcı profilini koru.
2. Chrome `chrome://extensions` -> Reload -> `1.13.0` manifest, gerçek worker konsolu ve `embasic-scheduler` alarmı 1 dakika periyot doğrulansın.
3. Node.js 22 ve Python 3 ile `powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1`; ayrıca `powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1` (worker yoksa FAIL).
4. Boş sentetik test profilinde ilk kasa kurulumu, farklı iki görev, aynı tur tekilliği, kasa kilidi ve Chrome kapat/aç yeniden başlatma.
5. Test deposu ile GitHub dal POST ACK kaybı ve HTTP 422 eşzamanlı yazıcı yarışı: GET ref 404 üzerine ikinci dal oluşturma POST'u olmamalı. Ref HEAD değişmişse yanlış rapor PUT'u engellenmeli.
6. Sentetik GitHub PUT kayıp ACK ardından dal HEAD ilerlese bile yalnız aynı uzak rapor baytlarına sahip mevcut dosya uzlaştırılmalı; ikinci PUT gönderilmemeli.
7. Drive app-owned klasör oluşturma ve multipart rapor yükleme sırasında 401/403/429/404, ağ kopması, tutarsız parent, stale GET; kalıcı niyet olmadan ikinci POST olmamalı.
8. Bozulma/kurtarma senaryosunu **yalnız atılabilir Chrome profilinde** yap: eski şifreli yedek kurtarılınca görevler kapalı, tüm bulut izinleri blokeli olmalı. Üretim kasasını kasten bozma.
9. Çoklu bağımsız Chrome profili, farklı gerçek yetki sahibi ve 24 saat uyku/uyanma senaryoları tamamlanmamışsa NOT_RUN. Chrome alarmı uykudaki PC'yi uyandırmaz.
10. Chrome/Google/GitHub token'larını, parolaları, proje prompt'larını ve kişisel verileri test günlüğüne koyma.

**PRODUCTION_NO_GO**: gerçek MV3, çift-istemci ve canlı yetkili entegrasyon kabulü yapılana kadar.
