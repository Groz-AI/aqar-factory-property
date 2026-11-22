// English translations of the 3 review-sample pages, block-for-block from
// each page's own Arabic article (same order, same images, same buttons).
// Every number, price, size and name is copied from the source.
const IMG = 'https://pub-8984ca4087bd4a4e8908ca76e2fc6828.r2.dev/';
const S = 'https://www.aqar-factory.com';

const btn = (label, message) => ({ type: 'button', url: '', text: '', image: '', label, message, whatsapp: true });
const h = (text) => ({ type: 'heading', text, image: '' });
const p = (text) => ({ type: 'paragraph', text, image: '' });
const img = (file) => ({ type: 'image', text: '', image: IMG + file });
const table = (rows, head) =>
  '<table>' + (head ? `<tr>${head.map((c) => `<td><b>${c}</b></td>`).join('')}</tr>` : '') +
  rows.map((r) => `<tr>${r.map((c, i) => (i === 0 && !head ? `<td><b>${c}</b></td>` : `<td>${c}</td>`)).join('')}</tr>`).join('') + '</table>';

const TAWNY_BTN = () => btn('Contact us for the launch price and exclusive offers', "Hello, I'd like to know more about this project and get the launch price and available offers.");
const QUEEN_BTN = () => btn('Book your unit now on WhatsApp', "Hello, I'd like more details about the available units and sizes at Queen Valley New Cairo.");
const BLOG_BTN = TAWNY_BTN;
const SALES = 'Contact our sales team now:<br>Call us on 01064811113<br>Or on WhatsApp: 01064811113';

module.exports = {
  projects: {
    'tawny-hyde-park-october': {
      about_blocks: [
        h('Tawny Hyde Park Developer'),
        p("Hyde Park Developments is one of the leading names in Egypt's real estate market, operating under its current name since 2011. Its board of directors is chaired by Eng. Essam Mohamed Mahmoud Abou Hamed, alongside a group of senior businesspeople and engineers.<br><br>To date, the company has delivered more than 1,000 residential units across its projects. Its best-known developments in Egypt include Hyde Park New Cairo and the Coast 82 resort on the North Coast."),
        img('1788127803539-k0we0o.jfif'),
        TAWNY_BTN(),
        h('Tawny Hyde Park Location'),
        p('Tawny Hyde Park October sits in the heart of 6th of October City, directly behind Palm Hills Golf and facing Al Gezira Sporting Club, just 3 minutes from Mall of Egypt and Mall of Arabia. The project is also close to main roads including Al Mehwar Road, the Wahat (Oasis) Road, the Cairo–Alexandria Desert Road and the 26th of July Axis.<br><br>Tawny Hyde Park is about 15 minutes from Dandy Mall, around 20 minutes from the Grand Egyptian Museum and only about 25 minutes from the Pyramids area. The compound is also close to well-regarded international schools such as Al Alsson Language Schools and the Lycée Français schools.'),
        img('1788127886899-c141p0.jfif'),
        h('Tawny Hyde Park October'),
        p("Tawny Hyde Park October is one of Hyde Park Developments' standout projects in 6th of October City, offering a European-inspired residential concept that combines luxury, privacy and generous green spaces.<br><br>The project has a limited number of units — no more than 216 — spread across 31 feddans, giving every villa ample distance from its neighbors and reinforcing a sense of calm and privacy inside the compound, whether you're looking for a permanent home or a real estate investment."),
        TAWNY_BTN(),
        h('Tawny Hyde Park October: Prices, Units and Payment Plans'),
        p(table([
          ['Project name', 'Tawny Hyde Park October'],
          ['Project location', 'Behind Palm Hills Golf, directly facing Al Gezira Club, near Mall of Egypt, 6th of October'],
          ['Developer', 'Hyde Park Developments'],
          ['Project area', '31 feddans'],
          ['Number of units', '216 units across 4 phases'],
          ['Unit types', 'Standalone villas, twin houses, townhouses, quad villas'],
          ['Down payment', '5%'],
          ['Installment period', 'Up to 8 years'],
          ['Prices start from', 'EGP 22,840,000'],
        ]) +
          '<br><b>Tawny Hyde Park Prices</b><br>Tawny Hyde Park prices vary by unit type, size and position within the master plan. The table below shows the starting price for each type:' +
          table([['Townhouse', '22,840,000'], ['Twin house', '26,380,000'], ['Standalone villa', '47,940,000']], ['Unit type', 'Starting price (EGP)']) +
          "The available sources don't state a fixed price per square meter for each unit type, so it's best to contact the sales team directly for the latest prices.<br><br>" + SALES),
        img('1788127919003-9rp007.jfif'),
        TAWNY_BTN(),
        h('Tawny Hyde Park Units and Sizes'),
        p('The project offers four main villa types to suit different tastes and needs: the standalone villa, the twin house, the townhouse (in middle and corner versions) and the quad villa.<br><br>The table below shows how many units of each type there are and their approximate sizes:' +
          table([
            ['Standalone villa', '20', 'From 288 m²'],
            ['Twin house', '66', '208 – 280 m²'],
            ['Townhouse (middle)', '90', 'From 246 m²'],
            ['Quad villa', '40', 'From 240 m²'],
          ], ['Unit type', 'Number of units', 'Approximate size']) +
          'Sizes are approximate and may change by phase and availability — contact us directly for the latest update.'),
        TAWNY_BTN(),
        h('Tawny Hyde Park Payment Plan'),
        p("Hyde Park Developments offers Tawny Hyde Park buyers a flexible payment plan: a reservation down payment of just 5% of the unit's total price, with the remaining balance paid in equal installments over up to 8 years. There's no need to pay the full amount at once, which eases the financial pressure and gives buyers more flexibility in planning their budget."),
        img('1788128043377-qeudlx.jfif'),
        TAWNY_BTN(),
        h('Tawny Hyde Park Facilities'),
        p('The compound offers a range of services that keep the quality of life high, including:<br>• Wide green spaces and artificial lakes surrounding most units.<br>• Dedicated cycling paths inside the compound.<br>• A maintenance team that fixes any issues in shared facilities promptly.<br>• A cleaning team working regularly across the whole project.<br>• Low density (only 216 units on 31 feddans), giving each villa more privacy.'),
        h('Investing in Tawny Hyde Park'),
        p("Many property seekers ask whether Tawny Hyde Park is a good investment. The answer comes down to several factors in the project's favor — chief among them strong rental demand for its units in West Cairo, which gives investors a steady monthly income, and the units' ability to hold their capital value through market swings.<br><br>It can also deliver a good return on resale, thanks to the limited number of units and high demand for them. Note that the share of units ready for immediate delivery is still limited for now, although the developer is speeding up construction to shorten waiting times for buyers."),
        TAWNY_BTN(),
        p('<b>Where is Tawny Hyde Park located?</b><br>Behind Palm Hills Golf, directly facing Al Gezira Club, and near Mall of Egypt in 6th of October City.<br><br>' +
          "<b>What are Tawny Hyde Park's unit prices?</b><br>Prices start from around EGP 22,840,000 for townhouses and rise depending on unit type and size, reaching around EGP 47,940,000 for standalone villas.<br><br>" +
          '<b>What are the payment plans for Tawny Hyde Park October?</b><br>A 5% reservation down payment, with the rest paid in equal installments over up to 8 years.<br><br>' +
          '<b>What unit types does Tawny Hyde Park October offer?</b><br>Standalone villas, twin houses, townhouses (middle and corner) and quad villas, spread across 4 phases.<br><br>' +
          '<b>Who is the developer of Tawny Hyde Park?</b><br>The developer is Hyde Park Developments.<br><br>' +
          '<b>When will Tawny Hyde Park units be delivered?</b><br>The company has not yet announced a single delivery date, so contact the sales team directly for the latest update.<br><br>' +
          '<b>Is Tawny Hyde Park a good investment?</b><br>Yes — thanks to the limited number of units and strong rental demand in the area, it is a good option for rental income or resale returns.<br><br>' + SALES),
        TAWNY_BTN(),
      ],
    },
    'queen-valley-new-cairo': {
      about_blocks: [
        h('About Queen Valley New Cairo'),
        p("If you're looking for a real investment or an upscale home in the heart of the Fifth Settlement, Queen Valley offers an integrated community on just 25 feddans, with a building footprint of no more than 23% so you can enjoy calm and green space. The project follows a modern design (ground floor plus 5 floors), with two elevators on every floor to ensure full privacy and comfort for residents."),
        QUEEN_BTN(),
        h('A Strategic Location Directly on the AUC Axis'),
        p("The compound holds a unique location in the heart of New Cairo, directly on the AUC Axis, making it a key connection point close to the area's main roads and districts."),
        img('1789333908287-r104gy.jpeg'),
        QUEEN_BTN(),
        h('Unit Sizes'),
        p('Unit sizes vary to suit different needs, with prices starting from EGP 36,900 per square meter, as follows:<br>• Studio / one-bedroom units from 55 m² to 81 m².<br>• Two-bedroom apartments from 100 m² to 131 m².<br>• 3-bedroom apartments from 144 m² to 158 m².<br>• Duplex units from 227 m² to 261 m².<br>• All units are delivered Core & Shell, giving owners full freedom over the interior finishing.'),
        img('1789333926953-sjd4x2.jpeg'),
        QUEEN_BTN(),
        h('Payment Plans and Installment Options'),
        p('Flexible payment plans stretched over long periods ease the financial load on buyers, with the following options:<br>• 0% down payment, equal installments over 8 years, no extra lump-sum payments<br>• 5% down payment, equal installments over 9 years, no extra lump-sum payments<br>• 10% down payment, equal installments over 10 years, no extra lump-sum payments<br>• 20% down payment, equal installments over 12 years, no extra lump-sum payments<br>• A 10% maintenance deposit is added, plus EGP 200,000 for the garage, paid in installments over the first 4 years. Delivery within 4 years.'),
        img('1789333964787-xie2zt.jpeg'),
        QUEEN_BTN(),
        h('Services and Facilities in the Compound'),
        p("The compound includes many leisure services for residents' daily needs, including:<br>• 4 clubhouses and 4 swimming pools.<br>• Sports courts for padel, tennis and football.<br>• A gym and spa, plus an indoor swimming pool for women.<br>• A dedicated pet area and a kids' play area.<br>• Underground garages and electric-car charging stations.<br>• Smart infrastructure across the whole compound, with Triple Play service from Vodafone.<br>• Prayer areas and a mosque, a small church, and running and cycling tracks."),
        QUEEN_BTN(),
        p("<b>Additional Information and the Project's Engineering Consultant</b><br>The project's engineering consultancy is handled by MTRK – Metric Design Studio, which has previous experience on projects such as Al Cazar and Soma Bay, while construction is carried out by Al-Lawendy Contracting (a Grade A company with 25 years of experience), ensuring adherence to engineering standards and delivery timelines."),
        QUEEN_BTN(),
      ],
    },
  },
  blog_posts: {
    'branded-residences-north-coast-investment-trends': {
      title: 'A Shake-Up in North Coast Hotel Real Estate: How Have Global Brands Changed the 2026 Investment Map?',
      excerpt: 'A realistic review of the branded hotel-apartment trend on the North Coast, and the difference between a traditional chalet and a hotel property managed by global brands such as Nobu and IHG.',
      blocks: [
        h('Globally Managed Hotel Properties | When a Chalet Becomes a Hard-Currency Income Machine'),
        p(`Egypt's North Coast is seeing a fundamental shift in buying and investment behavior in 2026: traditional chalets that sit closed most of the year are losing their appeal, giving way entirely to the branded residences trend. The new formula is a clever one — major developers no longer just build luxury walls, they bring in global hotel brands to manage and maintain coastal resorts and back them with international rental programs. That gives investors a self-operating property (turnkey ownership) that generates strong hotel-level investment and operating returns, which we break down with numbers on <a href="${S}/">Aqar Factory</a>.`),
        BLOG_BTN(),
        h("From Cairo's Towers to Ras El Hekma's Beaches | How the Branded Residences Culture Moved to the Coast"),
        p('Investing in hotel real estate and units managed by luxury brands has long been a familiar idea to major investors in central Cairo and the new cities, where hotels and residential and administrative towers have been hugely successful. The surprise — and the real shift — in 2026 is that this smart investment culture has moved to the coast: summer chalets are turning from seasonal properties that sit closed into branded hotel units and villas that run efficiently all year round. That gives investors operating and dollar-linked returns that traditional properties simply don\'t offer, and the change is clearly visible in what buyers are searching for.'),
        h('1. Nobu Hotel & Villas Ras El Hekma | The Exclusive Strategic Partnership Between SODIC and NOBU'),
        p(`<a href="${S}/project/nobu-residences-north-coast-sodic">Nobu Residences North Coast</a>, a partnership between SODIC and the Nobu brand (co-founded by Robert De Niro), spans 34 feddans in Ogami village (km 188) with a 150-meter private beach. Units are delivered fully finished, furnished and serviced according to the Japanese "Nagomi" philosophy. Prices start from EGP 35 million for hotel rooms and EGP 30 million for apartments, with a payment plan starting at a 15% down payment and installments over up to 8 years. When a developer of SODIC's size and track record teams up with a global hotel brand like Nobu, expect a product that's different by every measure.`),
        img('1788644604120-tz4feb.jpeg'),
        BLOG_BTN(),
        h('2. The Residence Mountain View Ras El Hekma | Modern Hotel Hospitality with IHG'),
        p(`Meanwhile, Mountain View tried something new this summer with a new global product in partnership with IHG: <a href="${S}/project/the-residence-mountain-view-ihg">The Residence | Mountain View &amp; IHG</a> in Ras El Hekma, a distinctive hotel experience next to Hotel Indigo. The project offers apartments starting from 65 m², with prices starting from EGP 15 million for fully finished units and EGP 17 million for fully furnished units, plus integrated services and payment plans of up to 8 years with a 2.5% down payment.`),
        img('1788644363135-z1yf3d.jpeg'),
        BLOG_BTN(),
        h('How Buyers Are Sorting Their Options — and Is Now the Time to Decide?'),
        p(`Coastal investment has become a safe haven for protecting capital value and earning high rental returns, thanks to global hotel management. You can browse the full details on our <a href="${S}/projects.html">real estate projects in Egypt</a> page and compare them in the <a href="${S}/units.html">apartments and units for sale</a> section to catch standout investment opportunities.`),
        img('1788644623394-2b7ww3.jpeg'),
        BLOG_BTN(),
      ],
    },
  },
};
