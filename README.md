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
