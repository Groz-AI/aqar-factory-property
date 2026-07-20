/* ============================================================
   REALTEEK — bundled demo content
   Used when Supabase isn't configured, and as the source for the
   admin "Import starter data" seeder. Projects come from data.js
   (window.PROJECTS); everything else is defined here.
   ============================================================ */
window.FALLBACK = {
  projects: window.PROJECTS || [],

  cities: [
    { name:"Dubai", country:"United Arab Emirates", image:"1512453979798-5ea266f8880c", size:"big" },
    { name:"New York", country:"United States", image:"1496442226666-8d4d0e62e6e9", size:"normal" },
    { name:"London", country:"United Kingdom", image:"1513635269975-59663e0ac1ad", size:"normal" },
    { name:"Singapore", country:"Singapore", image:"1525625293386-3f8f99389edd", size:"normal" },
    { name:"Tokyo", country:"Japan", image:"1540959733332-eab4deabeeaf", size:"wide" }
  ],

  testimonials: [
    { quote:"We couldn't be happier with the outcome. From the initial consultation to the final touches, the team demonstrated a high level of professionalism, creativity and care.", name:"Tommie Littel", location:"Nusa Dua, Bali", avatar:"1507003211169-0a1dd7228f2d", rating:5 },
    { quote:"Aqar Factory found us an off-market penthouse we'd never have discovered alone. The whole process felt effortless and genuinely tailored to us.", name:"Amara Okafor", location:"Dubai Marina, UAE", avatar:"1494790108377-be9c29b29330", rating:5 },
    { quote:"As an investor I value precision and honesty. Their market read was sharp and the returns have spoken for themselves.", name:"Daniel Brooks", location:"London, UK", avatar:"1500648767791-00dcc994a43e", rating:5 },
    { quote:"Selling our family home was emotional, but they handled every detail with such warmth. Sold above asking in nine days.", name:"Sofia Marchetti", location:"Paris, France", avatar:"1438761681033-6461ffad8d80", rating:5 },
    { quote:"The office leasing team understood our growth plans and matched us perfectly. Couldn't recommend them more highly.", name:"Kenji Watanabe", location:"Singapore CBD", avatar:"1463453091185-61582044d556", rating:5 },
    { quote:"Beautiful homes, but it's the people that make Aqar Factory. Responsive, transparent and never pushy.", name:"Isabella Cruz", location:"Miami, USA", avatar:"1534528741775-53994a69daeb", rating:5 },
    { quote:"From browsing to keys in hand, everything was seamless. The curated listings saved us weeks of searching.", name:"Marcus Lindqvist", location:"New York, USA", avatar:"1506794778202-cad84cf45f1d", rating:5 },
    { quote:"A boutique experience with global reach. They treated our modest budget with the same care as any luxury client.", name:"Priya Nair", location:"Jakarta, Indonesia", avatar:"1517841905240-472988babdf9", rating:5 }
  ],

  developers: [
    { name:"Emaar", logo:null }, { name:"DAMAC", logo:null }, { name:"Aldar", logo:null },
    { name:"Nakheel", logo:null }, { name:"Sobha", logo:null }, { name:"Meraas", logo:null },
    { name:"Ellington", logo:null }, { name:"Omniyat", logo:null }, { name:"Binghatti", logo:null },
    { name:"Select Group", logo:null }
  ],

  blogPosts: [
    {
      id: "off-plan-buying-guide",
      title: "The Ultimate Guide to Buying Off-Plan Properties",
      excerpt: "Off-plan can mean better pricing and flexible payment plans — but only if you know what to check before you sign. Here's our advisors' checklist.",
      cover: "1600585154340-be6161a56a0c",
      authorName: "Sofia Marchetti",
      authorAvatar: "1438761681033-6461ffad8d80",
      tags: ["Off-plan", "Buying guide", "Investment"],
      publishedAt: "2026-06-02T09:00:00.000Z",
      blocks: [
        { type: "paragraph", text: "Off-plan property — buying a home before it's built — has become one of the fastest ways to enter a growth market at a lower price point. It also comes with real risk if you don't know what to check first." },
        { type: "heading", text: "Why buyers choose off-plan" },
        { type: "paragraph", text: "Developers typically price off-plan units below projected completion value, and spread payments across the construction timeline instead of asking for the full amount up front. For buyers comfortable waiting two to four years, that gap between entry price and market value at handover is the whole appeal." },
        { type: "image", image: "1600607687939-ce8a6c25118c" },
        { type: "heading", text: "What to verify before you reserve a unit" },
        { type: "paragraph", text: "Start with the developer's track record: how many prior projects have they delivered, and were they on schedule? Ask for the escrow account details required by law in most markets — your payments should sit in a regulated account tied to construction milestones, not the developer's general funds." },
        { type: "paragraph", text: "Read the payment plan closely for what happens if handover slips. A good contract caps the delay penalty and gives you an exit if the project is delayed beyond a defined window." },
        { type: "heading", text: "Our advisors' rule of thumb" },
        { type: "paragraph", text: "We only bring clients into off-plan developments from partners we've worked with before, with a public delivery history we can point to. If we haven't seen a developer hand over a comparable project on time, we say so plainly before you commit a deposit." }
      ]
    },
    {
      id: "new-capital-investment-outlook",
      title: "New Capital: Why Investors Are Watching This City",
      excerpt: "Egypt's New Administrative Capital has gone from government blueprint to one of the region's most-discussed investment stories. Here's what's actually driving demand.",
      cover: "1486406146926-c627a92ad1ab",
      authorName: "Daniel Brooks",
      authorAvatar: "1500648767791-00dcc994a43e",
      tags: ["Market insight", "New Capital", "Investment"],
      publishedAt: "2026-05-14T09:00:00.000Z",
      blocks: [
        { type: "paragraph", text: "A decade ago, the New Administrative Capital existed only on paper. Today it's home to government ministries, a growing residential population, and a wave of developer activity that shows no sign of slowing." },
        { type: "heading", text: "Infrastructure first" },
        { type: "paragraph", text: "Unlike organic urban growth, New Capital was planned with roads, utilities and transit built ahead of demand rather than playing catch-up. That sequencing is a big part of why institutional developers moved in early — the hard infrastructure risk was already retired by the time private capital arrived." },
        { type: "image", image: "1444723121867-7a241cacace9" },
        { type: "heading", text: "What this means for buyers today" },
        { type: "paragraph", text: "Early-phase pricing is largely gone, but the city is still years from being fully built out, which means the appreciation curve isn't over. The projects worth watching now are the ones closest to completed amenities — schools, retail and the government district — rather than the cheapest plots furthest from them." },
        { type: "paragraph", text: "As always, our advice is the same regardless of which city is trending: buy the unit and location you'd be glad to own even if the growth story slows, not just the one riding this month's headlines." }
      ]
    },
    {
      id: "signs-time-to-upgrade-family-home",
      title: "5 Signs It's Time to Upgrade Your Family Home",
      excerpt: "Outgrowing a home rarely happens overnight — it creeps up. These are the signals our clients tell us they wish they'd acted on sooner.",
      cover: "1560448204-e02f11c3d0e2",
      authorName: "Amara Okafor",
      authorAvatar: "1494790108377-be9c29b29330",
      tags: ["Home buying", "Family", "Lifestyle"],
      publishedAt: "2026-04-20T09:00:00.000Z",
      blocks: [
        { type: "paragraph", text: "Most families don't wake up one day and decide to move — the decision builds slowly, room by room. Here are the signs we hear most often from clients right before they call us." },
        { type: "heading", text: "1. Storage has become a daily negotiation" },
        { type: "paragraph", text: "If getting the stroller out means moving three other things first, that's not a storage problem you solve with organizers — it's a space problem." },
        { type: "heading", text: "2. Everyone works from the kitchen table" },
        { type: "paragraph", text: "A home that had one clear \"quiet corner\" for remote work in 2021 often has three people needing one by now. If calls are getting scheduled around who's home, it's worth counting how many dedicated workspaces you actually need." },
        { type: "image", image: "1449844908441-8829872d2607" },
        { type: "heading", text: "3. You've stopped hosting" },
        { type: "paragraph", text: "A quiet but reliable signal: families who once hosted regularly and gradually stopped, often because the space no longer comfortably fits the gathering they used to have." },
        { type: "heading", text: "4. The commute math has changed" },
        { type: "paragraph", text: "Whether it's a new job, a new school, or a shift to hybrid work, a commute that made sense three years ago can quietly become the biggest source of weekly friction in the household." },
        { type: "heading", text: "5. You're renovating around problems instead of fixing them" },
        { type: "paragraph", text: "If your last three home-improvement projects were about working around a layout rather than improving it, that budget might be better spent as a down payment on a home that already fits." }
      ]
    }
  ],

  content: {
    sections: {
      testimonials: true
    },
    company: {
      name: "Aqar Factory",
      logo: "",
      tagline: "Real estate done right — handpicked homes, offices and luxury units across the world's great cities.",
      email: "hello@realteek.com",
      emailSecondary: "press@realteek.com",
      phone: "+971 4 555 0100",
      phoneSecondary: "",
      address: "Level 18, Marina Gate Tower\nDubai Marina, United Arab Emirates",
      hours: "Sunday – Thursday: 9am – 6pm\nSaturday: by appointment",
      instagram: "#",
      instagram_visible: true,
      x: "#",
      x_visible: true,
      linkedin: "#",
      linkedin_visible: true,
      facebook: "",
      facebook_visible: true,
      tiktok: "",
      tiktok_visible: true,
      copyright: "© 2026 Aqar Factory. All rights reserved.",
      offices: [
        { city: "Dubai · HQ", lines: "Level 18, Marina Gate Tower\nDubai Marina, UAE", phone: "+971 4 555 0100" },
        { city: "London", lines: "22 Curzon Street, Mayfair\nLondon W1J, United Kingdom", phone: "+44 20 7555 0140" },
        { city: "Singapore", lines: "One Raffles Place, #44-01\nSingapore 048616", phone: "+65 6255 0180" }
      ]
    },
    hero: {
      eyebrow: "Curated Homes For Sale.",
      eyebrow_ar: "منازل مختارة بعناية للبيع.",
      titleA: "Real Estate",
      titleA_ar: "العقارات",
      titleB: "Done Right",
      titleB_ar: "كما ينبغي",
      sub: "A handpicked collection of homes, offices and luxury spaces — curated for people who refuse to settle.",
      sub_ar: "مجموعة مختارة بعناية من المنازل والمكاتب والمساحات الفاخرة — لمن يرفضون التنازل."
    },
    stats: {
      lead: "With a proven track record and in-depth market knowledge, we're here to make your real estate journey smooth and stress-free. Whether you're buying your first home or expanding your portfolio, you can count on our team to deliver results with integrity.",
      lead_ar: "بخبرة مثبتة ومعرفة عميقة بالسوق، نحن هنا لنجعل رحلتك العقارية سلسة وخالية من التوتر. سواء كنت تشتري منزلك الأول أو توسّع محفظتك، يمكنك الاعتماد على فريقنا لتحقيق نتائج بنزاهة تامة.",
      items: [
        { value: 1500, suffix: "", label: "Total properties sold, helping families find their dream homes for over a decade.", label_ar: "إجمالي العقارات المباعة، حيث نساعد العائلات على إيجاد منازل أحلامها منذ أكثر من عقد." },
        { value: 30, suffix: "+", label: "Strong partnerships with local businesses to enhance and extend our services.", label_ar: "شراكات قوية مع الشركات المحلية لتعزيز خدماتنا وتوسيع نطاقها." },
        { value: 98, suffix: "%", label: "Client satisfaction rate, reflecting our commitment to exceptional service.", label_ar: "معدل رضا العملاء، مما يعكس التزامنا بتقديم خدمة استثنائية." }
      ]
    },
    cta: {
      titleA: "Make Your Dream",
      titleA_ar: "حوّل مساحة",
      titleB: "Space a Reality",
      titleB_ar: "أحلامك إلى واقع",
      text: "Partner with us to create stunning, innovative spaces that match your vision. Let's build something extraordinary together.",
      text_ar: "تعاون معنا لإنشاء مساحات مبتكرة وآسرة تتناسب مع رؤيتك. لنبنِ معًا شيئًا استثنائيًا.",
      button: "Get Started",
      button_ar: "ابدأ الآن"
    }
  }
};
