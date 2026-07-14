/* ============================================================
   REALTEEK — i18n (English / Arabic + RTL)
   ------------------------------------------------------------
   Static text: mark elements with data-i18n (plain text content),
   data-i18n-html="key" (content containing nested markup, looked
   up by an explicit key), data-i18n-placeholder / data-i18n-aria /
   data-i18n-title (attribute translation). The dictionary is keyed
   by the exact trimmed English source string (or, for -html, by
   the explicit key), so most elements need no key of their own.

   Dynamic JS-rendered strings: call t('English string') from any
   script loaded after this one; window.t is a shorthand alias.

   Switching language persists the choice and reloads the page —
   this keeps every dynamically-rendered section (search facets,
   admin tables, AI widget, project cards, etc.) trivially correct
   without needing a live re-render hook for each one.
   ============================================================ */
(function () {
  'use strict';
  const STORAGE_KEY = 'realteek_lang';

  // ---------- dictionary: English source -> Arabic ----------
  const AR = {
    // ---------- global nav / header ----------
    'Home': 'الرئيسية',
    'Projects': 'المشاريع',
    'About Us': 'من نحن',
    'Contact': 'تواصل معنا',
    'Open menu': 'فتح القائمة',
    'Realteek home': 'الصفحة الرئيسية لـ Realteek',
    'Realteek': 'Realteek',

    // ---------- home hero ----------
    'Curated Homes For Sale.': 'منازل مختارة بعناية للبيع.',
    "This site is powered by AI — tell us what you need, we'll find your perfect match.": 'هذا الموقع مدعوم بالذكاء الاصطناعي — أخبرنا بما تحتاجه وسنجد لك الخيار الأنسب.',
    'All locations': 'كل المواقع',
    'All project types': 'كل أنواع المشاريع',
    'Find Projects': 'ابحث عن مشاريع',

    // ---------- home: cities ----------
    "Where you'll live": 'أين ستعيش',
    '1 Project': 'مشروع واحد',
    'Projects': 'مشاريع',
    'View projects in': 'عرض المشاريع في',
    'Projects in this city': 'المشاريع في هذه المدينة',
    'No projects linked to this city yet.': 'لا توجد مشاريع مرتبطة بهذه المدينة بعد.',
    "From skyline penthouses to beachfront estates — browse our most sought-after destinations and the homes waiting there.": 'من البنتهاوس المطل على الأفق إلى العقارات الساحلية — تصفح أكثر الوجهات طلبًا والمنازل التي تنتظرك هناك.',

    // ---------- home: journey/stats ----------
    'With a proven track record and in-depth market knowledge, we\'re here to make your real estate journey smooth and stress-free. Whether buying, selling, or investing, you can count on our team to deliver results with integrity.': 'بخبرة مثبتة ومعرفة عميقة بالسوق، نحن هنا لنجعل رحلتك العقارية سلسة وخالية من التوتر. سواء كنت تشتري أو تبيع أو تستثمر، يمكنك الاعتماد على فريقنا لتحقيق نتائج بنزاهة تامة.',
    'Total properties sold, helping families find their dream homes for over a decade.': 'إجمالي العقارات المباعة، حيث نساعد العائلات على إيجاد منازل أحلامها منذ أكثر من عقد.',
    'Strong partnerships with local businesses to enhance and extend our services.': 'شراكات قوية مع الشركات المحلية لتعزيز خدماتنا وتوسيع نطاقها.',
    'Client satisfaction rate, reflecting our commitment to exceptional service.': 'معدل رضا العملاء، مما يعكس التزامنا بتقديم خدمة استثنائية.',

    // ---------- home: recent projects ----------
    'Freshly delivered': 'تم تسليمها حديثًا',
    "A look at the developments we've recently brought to life — each one designed, built and finished to an uncompromising standard.": 'نظرة على المشاريع التي أنجزناها مؤخرًا — كل منها مصمم ومبني ومجهز وفق أعلى المعايير دون تنازل.',
    'View all projects': 'عرض جميع المشاريع',

    // ---------- home: developers ----------
    'Trusted partners': 'شركاء موثوقون',
    "We list and sell on behalf of the region's most respected developers. These are a few of the names that put their flagship projects in our hands.": 'نعرض ونبيع نيابة عن أبرز المطورين الموثوقين في المنطقة. هذه بعض الأسماء التي وثقت بنا في تسويق مشاريعها الرائدة.',

    // ---------- home: testimonials ----------
    'Previous reviews': 'التقييمات السابقة',
    'Next reviews': 'التقييمات التالية',

    // ---------- home: CTA ----------
    'Partner with us to create stunning, innovative spaces that match your vision. Let\'s build something extraordinary together.': 'تعاون معنا لإنشاء مساحات مبتكرة وآسرة تتناسب مع رؤيتك. لنبنِ معًا شيئًا استثنائيًا.',
    'Get Started': 'ابدأ الآن',
    'Get in touch': 'تواصل معنا',

    // ---------- footer ----------
    "Real estate done right — handpicked homes, offices and luxury units across the world's great cities.": 'العقارات كما ينبغي — منازل ومكاتب ووحدات فاخرة مختارة بعناية في أعظم مدن العالم.',
    'Instagram': 'إنستغرام', 'X': 'إكس', 'LinkedIn': 'لينكدإن',
    'Explore': 'استكشف',
    'Cities': 'المدن',
    'Company': 'الشركة',
    'Partners': 'الشركاء',
    'Login': 'تسجيل الدخول',
    'Stay in the loop': 'ابقَ على اطلاع',
    'New listings, market notes and quiet off-market deals — once a month.': 'أحدث المشاريع، ملاحظات السوق، وصفقات حصرية — مرة كل شهر.',
    'Your email': 'بريدك الإلكتروني',
    'Join': 'اشترك',
    '© 2026 Realteek. All rights reserved.': '© 2026 Realteek. جميع الحقوق محفوظة.',
    'Privacy · Terms · Cookies': 'الخصوصية · الشروط · ملفات تعريف الارتباط',

    // ---------- projects listing page ----------
    "Developments across the world's great cities": 'مشاريع في أعظم مدن العالم',
    "From skyline residences to grade-A offices and beachfront villas — explore the developments we've delivered and the ones taking shape now. Filter by category or city to find yours.": 'من الوحدات السكنية المطلة على الأفق إلى المكاتب الفاخرة والفلل الساحلية — استكشف المشاريع التي أنجزناها والأخرى قيد التنفيذ. صفِّ حسب الفئة أو المدينة لتجد مشروعك.',
    'Search by name, city or location…': 'ابحث بالاسم أو المدينة أو الموقع…',
    'Search projects': 'ابحث في المشاريع',
    'Clear search': 'مسح البحث',
    'Sort projects': 'ترتيب المشاريع',
    'Featured': 'مميز',
    'Price: High to Low': 'السعر: من الأعلى إلى الأقل',
    'Price: Low to High': 'السعر: من الأقل إلى الأعلى',
    'Area: Largest': 'المساحة: الأكبر',
    'Area: Smallest': 'المساحة: الأصغر',
    'Newest first': 'الأحدث أولاً',
    'Name: A–Z': 'الاسم: أ–ي',
    'Category': 'الفئة',
    'All': 'الكل',
    'All cities': 'كل المدن',
    'projects': 'مشاريع',
    'Reset': 'إعادة تعيين',
    'No projects match those filters': 'لا توجد مشاريع مطابقة لهذه الفلاتر',
    'Try a different search, category or city.': 'جرّب بحثًا أو فئة أو مدينة مختلفة.',
    'Clear filters': 'مسح الفلاتر',

    // ---------- project detail page ----------
    'About this development': 'عن هذا المشروع',
    'Amenities': 'المرافق',
    'Gallery': 'معرض الصور',
    'Starting from': 'يبدأ من',
    'Request details': 'اطلب التفاصيل',
    'Book a viewing': 'احجز موعد معاينة',
    'Download brochure (PDF)': 'تحميل الكتيب (PDF)',
    'Developed by': 'طوّره',
    'Executive Consultants': 'المستشارون التنفيذيون',
    'More Projects': 'مزيد من المشاريع',
    'Close': 'إغلاق', 'Previous': 'السابق', 'Next': 'التالي',
    'Status': 'الحالة', 'Handover': 'التسليم', 'Units': 'الوحدات', 'Floors': 'الطوابق',
    'Unit size': 'مساحة الوحدة', 'City': 'المدينة', 'Location': 'الموقع',

    // ---------- about page ----------
    'Est. 2014 · A boutique real-estate house': 'تأسست عام 2014 · بيت عقاري متخصص',
    'Real estate, done': 'العقارات، كما ينبغي',
    'with intention': 'بوعي وهدف',
    "We're a small team with a long memory and high standards — curating homes, offices and luxury spaces for people who refuse to settle.": 'نحن فريق صغير بذاكرة طويلة ومعايير عالية — نختار المنازل والمكاتب والمساحات الفاخرة لمن يرفضون التنازل.',
    'Who we are': 'من نحن',
    'A handpicked approach to a': 'نهج مختار بعناية في',
    'noisy market': 'سوق صاخب',
    "Realteek began with a simple frustration: great properties were being sold like commodities. We set out to do the opposite — to treat every listing as a story, every client as a long-term relationship, and every transaction as something worth getting right.": 'بدأت Realteek من إحباط بسيط: كانت العقارات المميزة تُباع وكأنها سلع. فقررنا فعل العكس — أن نتعامل مع كل عقار كقصة، وكل عميل كعلاقة طويلة الأمد، وكل صفقة كأمر يستحق أن يُنجز بإتقان.',
    "Today we operate across the world's most dynamic cities, partnering with the developers and owners we believe in, and quietly turning down the ones we don't. The result is a smaller, sharper portfolio — and clients who come back.": 'اليوم نعمل في أكثر مدن العالم حيوية، بشراكة مع المطورين والملّاك الذين نثق بهم، ونعتذر بهدوء عن التعامل مع من لا نثق بهم. والنتيجة محفظة أصغر وأكثر تميزًا — وعملاء يعودون إلينا دائمًا.',
    'Talk to our team': 'تحدث مع فريقنا',
    'yrs': 'سنة',
    'curating spaces people are proud to call their own': 'نختار مساحات يفخر أصحابها بامتلاكها',
    'Properties placed': 'عقارات تم تسويقها',
    'Cities worldwide': 'مدينة حول العالم',
    'Developer partners': 'شريك تطوير',
    'Client satisfaction': 'رضا العملاء',
    'What we stand for': 'ما نؤمن به',
    "Principles we": 'مبادئ',
    "don't bend": 'لا نساوم عليها',
    'Integrity first': 'النزاهة أولاً',
    "We tell you what we'd tell our own family — including when a deal isn't right. Trust compounds.": 'نخبرك بما كنا سنخبر به عائلتنا — حتى عندما لا تكون الصفقة مناسبة. الثقة تُبنى مع الوقت.',
    'Ruthless curation': 'انتقاء صارم',
    'A short, considered list beats an endless feed. Every property earns its place with us.': 'قائمة قصيرة ومدروسة أفضل من عرض لا ينتهي. كل عقار يكسب مكانه معنا باستحقاق.',
    'Local expertise': 'خبرة محلية',
    'Boots on the ground in every market. We know the streets, the schools and the off-market whispers.': 'حضور ميداني في كل سوق. نعرف الشوارع والمدارس والفرص غير المعلنة.',
    'Client for life': 'عميل مدى الحياة',
    'The keys are the start, not the finish. We stay in your corner long after the sale closes.': 'استلام المفاتيح هو البداية لا النهاية. نبقى إلى جانبك بعد إتمام الصفقة بوقت طويل.',
    'The road so far': 'المسيرة حتى الآن',
    'Milestones that': 'محطات',
    'shaped us': 'شكّلت مسيرتنا',
    "From a single desk to a global boutique — a brief history of the moments that defined how we work.": 'من مكتب واحد إلى بيت عقاري عالمي — نبذة عن اللحظات التي شكّلت أسلوب عملنا.',
    'The first desk': 'المكتب الأول',
    'Founded with one principle: sell fewer homes, better. Our first listing sold in eleven days.': 'تأسسنا على مبدأ واحد: بيع عقارات أقل، بجودة أعلى. بيع أول عقار لنا خلال أحد عشر يومًا.',
    'Crossing borders': 'عبور الحدود',
    'Opened our second market and began representing developers beyond our home city.': 'افتتحنا سوقنا الثاني وبدأنا تمثيل مطورين خارج مدينتنا الأم.',
    'Digital-first': 'الرقمنة أولاً',
    'Launched immersive virtual tours and an online portfolio that now powers every search.': 'أطلقنا جولات افتراضية غامرة ومحفظة إلكترونية تدعم كل عملية بحث اليوم.',
    'The boutique network': 'شبكة متخصصة',
    'Reached 30+ developer partners across 32 cities while staying deliberately small.': 'وصلنا إلى أكثر من 30 شريك تطوير في 32 مدينة مع الحفاظ على حجمنا الصغير عن قصد.',
    'Today': 'اليوم',
    'Still curating': 'ما زلنا نختار بعناية',
    '1,500+ families housed, a 98% satisfaction rate, and the same standards we started with.': 'أكثر من 1,500 عائلة استقرت في منازلها، ومعدل رضا 98%، وبنفس المعايير التي بدأنا بها.',
    'The people': 'الفريق',
    'Faces behind the': 'الوجوه خلف',
    'front door': 'الباب الأمامي',
    'A compact team of advisors, analysts and storytellers — each obsessive about a different part of your move.': 'فريق مُصغّر من المستشارين والمحللين ورواة القصص — كل منهم شغوف بجانب مختلف من رحلة انتقالك.',
    'Founder & Principal': 'المؤسِّسة والمديرة التنفيذية',
    'Head of Acquisitions': 'رئيس قسم الاستحواذ',
    'Client Director': 'مديرة علاقات العملاء',
    'Market Analyst': 'محلل السوق',
    "Let's find your": 'دعنا نجد',
    'next address': 'عنوانك القادم',
    "Whether you're buying, selling or simply curious about the market, our team is ready when you are.": 'سواء كنت تشتري أو تبيع أو تستكشف السوق فقط، فريقنا جاهز عندما تكون مستعدًا.',

    // ---------- contact page ----------
    'We reply within one business day': 'نرد خلال يوم عمل واحد',
    "Let's start a": 'لنبدأ',
    'conversation': 'حديثًا',
    "Book a viewing, ask about a listing, or just tell us what you're looking for — a real advisor will get back to you, not a bot.": 'احجز معاينة، اسأل عن مشروع، أو أخبرنا فقط بما تبحث عنه — سيتواصل معك مستشار حقيقي، لا روبوت آلي.',
    'Reach us directly': 'تواصل معنا مباشرة',
    'Prefer to skip': 'تفضل تخطي',
    'the form?': 'النموذج؟',
    "Our advisors are reachable however suits you best. We're happiest on a call, but we read every message.": 'مستشارونا متاحون بالطريقة التي تناسبك أكثر. نفضّل المكالمات، لكننا نقرأ كل رسالة تصلنا.',
    'Visit the studio': 'زُر مكتبنا',
    'Call or WhatsApp': 'اتصل أو راسلنا عبر واتساب',
    'Sun–Thu, 9:00 – 18:00 GST': 'الأحد–الخميس، 9:00 صباحًا – 6:00 مساءً بتوقيت الخليج',
    'Email us': 'راسلنا عبر البريد الإلكتروني',
    'Office hours': 'ساعات العمل',
    'Prefer talking right now?': 'تفضل التحدث الآن؟',
    'Call us now': 'اتصل بنا الآن',
    'Speak to an advisor directly': 'تحدث مباشرة مع مستشار',
    'WhatsApp us': 'راسلنا عبر واتساب',
    'Usually replies in minutes': 'عادة ما يتم الرد خلال دقائق',
    'or send us a message': 'أو أرسل لنا رسالة',
    'Send us a message': 'أرسل لنا رسالة',
    'First name': 'الاسم الأول',
    'Last name': 'اسم العائلة',
    'Email': 'البريد الإلكتروني',
    'Phone': 'الهاتف',
    '(optional)': '(اختياري)',
    "I'm interested in": 'مهتم بـ',
    'Buying a property': 'شراء عقار',
    'Investment advice': 'استشارة استثمارية',
    'Press & partnerships': 'الإعلام والشراكات',
    'Something else': 'أمر آخر',
    'Budget range': 'النطاق السعري',
    'Message': 'الرسالة',
    'Tell us about the home, office or space you have in mind…': 'أخبرنا عن المنزل أو المكتب أو المساحة التي تفكر بها…',
    'I agree to be contacted about my enquiry and have read the privacy policy.': 'أوافق على التواصل معي بخصوص استفساري، وأنني قرأت سياسة الخصوصية.',
    'Send message': 'إرسال الرسالة',
    "Thanks — your message is on its way. We'll be in touch within one business day.": 'شكرًا — رسالتك في طريقها إلينا. سنتواصل معك خلال يوم عمل واحد.',
    "Sorry, we couldn't send your message just now. Please try again, or email us directly.": 'عذرًا، تعذر إرسال رسالتك الآن. يرجى المحاولة مرة أخرى أو مراسلتنا مباشرة عبر البريد الإلكتروني.',
    'Sending…': 'جارٍ الإرسال…',
    'Sent ✓': 'تم الإرسال ✓',

    // ---------- AI widget ----------
    'Let AI Choose For You': 'دع الذكاء الاصطناعي يختار لك',
    'Let AI choose for you': 'دع الذكاء الاصطناعي يختار لك',
    'Realteek AI project matchmaker': 'مساعد الذكاء الاصطناعي لاختيار المشاريع في Realteek',
    'Realteek AI': 'الذكاء الاصطناعي لـ Realteek',
    'Your project matchmaker': 'مساعدك في اختيار المشروع المناسب',
    'Or just ask me anything…': 'أو اسألني أي شيء…',
    'Send': 'إرسال',
    "Hi! I'm Realteek AI — answer a few quick questions and I'll match you with the best-fit projects, or just type your own question below anytime.": 'مرحبًا! أنا الذكاء الاصطناعي لـ Realteek — أجب عن بضعة أسئلة سريعة وسأقترح عليك أنسب المشاريع، أو اكتب سؤالك الخاص أدناه في أي وقت.',
    'What type of project are you looking for?': 'ما نوع المشروع الذي تبحث عنه؟',
    'Any type': 'أي نوع',
    'Got it. Any particular unit type — villas, apartments, duplex…?': 'تمام. هل تفضل نوع وحدة معين — فلل، شقق، دوبلكس…؟',
    'Any unit type': 'أي نوع وحدة',
    'Nice choice. Any particular location in mind?': 'اختيار جميل. هل لديك موقع معين في ذهنك؟',
    'Anywhere': 'أي مكان',
    "Got it. What's your budget range?": 'تمام. ما هو نطاقك السعري؟',
    'Let me find your best matches…': 'دعني أجد لك أفضل الخيارات المناسبة…',
    "Here's what I found for you ✨": 'إليك ما وجدته لك ✨',
    "I don't have an exact match for that combination, but here are some projects you might love:": 'لا يوجد لدي تطابق دقيق لهذا المزيج، لكن إليك بعض المشاريع التي قد تعجبك:',
    'No projects are published yet — check back soon!': 'لا توجد مشاريع منشورة بعد — تحقق مرة أخرى قريبًا!',
    'Start over': 'ابدأ من جديد',
    'Talk to an advisor': 'تحدث مع مستشار',
    "Sorry, I'm having trouble connecting right now. Please try again shortly.": 'عذرًا، أواجه مشكلة في الاتصال حاليًا. يرجى المحاولة مرة أخرى خلال قليل.',
    "Hi! I'm Realteek AI — what can I help you find?": 'مرحبًا! أنا الذكاء الاصطناعي لـ Realteek — بماذا يمكنني مساعدتك؟',

    // ---------- data-i18n-html keys (mixed markup) ----------
    'cities.heading': 'استكشف العقارات <em>حسب المدن</em>',
    'devs.heading': 'مطورون <em>يثقون بنا</em>',
    'recent.heading': 'أحدث <em>المشاريع</em>',
    'testi.heading': 'آراء عملائنا<br/><em>الرائعون والراضون</em>',
    'about.heading1': 'نهج مختار بعناية في <em>سوق صاخب</em>',
    'about.heading2': 'مبادئ <em>لا نساوم عليها</em>',
    'about.heading3': 'محطات <em>شكّلت مسيرتنا</em>',
    'about.heading4': 'الوجوه خلف <em>الباب الأمامي</em>',
    'about.hero.title': 'العقارات، كما ينبغي<br/>بوعي <em>وهدف</em>',
    'about.cta.title': 'دعنا نجد<br/>عنوانك <em>القادم</em>',
    'contact.hero.title': 'لنبدأ <em>حديثًا</em>',
    'contact.form.title': 'تفضل تخطي<br/>النموذج<em>؟</em>',
    'projects.hero.title': '<em>مشاريعنا</em>',
    'project.more': 'المزيد من <em>المشاريع</em>',

    // ---------- language switch ----------
    'العربية': 'العربية',
    'English': 'English',

    // ---------- admin: sidebar / topbar ----------
    'Overview': 'نظرة عامة',
    'Dashboard': 'لوحة التحكم',
    'Content': 'المحتوى',
    'Cities': 'المدن',
    'Testimonials': 'آراء العملاء',
    'Developers': 'المطورون',
    'Leads': 'العملاء المحتملون',
    'Inquiries': 'الاستفسارات',
    'Newsletter': 'النشرة البريدية',
    'Site': 'الموقع',
    'Site content': 'محتوى الموقع',
    'Account & settings': 'الحساب والإعدادات',
    'Sign out': 'تسجيل الخروج',
    'Admin': 'المسؤول',
    'Add': 'إضافة',
    'An overview of your content': 'نظرة عامة على محتوى موقعك',
    'Edit': 'تعديل',
    'Delete': 'حذف',
    'Published': 'منشور',
    'Hidden': 'مخفي',
    'Cancel': 'إلغاء',
    'Save': 'حفظ',
    'Quick actions': 'إجراءات سريعة',
    'Manage projects': 'إدارة المشاريع',
    'Edit site content': 'تعديل محتوى الموقع',
    'Setup & seed data': 'الإعداد وبيانات البدء',
    'Manage your': 'إدارة',
    'Search': 'بحث في',
    'Couldn’t load:': 'تعذّر التحميل:',
    'No': 'لا توجد',
    'yet. Click': 'بعد. اضغط',
    'to create one.': 'لإنشاء واحدة.',
    'New': 'جديد',
    'Remove': 'إزالة',
    'Company / Brand': 'الشركة / العلامة التجارية',
    'Company name': 'اسم الشركة',
    'Logo': 'الشعار',
    'shown in the header & footer — leave empty to use the default mark': 'يظهر في الترويسة والتذييل — اتركه فارغًا لاستخدام الشعار الافتراضي',
    'Footer tagline': 'شعار التذييل',
    'Primary email': 'البريد الإلكتروني الأساسي',
    'Secondary email': 'البريد الإلكتروني الثانوي',
    'Primary phone': 'الهاتف الأساسي',
    'Secondary phone / WhatsApp': 'الهاتف الثانوي / واتساب',
    'Address / HQ (one line per row)': 'العنوان / المقر الرئيسي (سطر لكل صف)',
    'Office hours (one line per row)': 'ساعات العمل (سطر لكل صف)',
    'Instagram URL': 'رابط إنستغرام',
    'X (Twitter) URL': 'رابط إكس (تويتر)',
    'LinkedIn URL': 'رابط لينكدإن',
    'Facebook URL': 'رابط فيسبوك',
    'Copyright line': 'سطر حقوق النشر',
    'Add office': 'إضافة مكتب',
    'Office name / city': 'اسم المكتب / المدينة',
    'Address (one line per row)': 'العنوان (سطر لكل صف)',
    'Hero': 'القسم الرئيسي',
    'Eyebrow': 'النص العلوي',
    'Eyebrow (Arabic)': 'النص العلوي (عربي)',
    'Title line 1': 'السطر الأول من العنوان',
    'Title line 1 (Arabic)': 'السطر الأول من العنوان (عربي)',
    'Title line 2': 'السطر الثاني من العنوان',
    'Title line 2 (Arabic)': 'السطر الثاني من العنوان (عربي)',
    'Subtext': 'النص الفرعي',
    'Subtext (Arabic)': 'النص الفرعي (عربي)',
    'Hero background images (slideshow)': 'صور خلفية القسم الرئيسي (عرض شرائح)',
    'shown behind the hero — cross-fades every few seconds': 'تظهر خلف القسم الرئيسي — تتلاشى وتتبدل كل بضع ثوانٍ',
    'Journey / Stats': 'الرحلة / الإحصائيات',
    'Lead paragraph': 'الفقرة التمهيدية',
    'Lead paragraph (Arabic)': 'الفقرة التمهيدية (عربي)',
    'Value': 'القيمة',
    'Suffix': 'اللاحقة',
    'Label': 'التسمية',
    'Label (Arabic)': 'التسمية (عربي)',
    'Call to action': 'دعوة لاتخاذ إجراء',
    'Text': 'النص',
    'Text (Arabic)': 'النص (عربي)',
    'Shown when the site is set to Arabic — leave empty to fall back to the English text above.': 'يظهر عندما يكون الموقع بالعربية — اتركه فارغًا لعرض النص الإنجليزي أعلاه بدلاً منه.',
    'Button label': 'نص الزر',
    'Button label (Arabic)': 'نص الزر (عربي)',
    'Edit hero, stats and call-to-action copy': 'تعديل نصوص القسم الرئيسي والإحصائيات ودعوة اتخاذ إجراء',
    'offices': 'المكاتب',
    'items': 'العناصر',
    'Add row': 'إضافة صف',
    'Setup': 'الإعداد',
    'Local demo mode — everything saves in this browser': 'وضع تجريبي محلي — كل شيء يُحفظ في هذا المتصفح',
    'Connection status and starter data': 'حالة الاتصال وبيانات البدء',
    'Mode': 'الوضع',
    'Backend:': 'الخادم:',
    'Local (this browser)': 'محلي (هذا المتصفح)',
    "All content you create here is saved in this browser's storage and shown live on the public site. Uploaded images are stored inline (resized), so keep them reasonably sized. To publish to the cloud and share across devices, add your Supabase keys in": 'كل المحتوى الذي تنشئه هنا يُحفظ في تخزين هذا المتصفح ويظهر مباشرة على الموقع العام. الصور المرفوعة تُخزَّن مضمنة (بعد تصغيرها)، لذا احرص أن تبقى بحجم معقول. لنشر المحتوى على السحابة ومشاركته بين الأجهزة، أضف مفاتيح Supabase في',
    'and run': 'وشغّل',
    'Admin login — email & password': 'دخول المسؤول — البريد الإلكتروني وكلمة المرور',
    'Save changes': 'حفظ التغييرات',
    "Takes effect immediately — you'll use these the next time you sign in.": 'يسري فورًا — ستستخدم هذه البيانات في المرة القادمة لتسجيل الدخول.',
    'Danger zone': 'منطقة الخطر',
    "Reset all content back to the bundled demo data. This wipes every change you've made in this browser.": 'إعادة تعيين كل المحتوى إلى البيانات التجريبية المرفقة. هذا يمسح كل تغيير أجريته في هذا المتصفح.',
    'Reset demo data': 'إعادة تعيين البيانات التجريبية',
    'Email and password are required': 'البريد الإلكتروني وكلمة المرور مطلوبان',
    'Login updated': 'تم تحديث بيانات الدخول',
    'Reset all content to the demo data? This cannot be undone.': 'إعادة تعيين كل المحتوى إلى البيانات التجريبية؟ لا يمكن التراجع عن هذا.',
    'Demo data restored': 'تمت استعادة البيانات التجريبية',
    'Connection': 'الاتصال',
    'Connected': 'متصل',
    'Not configured': 'غير مُهيَّأ',
    'Project URL:': 'رابط المشروع:',
    'Account — email & password': 'الحساب — البريد الإلكتروني وكلمة المرور',
    'Update email': 'تحديث البريد الإلكتروني',
    'Changing your email sends a confirmation link to the new address.': 'تغيير بريدك الإلكتروني يرسل رابط تأكيد إلى العنوان الجديد.',
    'New password': 'كلمة المرور الجديدة',
    'At least 6 characters': 'ستة أحرف على الأقل',
    'Update password': 'تحديث كلمة المرور',
    'Starter data': 'بيانات البدء',
    'Seed your database with the site’s bundled demo content — projects, listings, cities, testimonials, developers and copy. Tables that already contain rows are skipped, so this is safe to run once.': 'تعبئة قاعدة بياناتك بالمحتوى التجريبي المرفق مع الموقع — المشاريع والمدن وآراء العملاء والمطورون والنصوص. الجداول التي تحتوي بيانات بالفعل يتم تخطيها، لذا يمكن تشغيل هذا بأمان مرة واحدة.',
    'Import starter data': 'استيراد بيانات البدء',
    'Currency': 'العملة',
    'Some project/listing prices were saved with a "$" before EGP became the site\'s only currency. This rewrites any price still starting with "$" to start with "EGP" instead, leaving the rest of the value untouched. Safe to run more than once — already-converted prices are left alone.': 'تم حفظ بعض أسعار المشاريع بعلامة "$" قبل أن تصبح الجنيه المصري (EGP) العملة الوحيدة للموقع. هذا يعيد كتابة أي سعر ما زال يبدأ بـ "$" ليبدأ بـ "EGP" بدلًا منه، مع ترك باقي القيمة كما هي. آمن للتشغيل أكثر من مرة — الأسعار المحوَّلة مسبقًا تُترك دون تغيير.',
    'Convert existing prices to EGP': 'تحويل الأسعار الحالية إلى الجنيه المصري',
    'Email is required': 'البريد الإلكتروني مطلوب',
    'Confirmation email sent to the new address': 'تم إرسال رسالة تأكيد إلى العنوان الجديد',
    'Password must be at least 6 characters': 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل',
    'Password updated': 'تم تحديث كلمة المرور',
    'Importing…': 'جارٍ الاستيراد…',
    'Done. Reloading counts…': 'تم. جارٍ تحديث الأعداد…',
    'Starter data imported': 'تم استيراد بيانات البدء',
    'Error:': 'خطأ:',
    'Import failed': 'فشل الاستيراد',
    'Converting…': 'جارٍ التحويل…',
    'nothing to convert': 'لا شيء لتحويله',
    'price(s) converted': 'سعر تم تحويله',
    'failed': 'فشل',
    'Done.': 'تم.',
    'Prices converted to EGP': 'تم تحويل الأسعار إلى الجنيه المصري',
    'Conversion failed': 'فشل التحويل',
    'city links:': 'روابط المدن:',
    'project(s)': 'مشروع',
    'nothing to seed': 'لا شيء لإضافته',
    'rows exist, skipped': 'صف موجود بالفعل، تم التخطي',
    'rows': 'صفوف',
    'rows already exist, skipped': 'صفوف موجودة بالفعل، تم التخطي',
    'new row(s)': 'صف جديد',
    'already existed, skipped': 'كان موجودًا بالفعل، تم التخطي',
    'Messages submitted through your contact form': 'الرسائل المُرسلة عبر نموذج التواصل',
    'Couldn’t load inquiries:': 'تعذّر تحميل الاستفسارات:',
    'If you haven’t yet, run the inquiries section of': 'إن لم تفعل ذلك بعد، شغّل قسم الاستفسارات من',
    'in your Supabase SQL editor.': 'في محرر SQL الخاص بـ Supabase.',
    'New': 'جديد', 'Read': 'مقروء', 'Handled': 'تمت معالجته',
    'No inquiries yet. Submissions from the contact page will appear here.': 'لا توجد استفسارات بعد. ستظهر هنا الرسائل المُرسلة من صفحة التواصل.',
    'From': 'من', 'Interest': 'الاهتمام',
    'Status updated': 'تم تحديث الحالة',
    'Delete this inquiry? This can’t be undone.': 'حذف هذا الاستفسار؟ لا يمكن التراجع عن هذا.',
    'Inquiry deleted': 'تم حذف الاستفسار',
    'Emails collected from the footer signup form': 'البريد الإلكتروني المُجمَّع من نموذج الاشتراك في التذييل',
    'Copy all emails': 'نسخ كل رسائل البريد الإلكتروني',
    'Couldn’t load subscribers:': 'تعذّر تحميل المشتركين:',
    'If you haven’t yet, run the newsletter section of': 'إن لم تفعل ذلك بعد، شغّل قسم النشرة البريدية من',
    'No subscribers yet': 'لا يوجد مشتركون بعد',
    'Emails copied to clipboard': 'تم نسخ رسائل البريد الإلكتروني',
    'Could not copy — select and copy manually': 'تعذّر النسخ — حدد وانسخ يدويًا',
    "No subscribers yet. Signups from any page's footer will appear here.": 'لا يوجد مشتركون بعد. ستظهر هنا الاشتراكات من تذييل أي صفحة.',
    'Subscribed': 'تاريخ الاشتراك',
    'Remove this subscriber? This can’t be undone.': 'إزالة هذا المشترك؟ لا يمكن التراجع عن هذا.',
    'Subscriber removed': 'تمت إزالة المشترك',

    // ---------- admin: resource fields (projects/cities/testimonials/developers) ----------
    'Project': 'مشروع',
    'Name': 'الاسم',
    'Slug (URL id)': 'المعرّف (رابط URL)',
    'lowercase, dashes — e.g. azure-residences': 'أحرف صغيرة وشرطات — مثال: azure-residences',
    'Unit types available': 'أنواع الوحدات المتاحة',
    'e.g. Villas, Apartments, Duplex, Townhouses, Studio — powers the hero search and the AI matchmaker': 'مثال: فلل، شقق، دوبلكس، تاون هاوس، استوديو — يُستخدم في بحث القسم الرئيسي ومطابقة الذكاء الاصطناعي',
    '— No linked city —': '— لا توجد مدينة مرتبطة —',
    "Add cities under the Cities section first. This also fills the project's display city name.": 'أضف المدن ضمن قسم المدن أولاً. هذا يملأ أيضًا اسم المدينة المعروض للمشروع.',
    'Country': 'الدولة',
    'Location / address': 'الموقع / العنوان',
    'Tagline': 'الشعار الترويجي',
    'Developer': 'المطوّر',
    'Developer logo': 'شعار المطوّر',
    'Shown on the project card and sidebar': 'يظهر في بطاقة المشروع والشريط الجانبي',
    'Year': 'السنة',
    'Cover image': 'صورة الغلاف',
    'About (one paragraph per line)': 'نبذة (فقرة في كل سطر)',
    'Price (display)': 'السعر (للعرض)',
    'e.g. EGP 3.2M': 'مثال: 3.2 مليون جنيه',
    'Price value (number)': 'قيمة السعر (رقم)',
    'Area (display)': 'المساحة (للعرض)',
    'Area value (number)': 'قيمة المساحة (رقم)',
    'Rental listing': 'عرض إيجار',
    'Latitude': 'خط العرض',
    'Longitude': 'خط الطول',
    'Brochure (PDF)': 'الكتيب (PDF)',
    'Shown as a "Download brochure" button on the project page — leave empty to hide it': 'يظهر كزر "تحميل الكتيب" في صفحة المشروع — اتركه فارغًا لإخفائه',
    'Shown in the project page sidebar — leave empty to hide the section': 'يظهر في الشريط الجانبي لصفحة المشروع — اتركه فارغًا لإخفاء القسم',
    'Sort order': 'ترتيب العرض',
    'Tile': 'الحجم',
    'Image': 'الصورة',
    'Tile size': 'حجم البطاقة',
    'controls the tile size in the homepage “By Cities” grid': 'يتحكم في حجم البطاقة ضمن شبكة «حسب المدن» في الصفحة الرئيسية',
    'Testimonial': 'رأي عميل',
    'Quote': 'الاقتباس',
    'Rating': 'التقييم',
    'Avatar': 'الصورة الرمزية',
    'Rating (1–5)': 'التقييم (1–5)',
    'Logo (optional)': 'الشعار (اختياري)',
    'leave empty to render the name as a wordmark': 'اتركه فارغًا لعرض الاسم ككلمة شعار',

    // ---------- admin: setup screen (Supabase not configured) ----------
    'Setup required': 'الإعداد مطلوب',
    'Connect Supabase to start managing content': 'اربط Supabase لبدء إدارة المحتوى',
    'Supabase isn’t configured': 'لم يتم إعداد Supabase',
    'Your public site is running on bundled demo data. To enable the admin and live editing:': 'موقعك العام يعمل حاليًا ببيانات تجريبية مرفقة. لتفعيل لوحة الإدارة والتعديل المباشر:',
    'Create a project at': 'أنشئ مشروعًا على',
    'Run': 'شغّل',
    'in the SQL editor': 'في محرر SQL',
    'Paste your Project URL + anon key into': 'ألصق رابط المشروع (Project URL) والمفتاح العام (anon key) في',
    'Add yourself to the': 'أضف نفسك إلى',
    'table, then reload': 'الجدول، ثم أعد تحميل الصفحة',

    // ---------- admin: upload / media picker ----------
    'comma, separated, values': 'قيم، مفصولة، بفواصل',
    'Unsplash id or image URL': 'معرّف Unsplash أو رابط صورة',
    'Upload…': 'رفع…',
    'Choose existing…': 'اختر من الموجود…',
    'View current PDF': 'عرض ملف PDF الحالي',
    'No file uploaded': 'لم يتم رفع أي ملف',
    'PDF URL': 'رابط PDF',
    'Add consultant': 'إضافة مستشار',
    'Image selected — remember to Save': 'تم اختيار الصورة — لا تنسَ الحفظ',
    'Image uploaded — remember to Save': 'تم رفع الصورة — لا تنسَ الحفظ',
    'Upload new': 'رفع جديد',
    'Choose an existing file': 'اختر ملفًا موجودًا',
    'Choose': 'اختيار',
    'Uploading': 'جارٍ الرفع',
    'image(s)…': 'صورة/صور…',
    'Gallery updated — remember to Save': 'تم تحديث المعرض — لا تنسَ الحفظ',
    'PDF selected — remember to Save': 'تم اختيار ملف PDF — لا تنسَ الحفظ',
    'PDF uploaded — remember to Save': 'تم رفع ملف PDF — لا تنسَ الحفظ',
    'Click to choose an existing logo': 'اضغط لاختيار شعار موجود',
    'Consultant name': 'اسم المستشار',
    'Logo uploaded — remember to Save': 'تم رفع الشعار — لا تنسَ الحفظ',
    'Please choose an image file': 'يرجى اختيار ملف صورة',
    'Please choose a PDF file': 'يرجى اختيار ملف PDF',
    'File is larger than': 'حجم الملف أكبر من',
    'please pick a smaller one': 'يرجى اختيار ملف أصغر',
    'Upload timed out — the file may be too large for your connection, or the storage bucket may have a lower size limit than this form allows.': 'انتهت مهلة الرفع — قد يكون الملف كبيرًا جدًا بالنسبة لاتصالك، أو أن سعة التخزين المسموحة أقل مما يتيحه هذا النموذج.',
    'Upload failed': 'فشل الرفع',
    'Storage bucket "media" is missing. In Supabase → Storage, create a public bucket named "media" (or run supabase/fix-storage-and-admin.sql).': 'حاوية التخزين "media" غير موجودة. في Supabase ← Storage، أنشئ حاوية عامة باسم "media" (أو شغّل supabase/fix-storage-and-admin.sql).',
    'Upload blocked — your account is not an admin yet. Add your user to the admins table (see supabase/fix-storage-and-admin.sql).': 'تم حظر الرفع — حسابك ليس مسؤولاً بعد. أضف مستخدمك إلى جدول admins (راجع supabase/fix-storage-and-admin.sql).',
    'Uploaded, but could not resolve the public URL': 'تم الرفع، لكن تعذّر الحصول على الرابط العام',
    'Upload failed:': 'فشل الرفع:',
    'Search filenames…': 'ابحث بأسماء الملفات…',
    'Couldn’t load files:': 'تعذّر تحميل الملفات:',
    "No PDFs uploaded yet — upload one first, then it'll show up here to reuse.": 'لا توجد ملفات PDF مرفوعة بعد — ارفع ملفًا أولاً ليظهر هنا لإعادة استخدامه.',
    "No images uploaded yet — upload one first, then it'll show up here to reuse.": 'لا توجد صور مرفوعة بعد — ارفع صورة أولاً لتظهر هنا لإعادة استخدامها.',
    'An image is still uploading — please wait a moment': 'لا تزال هناك صورة قيد الرفع — يرجى الانتظار قليلاً',

    // ---------- admin: form/save/delete messages ----------
    'is required': 'مطلوب',
    'Saved': 'تم الحفظ',
    'created': 'تم الإنشاء',
    "project(s) are linked to this city — they'll be kept, just unlinked from it.": 'مشروع/مشاريع مرتبطة بهذه المدينة — ستبقى، وسيُزال الربط فقط بينها وبين هذه المدينة.',
    'Delete this': 'حذف هذا',
    'This can’t be undone.': 'لا يمكن التراجع عن هذا.',
    'deleted': 'تم الحذف',
    'Content saved': 'تم حفظ المحتوى',

    // ---------- admin login ----------
    'Sign in · Realteek Admin': 'تسجيل الدخول · إدارة Realteek',
    'Welcome back': 'مرحبًا بعودتك',
    'Sign in to manage your listings, projects and site content.': 'سجّل الدخول لإدارة مشاريعك ومحتوى موقعك.',
    'Email address': 'البريد الإلكتروني',
    'Password': 'كلمة المرور',
    'Sign in': 'تسجيل الدخول',
    'Supabase isn’t configured yet. Add your project URL and anon key in config.js, then run supabase/schema.sql.': 'لم يتم إعداد Supabase بعد. أضف رابط المشروع والمفتاح العام في config.js، ثم شغّل supabase/schema.sql.',
    'Demo mode (no server). Sign in with': 'وضع تجريبي (بدون خادم). سجّل الدخول باستخدام',
    'Sign in failed. Check your credentials.': 'فشل تسجيل الدخول. تحقق من بيانات الدخول.',
    'This account doesn’t have admin access.': 'هذا الحساب لا يملك صلاحية الإدارة.',
    'Signed in. Redirecting…': 'تم تسجيل الدخول. جارٍ التحويل…',
  };

  function normalize(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function getLang() {
    try { return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'; }
    catch (_) { return 'en'; }
  }
  function setLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang === 'ar' ? 'ar' : 'en'); } catch (_) { /* ignore */ }
    location.reload();
  }

  const lang = getLang();

  // translate a plain-text string; unknown strings pass through untouched
  function t(str) {
    if (lang !== 'ar' || str == null) return str;
    return AR[normalize(str)] || AR[str] || str;
  }

  // set direction/lang as early as possible (before body paints) to avoid
  // a flash of the wrong writing direction
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const src = el.dataset.i18nSrc != null ? el.dataset.i18nSrc : el.textContent;
      el.dataset.i18nSrc = src;
      el.textContent = t(src);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const src = el.dataset.i18nSrc != null ? el.dataset.i18nSrc : el.innerHTML;
      el.dataset.i18nSrc = src;
      el.innerHTML = (lang === 'ar' && AR[key]) ? AR[key] : src;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const src = el.dataset.i18nPh != null ? el.dataset.i18nPh : (el.getAttribute('placeholder') || '');
      el.dataset.i18nPh = src;
      el.setAttribute('placeholder', t(src));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const src = el.dataset.i18nAriaSrc != null ? el.dataset.i18nAriaSrc : (el.getAttribute('aria-label') || '');
      el.dataset.i18nAriaSrc = src;
      el.setAttribute('aria-label', t(src));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const src = el.dataset.i18nTitleSrc != null ? el.dataset.i18nTitleSrc : (el.getAttribute('title') || '');
      el.dataset.i18nTitleSrc = src;
      el.setAttribute('title', t(src));
    });
  }

  function initSwitchers() {
    document.querySelectorAll('.lang-switch').forEach(btn => {
      btn.textContent = lang === 'ar' ? 'English' : 'العربية';
      btn.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
      btn.addEventListener('click', () => setLang(lang === 'ar' ? 'en' : 'ar'));
    });
  }

  document.addEventListener('DOMContentLoaded', () => { applyStatic(); initSwitchers(); });

  window.i18n = { lang, t, setLang, getLang, applyStatic };
  window.t = t;
})();
