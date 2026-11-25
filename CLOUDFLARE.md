# نقل الموقع إلى Cloudflare Pages

الكود على فرع `cloudflare`. الموقع الحالي على Vercel (فرع `main`) ما بيتأثرش.

## إزاي بيشتغل
- كل صفحة بتتبني وقت النشر (`npm run build:cf`) بنفس كود السيرفر، فمفيش معالج مع الزيارات.
- الزوار بيشوفوا القوايم الحالية من الداتابيز مباشرة. صفحات محركات البحث (العنوان والبيانات والسايت ماب) بتتحدّث مع كل بناء.
- أي مشروع أو وحدة أو مقال جديد بيفتح فورًا (قالب بيتحمل من الداتابيز). مدينة أو مطور جديد بيتحوّل لصفحة المشاريع المفلترة، وتحديث «تابع مشروعك» الجديد بيظهر بعد البناء.
- الصور بتتصغّر مرة وقت البناء (`/_img/...`). أول بناء ممكن ما يلحقش كل الصور، والباقي يتكمّل في البناءات اللي بعدها.

## خطواتك

### 1. إنشاء المشروع
Cloudflare Dashboard (نفس الحساب اللي فيه R2) ← **Workers & Pages** ← **Create** ← **Pages** ← **Connect to Git** ← المستودع `Groz-AI/aqar-factory-property`.

| الإعداد | القيمة |
|---|---|
| Project name | `aqar-factory` |
| Production branch | `cloudflare` |
| Framework preset | None |
| Build command | `npm run build:cf` |
| Build output directory | `dist` |

### 2. المفاتيح (قبل أول بناء)
**Settings ← Variables and secrets**، وضيفها كلها نوع **Secret** في **Production** و**Preview**. القيم نفسها اللي في Vercel ← Settings ← Environment Variables:

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `GROQ_API_KEY` · `R2_ACCOUNT_ID` · `R2_BUCKET_NAME` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_PUBLIC_URL`

لو Vercel مش بيعرض قيمة، اعمل مفتاح R2 جديد من R2 ← **Manage API tokens**.

### 3. إعدادين
- **Settings ← Runtime ← Fail open**، علشان لو حد الطلبات اليومي خلص، الصفحات تفضل تفتح.
- **R2 ← الـbucket ← Settings ← CORS**: ضيف `https://aqar-factory.pages.dev` جنب الدومين الحالي، علشان رفع الصور من الأدمن يشتغل في التجربة.

### 4. التجربة
بعد ما البناء يخلص افتح `https://aqar-factory.pages.dev` وابعتلي، وأنا أفحصه (الرابط ده متعلّم `noindex` فمش هيأثر على جوجل).

### 5. إعادة البناء
**Settings ← Builds ← Add deploy hook** (فرع `cloudflare`). حط الرابط في GitHub ← Settings ← Secrets and variables ← Actions باسم `CF_DEPLOY_HOOK`.
الجدولة (كل 6 ساعات) بتشتغل بعد ما ندمج الفرع في `main`. قبل كده: زرار **Retry deployment** في Cloudflare.

### 6. تحويل الدومين (بعد التجربة بس)
1. Pages ← المشروع ← **Custom domains** ← `www.aqar-factory.com`.
2. في GoDaddy عدّل سجل `www` (CNAME) لـ `aqar-factory.pages.dev`.
3. الدومين من غير `www`: في GoDaddy اعمل **Forwarding** دائم (301) لـ `https://www.aqar-factory.com`.

**الرجوع لـVercel لو حصلت مشكلة:** رجّع سجل `www` لـ `1f645bbde755eb61.vercel-dns-017.com`.

### 7. بعد كام يوم
ندمج `cloudflare` في `main`، ونخلّي Production branch = `main`، ونفصل ربط Git في Vercel علشان ما ينشرش تاني.

## حدود الخطة المجانية
- 500 بناء في الشهر، و20 دقيقة للبناء، و20,000 ملف.
- الملفات الثابتة من غير حد. صفحات الموقع بتعدّي على الدالة الموجِّهة: 100,000 طلب في اليوم، و10 مللي ثانية معالج للطلب.

## للمطورين
```bash
IMAGES=0 PAGES=10 npm run build:cf    # بناء تجريبي سريع
npx wrangler pages dev dist           # تشغيل محلي بالدوال
```
