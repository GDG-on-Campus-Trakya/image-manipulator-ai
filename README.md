# AI Image Manipulator - GDG On Campus Trakya Üniversitesi Stant Haftası

Bu proje, GDG On Campus Türkiye'nin düzenlediği stant haftası etkinliği için geliştirilmiş interaktif bir web uygulamasıdır. Ziyaretçilerin, yükledikleri fotoğrafları yapay zeka (AI) kullanarak, metin komutları (prompt) ile dönüştürmelerini ve ortaya çıkan yeni görselleri anında QR kod ile telefonlarına indirmelerini sağlar. Production-ready değildir, bunun için üretilmemiştir!

Uygulama, stant ziyaretçilerine eğlenceli ve teknolojik bir deneyim sunmak amacıyla tasarlanmıştır.

## Temel Özellikler

- **Yapay Zeka ile Görüntü Dönüştürme:** [Replicate](https://replicate.com/) API'si kullanılarak Seedream 4 modeli yüklenen görselleri metin komutlarıyla yeniden işler.
- **Gerçek Zamanlı Bento Grid Galeri:** Yapay zeka tarafından oluşturulan tüm görseller, anlık olarak güncellenen, modern ve dinamik bir bento grid arayüzünde sergilenir.
- **Anında QR Kod ile İndirme:** Galerideki her bir görsele tıklandığında, kullanıcıların görseli kolayca telefonlarına indirebilmesi için ekranda bir QR kod belirir.
- **Firebase Entegrasyonu:** Tüm görseller ve oturum verileri, Firebase Storage ve Firestore üzerinde güvenli bir şekilde saklanır.

## Kullanılan Teknolojiler

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Dil:** [TypeScript](https://www.typescriptlang.org/)
- **Veritabanı ve Depolama:** [Firebase](https://firebase.google.com/) (Firestore & Cloud Storage)
- **Yapay Zeka:** [Replicate](https://replicate.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **QR Kod:** `qrcode.react`

## Kurulum ve Başlatma

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler

- [Node.js](https://nodejs.org/en/) (v18 veya üstü)
- [npm](https://www.npmjs.com/) veya [yarn](https://yarnpkg.com/)

### Adımlar

1.  **Depoyu klonlayın:**
    ```bash
    git clone https://github.com/your-username/image-manipulator-ai-stand-week.git
    cd image-manipulator-ai-stand-week
    ```

2.  **Bağımlılıkları yükleyin:**
    ```bash
    npm install
    ```

3.  **Ortam Değişkenlerini Ayarlayın:**
    Projenin kök dizininde `.env.local` adında bir dosya oluşturun ve aşağıdaki değişkenleri kendi Firebase ve Replicate API bilgilerinize göre doldurun.

    ```.env.local
    # Firebase Admin SDK Config (Server-side)
    FIREBASE_ADMIN_SDK_BASE64=your_base64_encoded_service_account_json

    # Replicate API Token
    REPLICATE_API_TOKEN=r8_your_replicate_api_token
    ```

4.  **Geliştirme Sunucusunu Başlatın:**
    ```bash
    npm run dev
    ```

    Tarayıcınızda `http://localhost:3000` adresini açarak uygulamayı görüntüleyebilirsiniz.

## Proje Yapısı

```
.
├── public/             # Statik dosyalar (ikonlar, fontlar)
├── src/
│   ├── app/            # Next.js App Router (sayfalar ve API rotaları)
│   │   ├── c/          # Collage sayfası
│   │   ├── d/          # Dashboard sayfası
│   │   ├── m/          # Mobile Upload sayfası
│   │   ├── api/        # API rotaları (download, replicate)
│   ├── components/     # React componentleri (BentoPhoto, PhotoCard)
│   ├── lib/            # Yardımcı modüller (Firebase, Replicate istemcileri)
│   └── types/          # TypeScript tip tanımlamaları
├── .env.local          # Ortam değişkenleri (gizli)
├── next.config.ts      # Next.js yapılandırması
└── package.json        # Proje bağımlılıkları ve scriptleri
```

---

*Bu proje, GDG On Campus Türkiye topluluğu için bir stant etkinliği kapsamında geliştirilmiştir.*