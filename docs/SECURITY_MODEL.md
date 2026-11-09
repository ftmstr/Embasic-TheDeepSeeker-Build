# Güvenlik modeli — v1.2 TUR003

1. **Model erişimi:** DeepSeek Free web sayfası kontrol edilmez, otomatik kazınmaz, login çerezleri okunmaz; yalnızca kullanıcı denetimli metin alışverişi.
2. **Veri saklama:** Kullanıcı kasayı açıp etkinleştirince `embasicSealedStateV3` AES-256-GCM ciphertext içerir; JSON plaintext storage key'leri kaldırılır. Anahtar `chrome.storage.session` ile sınırlıdır. Kasa kilitliyken bütün görev ve Drive/GitHub sync işlemleri durur.
3. **Kriptografi:** PBKDF2-SHA256 310k, rastgele 128-bit salt, 256-bit AES, her yazımda 96-bit yeni IV, sürüm/kdf doğrulama ve sabit additional authenticated data. Parola kurtarma arka kapısı yoktur.
4. **Geriye uyumluluk:** Önce sealed yeni kayıt yazılır, sonra eski plaintext kaldırılır. Yarım kalırsa sealed üstün tutulur; doğru parolayla açınca eski açık kayıtlar temizlenir. Tarihsel SSD kalıntılarının güvenli silinmesi iddia edilmez.
5. **GitHub:** Token oturum veya ayrı PBKDF2+AES-GCM kasasında, kaynak dal `main` doğrudan yazılmaz; her rapor için UUID yolu. Uzak rapor içeriği aynıysa PUT yok; farklıysa bloke. Public depolara açık tur onayı gerekir.
6. **Drive:** OAuth `drive.file`; yalnız app tarafından tanınan dosyalara ve klasörlere işlem. Yol proje/görev kimliğiyle ayrılır. Dosya UUID + appProperties tekilliği destekler, ancak dağıtık exactly-once garantisi yoktur.
7. **Çalışma güvenilirliği:** Chrome MV3 worker kısa ömürlüdür; alarmlar yeniden kurulur, durdurulduğu yerden state saklanır. Cihazı uyandıramaz. Kilitli kasada otomasyon devre dışıdır.
8. **Sınırlamalar:** Tarayıcı/işletim sistemi kötü amaçlı yazılımı, açık kasanın belleği, bilinmeyen DLP örnekleri, hatalı OAuth yapılandırması, dosya paylaşımı ve saldırganın izinli GitHub/Drive hesabında yaptığı değişiklikler kapsanmaz. Gerçek Chrome ve API kabulü PC'de gereklidir.
