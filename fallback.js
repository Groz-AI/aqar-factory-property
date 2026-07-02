/* ============================================================
   REALTEEK — bundled demo content
   Used when Supabase isn't configured, and as the source for the
   admin "Import starter data" seeder. Projects come from data.js
   (window.PROJECTS); everything else is defined here.
   ============================================================ */
window.FALLBACK = {
  projects: window.PROJECTS || [],

  properties: [
    { name:"Tropical Oasis", location:"Seminyak, Bali", description:"Private pool, lush gardens, modern amenities", price:"$2,450,000", categories:["villas","luxury"], badge:"For Sale", image:"1600596542815-ffad4c1539a9", beds:5, baths:4, area:"480 m²" },
    { name:"Bali Cliff Retreat", location:"Uluwatu, Bali", description:"Panoramic ocean views, spacious living areas", price:"$850,000", categories:["villas"], badge:"For Sale", image:"1613490493576-7fde63acd811", beds:4, baths:3, area:"320 m²" },
    { name:"Metro Skyline Loft", location:"Jakarta, Indonesia", description:"Contemporary design, floor-to-ceiling windows", price:"$215,000", categories:["apartments","studio"], badge:"For Rent", image:"1545324418-cc1a3fa10c00", beds:2, baths:2, area:"95 m²" },
    { name:"The Glass Pavilion", location:"Dubai Marina, UAE", description:"Minimalist architecture, infinity-edge pool", price:"$3,200,000", categories:["villas","luxury"], badge:"For Sale", image:"1600585154340-be6161a56a0c", beds:6, baths:5, area:"610 m²" },
    { name:"Heritage Townhouse", location:"London, United Kingdom", description:"Restored façade, three storeys, private courtyard", price:"$1,180,000", categories:["townhouses","duplex"], badge:"For Sale", image:"1568605114967-8130f3a36994", beds:4, baths:3, area:"240 m²" },
    { name:"Meridian Office Suite", location:"Singapore CBD", description:"Grade-A workspace, column-free, rooftop terrace", price:"$4,800/mo", categories:["offices","retail"], badge:"For Lease", image:"1497366216548-37526070297c", beds:0, baths:2, area:"180 m²" },
    { name:"Ocean View Villa", location:"Patong Beach, Phuket", description:"A stunning villa with breathtaking views", price:"$2,450,000", categories:["villas","luxury"], badge:"For Sale", image:"1499793983690-e29da59ef1c2", beds:5, baths:4, area:"440 m²" },
    { name:"Lakeside Studio", location:"Batam, Indonesia", description:"Tranquil setting, beautiful landscaping, outdoor deck", price:"$148,000", categories:["studio","apartments"], badge:"For Rent", image:"1502672260266-1c1ef2d93688", beds:1, baths:1, area:"42 m²" },
    { name:"Beachfront Paradise", location:"Seminyak, Bali", description:"Direct beach access, ideal for water activities", price:"$770,000", categories:["villas","luxury"], badge:"For Sale", image:"1600210492486-724fe5c67fb0", beds:4, baths:4, area:"360 m²" },
    { name:"The Commerce Hub", location:"New York, USA", description:"Prime retail frontage on a pedestrian boulevard", price:"$6,200/mo", categories:["retail","offices"], badge:"For Lease", image:"1441986300917-64674bd600d8", beds:0, baths:2, area:"210 m²" },
    { name:"Duplex on the Park", location:"Paris, France", description:"Two-level living, balcony, treetop outlook", price:"$1,540,000", categories:["duplex","apartments"], badge:"For Sale", image:"1502005229762-cf1b2da7c5d6", beds:3, baths:2, area:"165 m²" },
    { name:"Azure Penthouse", location:"Miami, USA", description:"Wraparound terrace, private elevator, sea vistas", price:"$4,100,000", categories:["apartments","luxury"], badge:"For Sale", image:"1493809842364-78817add7ffb", beds:4, baths:4, area:"300 m²" }
  ],

  cities: [
    { name:"Dubai", country:"United Arab Emirates", image:"1512453979798-5ea266f8880c", unit_count:"1,240 Units", size:"big" },
    { name:"New York", country:"United States", image:"1496442226666-8d4d0e62e6e9", unit_count:"980 Units", size:"normal" },
    { name:"London", country:"United Kingdom", image:"1513635269975-59663e0ac1ad", unit_count:"760 Units", size:"normal" },
    { name:"Singapore", country:"Singapore", image:"1525625293386-3f8f99389edd", unit_count:"540 Units", size:"normal" },
    { name:"Tokyo", country:"Japan", image:"1540959733332-eab4deabeeaf", unit_count:"615 Units", size:"wide" }
  ],

  testimonials: [
    { quote:"We couldn't be happier with the outcome. From the initial consultation to the final touches, the team demonstrated a high level of professionalism, creativity and care.", name:"Tommie Littel", location:"Nusa Dua, Bali", avatar:"1507003211169-0a1dd7228f2d", rating:5 },
    { quote:"Realteek found us an off-market penthouse we'd never have discovered alone. The whole process felt effortless and genuinely tailored to us.", name:"Amara Okafor", location:"Dubai Marina, UAE", avatar:"1494790108377-be9c29b29330", rating:5 },
    { quote:"As an investor I value precision and honesty. Their market read was sharp and the returns have spoken for themselves.", name:"Daniel Brooks", location:"London, UK", avatar:"1500648767791-00dcc994a43e", rating:5 },
    { quote:"Selling our family home was emotional, but they handled every detail with such warmth. Sold above asking in nine days.", name:"Sofia Marchetti", location:"Paris, France", avatar:"1438761681033-6461ffad8d80", rating:5 },
    { quote:"The office leasing team understood our growth plans and matched us perfectly. Couldn't recommend them more highly.", name:"Kenji Watanabe", location:"Singapore CBD", avatar:"1463453091185-61582044d556", rating:5 },
    { quote:"Beautiful homes, but it's the people that make Realteek. Responsive, transparent and never pushy.", name:"Isabella Cruz", location:"Miami, USA", avatar:"1534528741775-53994a69daeb", rating:5 },
    { quote:"From browsing to keys in hand, everything was seamless. The curated listings saved us weeks of searching.", name:"Marcus Lindqvist", location:"New York, USA", avatar:"1506794778202-cad84cf45f1d", rating:5 },
    { quote:"A boutique experience with global reach. They treated our modest budget with the same care as any luxury client.", name:"Priya Nair", location:"Jakarta, Indonesia", avatar:"1517841905240-472988babdf9", rating:5 }
  ],

  developers: [
    { name:"Emaar", logo:null }, { name:"DAMAC", logo:null }, { name:"Aldar", logo:null },
    { name:"Nakheel", logo:null }, { name:"Sobha", logo:null }, { name:"Meraas", logo:null },
    { name:"Ellington", logo:null }, { name:"Omniyat", logo:null }, { name:"Binghatti", logo:null },
    { name:"Select Group", logo:null }
  ],

  content: {
    hero: {
      eyebrow: "Buy. Sell. Rent.",
      titleA: "Real Estate",
      titleB: "Done Right",
      sub: "A handpicked collection of homes, offices and luxury spaces — curated for people who refuse to settle."
    },
    stats: {
      lead: "With a proven track record and in-depth market knowledge, we're here to make your real estate journey smooth and stress-free. Whether buying, selling, or investing, you can count on our team to deliver results with integrity.",
      items: [
        { value: 1500, suffix: "", label: "Total properties sold, helping families find their dream homes for over a decade." },
        { value: 30, suffix: "+", label: "Strong partnerships with local businesses to enhance and extend our services." },
        { value: 98, suffix: "%", label: "Client satisfaction rate, reflecting our commitment to exceptional service." }
      ]
    },
    cta: {
      titleA: "Make Your Dream",
      titleB: "Space a Reality",
      text: "Partner with us to create stunning, innovative spaces that match your vision. Let's build something extraordinary together.",
      button: "Get Started"
    }
  }
};

/* give every listing a small image gallery (cover + two interiors),
   so the home page cards swipe and the seeded data carries galleries too */
(function () {
  const pool = [
    "1505691938895-1758d7feb511", "1560448204-e02f11c3d0e2", "1556912173-3bb406ef7e77",
    "1600210492493-0946911123ea", "1600607687939-ce8a6c25118c", "1583847268964-b28dc8f51f92"
  ];
  (window.FALLBACK.properties || []).forEach((p, i) => {
    if (!p.images) p.images = [p.image, pool[i % pool.length], pool[(i + 2) % pool.length]].filter(Boolean);
  });
})();
