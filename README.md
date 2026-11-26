# By Erdoğan Gelinlik

Next.js 16 / React 19 / TypeScript. Vercel üzerinde çalışan ziyaretçi deneyimi.

## Kurulum

`npm ci`, ardından `npm run dev`. Vercel ziyaretçi sürümü için erişim anahtarı gerekmez.
Doğrulama: `npm test`, `npm run typecheck`, `npm run build`.

## Altyapı

Mevcut Cloudflare Worker + D1 + R2, veri ve yönetim servisi olarak korunur.
`sites-backend/`, yayımdaki kaynak kodun 8865304 sürümünün kopyasıdır.
Vercel, yalnızca izin verilen müşteri API işlemlerini sunucu üzerinden bu servise iletir.
Mevcut Sites yayını, sahibinin talebiyle herkese açıktır. Yalnızca halka açık müşteri API uçlarına bağlanılır; hiçbir erişim anahtarı taşınmaz.
Yönetim girişi mevcut Sites adresine yönlenir ve orada ChatGPT hesabıyla korunur.
Yeni bir veritabanı veya bağımsız Vercel yönetici hesabı oluşturulmamıştır.
Sites servisi erişilebilir ve herkese açık kalmalıdır. Yönetici API uçları Vercel üzerinden sunulmaz.

## Sanal deneme ve randevu

Ücretsiz deneysel prova tarayıcıdan Hugging Face FASHN VTON demosunu kullanır.
Gerçek API sonucu beklenir; sahte sonuç üretilmez. Sağlayıcı kotası, kuyruğu ve saklama koşulları geçerlidir.
Fotoğraf aktarımı ayrı kullanıcı izni gerektirir. Demo dosyalarını sağlayıcı saklar.
İşletmeye özel fal/WhatsApp kimlik bilgileri mevcut serviste tanımlanır.
Çevrim içi takvim işletme unvanı, başvuru e-postası ve gerçek müsaitlikler girilerek yönetimden açılır.
Bu bilgiler tanımlı değilken randevu sayfası WhatsApp üzerinden talep oluşturmaya yönlendirir.

## Git / yayın

Vercel projesi: `by-erdogan-gelinlik`. Proje kökü bu dizindir.
`sites-backend` Vercel build'ine katılmaz. Mevcut Sites yayını ayrıca yönetilir.
`npm run build` standart Next.js üretim çıktısı oluşturur.
Depoya anahtar, müşteri kaydı veya yüklenmiş kullanıcı fotoğrafı eklemeyin.

## Cloudflare'e taşıma (kendi hesabınız, sabit ücret yok)

Uygulama artık API'yi kendi içinde çalıştırır: D1 veritabanı, R2 görsel deposu ve işletmeye özel yönetici girişi.
Vercel'de (`VERCEL` ortam değişkeni varken) eski ChatGPT Sites köprüsü taşıma bitene kadar çalışmaya devam eder.

Yerel geliştirme:

1. `npm ci`
2. `.dev.vars.example` dosyasını `.dev.vars` olarak kopyalayın; `npm run admin:hash` ile şifre özeti üretin.
3. `npm run db:migrate:local`, ardından `npm run dev`.
4. `node scripts/smoke-local.mjs` giriş, randevu, çakışma, tekrar gönderim ve yeniden planlama akışını uçtan uca dener.
   Test, yerel veritabanında deneme sınırlarını doldurur. Art arda çalıştırmadan önce: `npx wrangler d1 execute DB --local --command "DELETE FROM limits; DELETE FROM docs WHERE id='auth'"`
   Gerçek Worker ortamında denemek için: `npx opennextjs-cloudflare build`, `npx wrangler dev --port 8787`, sonra `node scripts/smoke-local.mjs http://localhost:8787`.

İlk yayın (Cloudflare hesabı açıldıktan sonra):

1. `npx wrangler login`
2. `npx wrangler d1 create by-erdogan-gelinlik` ve çıkan `database_id` değerini `wrangler.jsonc` içine yazın.
3. `npx wrangler r2 bucket create by-erdogan-gelinlik-media`
4. `npm run db:migrate:remote`
5. `npx wrangler secret put ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`
   Randevu e-posta bildirimi için (isteğe bağlı, ücretsiz Resend hesabı): `RESEND_API_KEY`, `NOTIFY_EMAIL`, alan adı doğrulandıktan sonra `NOTIFY_FROM`.
6. `npm run deploy`, ardından Cloudflare panelinden alan adını Worker'a bağlayın.

Mevcut ChatGPT Sites verisi: şu an yalnızca örnek (konsept) katalog var; gerçek randevu kaydı ve yüklenmiş görsel olmadığı doğrulanırsa veri aktarımı gerekmez.
