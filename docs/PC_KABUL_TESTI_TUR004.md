# EMBASIC DeepSeek Agent v1.3 — Windows Chrome PC kabul kılavuzu

**Test verisi:** Yalnız `TEST-TUR004` adlı sentetik proje kullan. Gerçek kişi, soruşturma, mahkeme, kimlik, parola, kurum sırrı yükleme. Şifreli `.emback` yedeği olmadan eski uzantıyı kaldırma.

## A. Kurulum ve veri koruması

- [ ] Önceki v1.2 ile şifreli yedek oluşturuldu, yedek diske kopyalandı ve parola ayrı saklandı.
- [ ] ZIP'in en üst klasöründe `manifest.json` görüldü; Chrome `chrome://extensions` içinde paketlenmemiş olarak aynı klasörden **yeniden yükleme** yapıldı.
- [ ] Eklentide `v1.3 TUR004` ve Chrome uzantılar sayfasında `1.3.0` görünüyor.
- [ ] Yeni kurulumda kasayı oluşturana kadar görev ekleme **reddediliyor**; v1.2 verisi varsa kasa oluşturulduğunda eski görevler korunuyor.
- [ ] Kasa 12+ karakter güçlü parolayla kuruldu, kilitlendi ve doğru parola ile açıldı.
- [ ] Chrome kapatılıp açıldıktan sonra kasa **kilitli** geldi; görev içeriği kilitliyken görünmedi.
- [ ] Yanlış parola ile kilit açılmadı. Normal çalışan kasada **kurtarma geri alma** reddedildi.
- [ ] Eski yedekten dönüş **ayrı sentetik profil** üzerinde denendi; üretim profilinde veri kaybettirecek restore yapılmadı.

## B. Saatlik görev ve MV3 servis çalışanı

- [ ] Chrome → Eklentiler → EMBASIC → **Servis çalışanını incele** bağlantısı mevcut; konsolda hata yok.
- [ ] `chrome.alarms` içinde `embasic-scheduler`, `periodInMinutes: 1` bulundu. Chrome test konsolunda gerekirse `chrome.alarms.get('embasic-scheduler').then(console.log)`.
- [ ] Sentetik proje için 1 saat aralıklı, 2 turluk görev kaydedildi; yalnız **bir** bekleyen tur oluştu.
- [ ] Art arda `Zamanlayıcıyı şimdi kontrol et` yapıldığında bekleyen ikinci kopya oluşmadı.
- [ ] İlk turu kullanıcı onaylı test yanıtıyla bitir; görevde tamamlanan tur artmalı.
- [ ] Chrome yeniden başlatıldığında alarm yeniden kurulmalı, kasa kilitliyken yeni görev üretilmemeli.
- [ ] Saat sınırı dolmuş bir görev kasa açıldıktan sonra **bir** yeni tur oluşturmalı; geçmiş kaçırılmış tüm saatleri ayrı ayrı işlememeli.
- [ ] Bilgisayar uyku/uyanma testinde alarmın bilgisayarı uyandırmadığı doğrulandı; alarmın gecikmesi raporlandı (çalışması garanti değildir).

## C. GitHub — yalnız sentetik test reposu

- [ ] Yalnız test repository'si için fine-grained PAT (Contents: Read and write) oluşturuldu; gerekirse özel depo seçildi.
- [ ] Repo erişim testi başarılı; test `README.md` kaynak alıntısı başka projeye sızmadı.
- [ ] Onaylı sonuç yalnız `embasic-agent/<task-id>` dalına, `agent-reports/<task-id>/<run-id>.md` yoluna yazıldı.
- [ ] `main` ve diğer mevcut dallar değişmedi; merge/PR/deploy yapılmadı.
- [ ] Aynı tur yeniden senkronize edilince ikinci commit oluşmadı.
- [ ] Public test deposunda açık tur onayı verilmeden rapor yüklenemedi.

## D. Google Drive — yalnız sentetik test hesabı

- [ ] Chrome Extension OAuth Client ID gerçek uzantı kimliğiyle eşleştirildi, `manifest.json` geçerli ve uzantı yeniden yüklendi.
- [ ] İzin ekranında mümkün olan en dar `drive.file` kapsamı doğrulandı.
- [ ] Drive `EMBASIC DeepSeek Agent` klasörü oluşturuldu; test proje klasöründe onaylı Markdown raporu var.
- [ ] Aynı tur manuel senkronize edildiğinde ikinci dosya oluşmadı.
- [ ] Uzakta bir sentetik raporun içeriği bilinçli değiştirilince yeniden deneme **blocked** oldu ve orijinal dosya üzerine yazılmadı.
- [ ] Erişim kesintisi ve OAuth 401 sonrası durum test edildi; kimlik doğrulama başarısızsa uygun hata görüldü.

## E. Tanılama/raporlama

- [ ] Eklentinin tanılama metninde sürüm, kasa durumu, GitHub ve Drive bağlantıları doğru.
- [ ] Chrome geliştirici araçlarında hata mesajları, uzantı kimliği, Windows/Chrome sürümü (ancak **token, parola, kullanıcı verisi değil**) rapora geçirildi.
- [ ] Gerçekten çalıştırılmayan kontrol **NOT_RUN** olarak kaydedildi. Her testi `PASS`/`FAIL`/`NOT_RUN` ile işaretle.
- [ ] Herhangi bir veri kaybında buluta veya public depoya yeniden deneme yapmadan önce yerel şifreli yedek doğrulandı.

## F. İsteğe bağlı geliştirici testleri

Windows'ta Node.js ve Python kuruluysa kaynak ZIP içinde:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\test-windows.ps1
```

Gerçek uzantı worker testi Linux konteynerde başarılı **değildir**; yalnız PC üzerinde doğrulanabilir. Windows testinin sonucu dışarıya token, parolalar veya gerçek belgeler olmadan paylaşılmalıdır.
