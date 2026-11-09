# TUR013 v1.12.0 Windows PC Kabul Kılavuzu

**Durum: NOT_RUN.** Sadece ayrı, atılabilir Chrome profili ve sentetik proje/depo kullan.

1. Kurulumdan önce mevcut `.emback` şifreli yedeğini al. Mevcut eklentiyi silmeden aynı unpacked uzantı klasörüne güncelle ve `chrome://extensions` üzerinden Reload yap.
2. Chrome sürümü `1.12.0`, MV3 service worker ve `embasic-scheduler` alarmını kontrol et.
3. Kasa ilk kurulum, kilitli yeniden başlatma, parola ile açma, doğru görev/tur sayısı, tekrar eden tur olmamasını doğrula.
4. Sentetik GitHub test repo ve fine-grained PAT kullan. Gerçek sonuç ile giriş yapılmış GitHub API akışında bağlantı kopmasını simüle ederek yalnız bir rapor PUT'u olduğuna dair **gerçek** request/response kanıtı topla (gizli token'ı loglama). Uzak içerik bulunamıyorsa ikinci PUT yapılmamalı.
5. GitHub repo public olması halinde tur özelinde açık onay olmadan rapor yazılmamalı. `main` güncellenmemeli.
6. Google OAuth Client ID uzantı kimliğiyle eşleşmeli, `drive.file` dışında izin istenmemeli, Drive onaylı sentetik dosya akışında 401/403/429 ve ACK kaybı test edilmeli.
7. `python tests/test-mv3-extension.py` gerçek worker bulamazsa `NOT_RUN` başarısız değil ama kabul kanıtı da değildir; Windows gerçek worker kabul aracı `tools/test-mv3-windows.ps1` kullan.
8. Uzun süreli alarm ve PC uyku/uyanma testi en az 24 saat gözlemlenmeli; Chrome kapalıyken çalışma garantisi verilmemeli.
9. Hata/mesaj raporunda token, görev içeriği, parola veya kurum belgeleri paylaşılmamalı.

**Kabul:** gerçek MV3/Windows ve canlı entegre testler PASS olmadan `PRODUCTION_NO_GO`.
