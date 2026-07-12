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
    company: {
      name: "Realteek",
      logo: "",
      tagline: "Real estate done right — handpicked homes, offices and luxury units across the world's great cities.",
      email: "hello@realteek.com",
      emailSecondary: "press@realteek.com",
      phone: "+971 4 555 0100",
      phoneSecondary: "",
      address: "Level 18, Marina Gate Tower\nDubai Marina, United Arab Emirates",
      hours: "Sunday – Thursday: 9am – 6pm\nSaturday: by appointment",
      instagram: "#",
      x: "#",
      linkedin: "#",
      facebook: "",
      copyright: "© 2026 Realteek. All rights reserved.",
      offices: [
        { city: "Dubai · HQ", lines: "Level 18, Marina Gate Tower\nDubai Marina, UAE", phone: "+971 4 555 0100" },
        { city: "London", lines: "22 Curzon Street, Mayfair\nLondon W1J, United Kingdom", phone: "+44 20 7555 0140" },
        { city: "Singapore", lines: "One Raffles Place, #44-01\nSingapore 048616", phone: "+65 6255 0180" }
      ]
    },
    hero: {
      eyebrow: "Curated Homes For Sale.",
      titleA: "Real Estate",
      titleB: "Done Right",
      sub: "A handpicked collection of homes, offices and luxury spaces — curated for people who refuse to settle."
    },
    stats: {
      lead: "With a proven track record and in-depth market knowledge, we're here to make your real estate journey smooth and stress-free. Whether you're buying your first home or expanding your portfolio, you can count on our team to deliver results with integrity.",
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
