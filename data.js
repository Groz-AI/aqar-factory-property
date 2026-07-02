/* ============================================================
   REALTEEK — shared project dataset
   Used by projects.html (listing) and project.html (detail)
   ============================================================ */
window.U = (id, w = 900) =>
  !id ? '' :
  /^https?:\/\//.test(id) ? id :
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

window.PROJECTS = [
  {
    id: "azure-residences",
    name: "The Azure Residences",
    category: "Residential",
    city: "Dubai",
    location: "Dubai Marina, UAE",
    country: "United Arab Emirates",
    year: 2025,
    status: "Completed",
    tagline: "48 sky-villas where the marina meets the horizon.",
    cover: "1545324418-cc1a3fa10c00",
    gallery: ["1545324418-cc1a3fa10c00","1600607687939-ce8a6c25118c","1600566753086-00f18fb6b3ea","1502005097973-6a7082348e28","1600210492486-724fe5c67fb0"],
    about: [
      "Rising above Dubai Marina, The Azure Residences pair mirror-glass façades with interiors wrapped in warm oak and stone. Each of the 48 sky-villas is dual-aspect, drawing light from sunrise over the creek to sunset across the Gulf.",
      "Residents arrive through a double-height lobby finished in travertine and brushed bronze, then ascend to homes designed around uninterrupted water views and seamless indoor-outdoor living."
    ],
    amenities: ["Infinity Pool","Sky Gym","24/7 Concierge","Smart Home","Valet Parking","Spa & Sauna"],
    stats: { units: "48 Villas", floors: "32 Floors", area: "610 m² avg", price: "$3.2M", handover: "Q4 2025" },
    developer: "Emaar Properties"
  },
  {
    id: "meridian-workspaces",
    name: "Meridian Workspaces",
    category: "Offices",
    city: "Singapore",
    location: "Singapore CBD",
    country: "Singapore",
    year: 2025,
    status: "Completed",
    tagline: "Grade-A, column-free floors with a landscaped sky-terrace.",
    cover: "1497366216548-37526070297c",
    gallery: ["1497366216548-37526070297c","1497366811353-6870744d04b2","1524758631624-e2822e304c36","1416331108676-a22ccb276e35","1486406146926-c627a92ad1ab"],
    about: [
      "Meridian Workspaces reimagines the office tower for the way teams actually work — vast column-free plates, full-height glazing and floor-to-ceiling daylight on every level.",
      "A landscaped sky-terrace on the 18th floor offers tenants a green retreat above the city, while the ground-floor atrium hosts cafés, a wellness studio and end-of-trip facilities."
    ],
    amenities: ["Co-working Lounge","Sky Terrace","EV Charging","24/7 Security","Wellness Studio","Concierge"],
    stats: { units: "22 Floors Leasable", floors: "26 Floors", area: "180–1,400 m²", price: "$4.8K/mo", handover: "Q1 2025" },
    developer: "Aldar Commercial"
  },
  {
    id: "palm-grove-estate",
    name: "Palm Grove Estate",
    category: "Luxury Villas",
    city: "Bali",
    location: "Seminyak, Bali",
    country: "Indonesia",
    year: 2024,
    status: "Completed",
    tagline: "Twelve private villas inside a gated tropical garden.",
    cover: "1613490493576-7fde63acd811",
    gallery: ["1613490493576-7fde63acd811","1600596542815-ffad4c1539a9","1600585154340-be6161a56a0c","1567496898669-ee935f5f647a","1600607687939-ce8a6c25118c"],
    about: [
      "Set behind a quiet lane in Seminyak, Palm Grove Estate is a collection of twelve villas, each with its own infinity pool, open-air living pavilion and walled garden.",
      "Local stone, reclaimed teak and handwoven textiles ground the architecture in its surroundings, while discreet smart-home systems keep everything effortless."
    ],
    amenities: ["Private Infinity Pool","Landscaped Gardens","Beach Access","Smart Home","Housekeeping","Spa & Sauna"],
    stats: { units: "12 Villas", floors: "2 Storeys", area: "480 m² avg", price: "$2.45M", handover: "Delivered 2024" },
    developer: "Ellington Bali"
  },
  {
    id: "highline-quarter",
    name: "Highline Quarter",
    category: "Mixed-Use",
    city: "New York",
    location: "Chelsea, New York",
    country: "United States",
    year: 2024,
    status: "Completed",
    tagline: "Retail, lofts and co-working around a pedestrian boulevard.",
    cover: "1486406146926-c627a92ad1ab",
    gallery: ["1486406146926-c627a92ad1ab","1441986300917-64674bd600d8","1502005229762-cf1b2da7c5d6","1524758631624-e2822e304c36","1600566753086-00f18fb6b3ea"],
    about: [
      "Highline Quarter knits together residential lofts, ground-floor retail and flexible co-working into a single block organised around a planted pedestrian boulevard.",
      "Exposed steel, blackened brick and crittall glazing nod to the neighbourhood's industrial past while delivering thoroughly contemporary spaces."
    ],
    amenities: ["Co-working Lounge","Rooftop Terrace","Retail Promenade","EV Charging","Bike Storage","24/7 Security"],
    stats: { units: "90 Lofts + 14 Retail", floors: "12 Floors", area: "Mixed", price: "$1.1M", handover: "Delivered 2024" },
    developer: "Meraas Urban"
  },
  {
    id: "the-glass-pavilion",
    name: "The Glass Pavilion",
    category: "Luxury Villas",
    city: "Dubai",
    location: "Emirates Hills, Dubai",
    country: "United Arab Emirates",
    year: 2025,
    status: "Ongoing",
    tagline: "A single sculptural residence in glass, water and stone.",
    cover: "1600585154340-be6161a56a0c",
    gallery: ["1600585154340-be6161a56a0c","1564013799919-ab600027ffc6","1512917774080-9991f1c4c750","1567496898669-ee935f5f647a","1600210492486-724fe5c67fb0"],
    about: [
      "The Glass Pavilion is a one-off commission — a low, horizontal residence that seems to float on a reflecting pool, its living spaces wrapped entirely in glass.",
      "Six bedrooms, a private cinema and a wellness wing open onto a 30-metre infinity edge, with landscaping by an award-winning studio."
    ],
    amenities: ["Infinity Pool","Private Cinema","Wellness Wing","Smart Home","Staff Quarters","EV Charging"],
    stats: { units: "1 Residence", floors: "2 Storeys", area: "1,150 m²", price: "$12M", handover: "Q3 2025" },
    developer: "Omniyat"
  },
  {
    id: "heritage-row",
    name: "Heritage Row",
    category: "Residential",
    city: "London",
    location: "Kensington, London",
    country: "United Kingdom",
    year: 2023,
    status: "Completed",
    tagline: "Restored Victorian townhouses with modern cores.",
    cover: "1568605114967-8130f3a36994",
    gallery: ["1568605114967-8130f3a36994","1600585152220-90363fe7e115","1505691938895-1758d7feb511","1502005097973-6a7082348e28","1600607687939-ce8a6c25118c"],
    about: [
      "Heritage Row carefully restores a terrace of Victorian townhouses, preserving stucco façades and cornicing while inserting bright, contemporary interiors and full-height rear extensions.",
      "Each home gains a landscaped courtyard, a basement wellness suite and discreetly integrated climate control."
    ],
    amenities: ["Private Courtyard","Wellness Suite","Smart Home","Underfloor Heating","Wine Cellar","Concierge"],
    stats: { units: "8 Townhouses", floors: "4 Storeys + Basement", area: "240 m² avg", price: "$1.18M", handover: "Delivered 2023" },
    developer: "Select Group"
  },
  {
    id: "lumiere-lofts",
    name: "Lumière Lofts",
    category: "Apartments",
    city: "Paris",
    location: "Le Marais, Paris",
    country: "France",
    year: 2025,
    status: "Off-plan",
    tagline: "Light-filled duplex lofts behind a Haussmann façade.",
    cover: "1502005229762-cf1b2da7c5d6",
    gallery: ["1502005229762-cf1b2da7c5d6","1505691938895-1758d7feb511","1600566753086-00f18fb6b3ea","1567496898669-ee935f5f647a","1502005097973-6a7082348e28"],
    about: [
      "Behind a classic Haussmann façade in Le Marais, Lumière Lofts deliver a collection of double-height duplex apartments built around a glazed central courtyard.",
      "Reservations are open off-plan, with bespoke finish packages available for early buyers."
    ],
    amenities: ["Glazed Courtyard","Concierge","Smart Home","Bike Storage","Cellar Storage","Lift Access"],
    stats: { units: "16 Lofts", floors: "6 Floors", area: "165 m² avg", price: "$1.54M", handover: "Q4 2026" },
    developer: "Sobha Realty"
  },
  {
    id: "bayfront-pavilion",
    name: "Bayfront Pavilion",
    category: "Retail",
    city: "Miami",
    location: "Brickell, Miami",
    country: "United States",
    year: 2024,
    status: "Completed",
    tagline: "A waterfront retail and dining promenade.",
    cover: "1441986300917-64674bd600d8",
    gallery: ["1441986300917-64674bd600d8","1524758631624-e2822e304c36","1486406146926-c627a92ad1ab","1497366811353-6870744d04b2","1600566753086-00f18fb6b3ea"],
    about: [
      "Bayfront Pavilion lines the Brickell waterfront with flagship retail, chef-led restaurants and a shaded public promenade that comes alive after dark.",
      "Generous double-height units, full glazing and a unified canopy create a destination as much as a shopping address."
    ],
    amenities: ["Waterfront Promenade","Valet Parking","Loading Docks","24/7 Security","Outdoor Seating","EV Charging"],
    stats: { units: "18 Retail Units", floors: "2 Floors", area: "120–520 m²", price: "$6.2K/mo", handover: "Delivered 2024" },
    developer: "DAMAC Retail"
  },
  {
    id: "sakura-tower",
    name: "Sakura Tower",
    category: "Apartments",
    city: "Tokyo",
    location: "Minato, Tokyo",
    country: "Japan",
    year: 2025,
    status: "Ongoing",
    tagline: "A slender residential tower framing the city skyline.",
    cover: "1493809842364-78817add7ffb",
    gallery: ["1493809842364-78817add7ffb","1502672260266-1c1ef2d93688","1600607687939-ce8a6c25118c","1567496898669-ee935f5f647a","1505691938895-1758d7feb511"],
    about: [
      "Sakura Tower is a slender 40-storey residence in Minato, with compact, beautifully detailed apartments that make the most of every square metre.",
      "A residents' sky-lounge on the top floor frames panoramic views of the skyline and, in spring, the cherry blossom below."
    ],
    amenities: ["Sky Lounge","Fitness Studio","Concierge","Smart Home","Bicycle Parking","24/7 Security"],
    stats: { units: "210 Apartments", floors: "40 Floors", area: "45–95 m²", price: "$2.15K/mo", handover: "Q2 2026" },
    developer: "Binghatti East"
  }
];

/* ---- derived fields: numeric price/area for sorting + map coordinates ---- */
const COORDS = {
  "azure-residences": [25.080, 55.140],
  "meridian-workspaces": [1.280, 103.850],
  "palm-grove-estate": [-8.690, 115.168],
  "highline-quarter": [40.746, -74.005],
  "the-glass-pavilion": [25.060, 55.160],
  "heritage-row": [51.499, -0.193],
  "lumiere-lofts": [48.860, 2.360],
  "bayfront-pavilion": [25.760, -80.193],
  "sakura-tower": [35.658, 139.751]
};

function parsePrice(str){
  const m = str.replace(/[, ]/g, '').match(/([\d.]+)\s*([MK]?)/i);
  if(!m) return 0;
  let n = parseFloat(m[1]);
  if(/m/i.test(m[2])) n *= 1e6;
  else if(/k/i.test(m[2])) n *= 1e3;
  return n;
}
function parseArea(str){
  const m = str.replace(/,/g, '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

window.PROJECTS.forEach(p => {
  p.priceValue = parsePrice(p.stats.price);
  p.isRental = /\/mo/i.test(p.stats.price);
  p.areaValue = parseArea(p.stats.area);
  p.coords = COORDS[p.id] || [0, 0];
});
