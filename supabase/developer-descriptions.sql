-- Developer descriptions (EN + AR), Arabic names and search titles for the developers with the most projects.
-- Safe to re-run: fills only empty fields, except Marakez whose text was in the wrong language column.
-- Run:  docker exec -i supabase-db psql -U postgres -d postgres < developer-descriptions.sql

begin;

-- SODIC
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$سوديك$q$),
  description = coalesce(nullif(description, ''), $q$About SODIC

SODIC (the Sixth of October Development and Investment Company) is an Egyptian real estate developer founded in 1996 and listed on the Egyptian Exchange. It started in West Cairo and has since expanded into some of the most sought-after destinations in the country.

On Aqar Factory you can browse SODIC projects such as Karmell in New Zayed, The Estates Residences in Sheikh Zayed City, SODIC East in New Heliopolis and Eastvale in Mostakbal City. On the coast, SODIC is behind Nobu Residences and Ogami, a resort inspired by Japanese culture, both in Ras El Hekma on the North Coast, with hotel-style services.

Units range from family apartments and villas inside compounds to fully finished branded resort residences, and the projects are at different stages, from completed to off-plan launches. Each project page shows the starting price, payment plan, delivery details and unit types so you can compare them side by side.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن سوديك

سوديك (شركة السادس من أكتوبر للتنمية والاستثمار) شركة تطوير عقاري مصرية تأسست عام 1996 ومُدرجة في البورصة المصرية. بدأت نشاطها في غرب القاهرة ثم توسعت إلى عدد من أكثر الوجهات طلبًا في مصر.

يمكنك عبر Aqar Factory تصفح مشروعات سوديك، ومنها كارميل في زايد الجديدة، وذا استيتس ريزيدنسز في الشيخ زايد، وسوديك إيست في هليوبوليس الجديدة، وإيست فيل في مدينة المستقبل. وعلى الساحل تطرح الشركة مشروعي نوبو ريزيدنسز وأوجامي، المستوحى من الثقافة اليابانية، في رأس الحكمة بالساحل الشمالي، وكلاهما بخدمات على الطراز الفندقي.

تتنوع الوحدات بين شقق وفيلات عائلية داخل الكمبوندات ووحدات فندقية متكاملة التشطيب، وتتفاوت مراحل المشروعات بين مكتملة وأخرى في مرحلة الإطلاق. وتعرض صفحة كل مشروع سعر البداية وخطة السداد وتفاصيل الاستلام وأنواع الوحدات لتسهيل المقارنة.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$SODIC Egypt | Projects, Prices & Payment Plans$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore SODIC projects in Egypt: Karmell, The Estates, SODIC East, Eastvale and North Coast resorts, with prices, unit types and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مشروعات سوديك | الأسعار وخطط السداد$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات سوديك في مصر: كارميل وذا استيتس وسوديك إيست وإيست فيل ومشروعات الساحل الشمالي، مع الأسعار وأنواع الوحدات وخطط السداد.$q$)
where id = '0646ecde-435a-4781-bee0-a117e48f2747';

-- IL CAZAR
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$إل كازار$q$),
  description = coalesce(nullif(description, ''), $q$About IL CAZAR

IL CAZAR is a real estate developer with projects across West Cairo, New Cairo, central Cairo and the North Coast. Its projects are known for their design partnerships: VÉA and The Crest were designed with architect Raef Fahmy, while Westdays carries the design of the international studio METRIK.

On Aqar Factory you can browse IL CAZAR projects such as VÉA and Glen in the Sixth Settlement, The Crest on South 90th Street in the Fifth Settlement, Westdays in 6th of October, Stoda Residence near Sheraton and Cairo Airport, and The C village on the North Coast. They include independent villas, apartments, ready-to-move units and vacation homes.

Every project page lists the starting price, payment plan and handover details, so you can compare IL CAZAR's compounds with similar projects in the same area before you decide.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن إل كازار

تطرح شركة إل كازار مشروعات سكنية وسياحية في غرب القاهرة والقاهرة الجديدة وشيراتون والساحل الشمالي، وتشتهر بالتعاون مع مصممين معروفين؛ فقد صُمم مشروعا فيا وذا كريست بتوقيع المهندس رائف فهمي، بينما يحمل مشروع ويست دايز تصميم شركة METRIK العالمية.

يمكنك عبر Aqar Factory تصفح مشروعات إل كازار مثل فيا وجلين في التجمع السادس، وذا كريست على شارع التسعين الجنوبي في التجمع الخامس، وويست دايز في 6 أكتوبر، وستودا ريزيدنس بالقرب من شيراتون ومطار القاهرة، وقرية ذا سي في الساحل الشمالي. وتشمل الوحدات فيلات مستقلة وشققًا ووحدات جاهزة للاستلام وبيوتًا للمصيف.

وتعرض صفحة كل مشروع سعر البداية وخطة السداد وتفاصيل الاستلام لتتمكن من المقارنة بين كمبوندات الشركة والمشروعات المشابهة في المنطقة نفسها قبل اتخاذ القرار.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$IL CAZAR Egypt | Projects, Prices & Payment Plans$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse IL CAZAR projects in New Cairo, 6th of October, Cairo and the North Coast: VÉA, The Crest, Glen, Westdays and more, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مشروعات إل كازار | الأسعار وخطط السداد$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات إل كازار في القاهرة الجديدة و6 أكتوبر والساحل الشمالي: فيا وذا كريست وجلين وويست دايز وغيرها، مع الأسعار وخطط السداد.$q$)
where id = '7ae09c53-fccd-46a6-a240-14b194e9d5d9';

-- KAYAN
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$كيان$q$),
  description = coalesce(nullif(description, ''), $q$About KAYAN

KAYAN develops residential and commercial projects for buyers looking for a more accessible way into new communities east and west of Cairo. Its portfolio on Aqar Factory is concentrated in New Obour City, with a commercial project in 6th of October.

The New Obour projects include Mirissa, which is built around smart-home technology, Waad Compound, and AAHD Compound, which is centered on a landscaped central garden. NASA New Aqmar Social Avenue is a commercial destination in 6th of October for business owners and investors. Launches usually come with low or flexible down payments and installment plans that stretch over several years, which each project page spells out.

Most KAYAN projects are at the ongoing or off-plan stage, so it is worth checking each project's delivery date and payment schedule. Aqar Factory can compare KAYAN's offers with other New Obour compounds and arrange a site visit for you.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن كيان

تطرح شركة كيان مشروعات سكنية وتجارية موجهة لمن يبحثون عن بداية أيسر للتملك في مجتمعات عمرانية جديدة شرق القاهرة وغربها، وتتركز مشروعاتها المتاحة على Aqar Factory في العبور الجديدة مع مشروع تجاري في 6 أكتوبر.

تضم مشروعات العبور الجديدة ميريسا القائم على تقنيات السكن الذكي، وكمبوند وعد، وعهد كمبوند الذي تتوسطه حديقة مركزية. أما ناسا نيو أقمار سوشيال أفينيو فهو وجهة تجارية في 6 أكتوبر لأصحاب الأعمال والمستثمرين. وغالبًا ما تأتي الطروحات بمقدمات منخفضة أو مرنة وأقساط تمتد لعدة سنوات، وتوضح صفحة كل مشروع تفاصيلها.

ومعظم مشروعات كيان في مرحلة الإنشاء أو الإطلاق، لذا من المهم مراجعة موعد الاستلام وجدول السداد لكل مشروع. ويمكن لفريق Aqar Factory مقارنة عروض كيان بكمبوندات العبور الجديدة الأخرى وترتيب زيارة للموقع.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$KAYAN Egypt | New Obour Projects & Payment Plans$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore KAYAN projects in New Obour City and 6th of October: Mirissa, Waad, AAHD and NASA New Aqmar, with prices, payment plans and delivery dates.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مشروعات كيان | العبور الجديدة وخطط السداد$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات كيان في العبور الجديدة و6 أكتوبر: ميريسا ووعد وعهد وناسا نيو أقمار، مع الأسعار وخطط السداد ومواعيد الاستلام.$q$)
where id = 'a933ee9f-7017-4bf9-bdfd-f369c55e4f2e';

-- ORA Development
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$أورا للتطوير العقاري$q$),
  description = coalesce(nullif(description, ''), $q$About ORA

ORA is a real estate developer founded by Naguib Sawiris, known for large mixed-use destinations and hospitality-led residences. Its projects on Aqar Factory span New Cairo and the North Coast.

In the Fifth Settlement, Solana East offers GARDINN, fully managed and fully finished hotel apartments, and Eastlane Premium Clinics, a medical building for clinic ownership. Club Residence in ZED East is a completed residential phase overlooking the sports club, with hotel-style service. On the North Coast, Silversands brings Caribbean-style living to the Mediterranean coast.

Whether you are looking for a managed hotel apartment, a family residence, a clinic or a vacation home, each project page shows the starting price, payment plan and delivery stage so you can compare them.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن أورا

أورا شركة تطوير عقاري أسسها نجيب ساويرس، وتشتهر بالوجهات المتكاملة متعددة الاستخدامات والمشروعات السكنية ذات الطابع الفندقي. وتمتد مشروعاتها على Aqar Factory بين القاهرة الجديدة والساحل الشمالي.

في التجمع الخامس يقدم مشروع سولانا إيست مرحلة جاردين للشقق الفندقية المدارة بالكامل والمتكاملة التشطيب، ومبنى إيست لين بريميوم كلينيكس لتملك العيادات الطبية، بينما تمثل كلوب ريزيدنس في زد إيست مرحلة سكنية مكتملة تطل على النادي الرياضي وتوفر خدمة فندقية. وعلى الساحل الشمالي يقدم سيلفر ساندس أسلوب حياة مستوحى من الكاريبي على ساحل المتوسط.

وسواء كنت تبحث عن شقة فندقية مدارة أو سكن عائلي أو عيادة أو بيت للمصيف، تعرض صفحة كل مشروع سعر البداية وخطة السداد ومرحلة الاستلام لتسهيل المقارنة.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$ORA Egypt | Solana East, ZED East & Silversands$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse ORA projects in New Cairo and the North Coast: Solana East, ZED East and Silversands, with prices, payment plans and delivery stages.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مشروعات أورا | سولانا إيست وزد إيست وسيلفر ساندس$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات أورا في القاهرة الجديدة والساحل الشمالي: سولانا إيست وزد إيست وسيلفر ساندس، مع الأسعار وخطط السداد ومراحل الاستلام.$q$)
where id = 'eee3398d-e2e7-4115-8061-7d9b9d3fcf0a';

-- HDP
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$إتش دي بي$q$),
  description = coalesce(nullif(description, ''), $q$About HDP

HDP develops residential and mixed-use projects in the New Administrative Capital and West Cairo. Its portfolio on Aqar Factory includes communities that have already been delivered as well as a new off-plan launch.

In the New Capital, La Vista City and R-FIVE are completed residential projects, which suits buyers who want to move in or rent out soon. In 6th of October, Navy 26 is a mixed-use project that combines business and lifestyle spaces and is currently offered at the off-plan stage.

Each project page shows the starting price, unit types and payment options, and Aqar Factory can share current availability and arrange a visit to any of them.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن إتش دي بي

تطرح شركة إتش دي بي مشروعات سكنية ومتعددة الاستخدامات في العاصمة الإدارية الجديدة وغرب القاهرة. وتضم محفظتها على Aqar Factory مجتمعات تم تسليمها بالفعل إلى جانب طرح جديد قيد الإنشاء.

في العاصمة الإدارية تقدم الشركة مشروعي لافيستا سيتي وآر فايف السكنيين المكتملين، وهما مناسبان لمن يرغب في السكن أو التأجير في وقت قريب. وفي 6 أكتوبر يأتي مشروع نيفي 26 متعدد الاستخدامات الذي يجمع بين مساحات العمل ونمط الحياة، وهو متاح حاليًا في مرحلة الإطلاق.

وتعرض صفحة كل مشروع سعر البداية وأنواع الوحدات وخيارات السداد، ويمكن لفريق Aqar Factory إطلاعك على المتاح حاليًا وترتيب زيارة لأي منها.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$HDP Egypt | New Capital & 6th of October Projects$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore HDP projects: La Vista City and R-FIVE in the New Capital and Navy 26 in 6th of October, with prices, unit types and payment options.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مشروعات إتش دي بي | العاصمة الإدارية و6 أكتوبر$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات إتش دي بي: لافيستا سيتي وآر فايف في العاصمة الإدارية ونيفي 26 في 6 أكتوبر، مع الأسعار وأنواع الوحدات وخيارات السداد.$q$)
where id = '160bff66-7909-4d0e-8e0e-bf5f3b2e0287';

-- Hyde Park Developments
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$هايد بارك للتطوير العقاري$q$),
  description = coalesce(nullif(description, ''), $q$About Hyde Park Developments

Hyde Park Developments builds residential communities in East and West Cairo. Its projects on Aqar Factory are located in the Fifth Settlement, the Sixth Settlement in New Cairo, and 6th of October.

Hyde Park One brings a single destination to the heart of the Fifth Settlement, while Hyde Park Central in the Sixth Settlement is an off-plan launch built around an all-in-one community lifestyle. In 6th of October, Tawny Hyde Park offers finished villas and townhouses behind the Palm Hills golf course, facing Gezira Club, and is already delivered.

Compare the starting prices, unit types and payment plans on each project page, then contact Aqar Factory for current availability or to book a visit to the Hyde Park projects that interest you.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن هايد بارك للتطوير العقاري

تطرح شركة هايد بارك للتطوير العقاري مجتمعات سكنية في شرق القاهرة وغربها، وتقع مشروعاتها على Aqar Factory في التجمع الخامس والتجمع السادس بالقاهرة الجديدة و6 أكتوبر.

يقدم هايد بارك ون وجهة واحدة متكاملة في قلب التجمع الخامس، بينما يأتي هايد بارك سنترال في التجمع السادس كطرح قيد الإنشاء يقوم على فكرة المجتمع المتكامل. وفي 6 أكتوبر يقدم تاوني هايد بارك فيلات وتاون هاوس بتشطيب فاخر خلف ملعب الجولف الخاص ببالم هيلز ومواجهًا لنادي الجزيرة، وهو مشروع تم تسليمه بالفعل.

قارن بين أسعار البداية وأنواع الوحدات وخطط السداد في صفحة كل مشروع، ثم تواصل مع Aqar Factory لمعرفة المتاح حاليًا أو لحجز زيارة لمشروعات هايد بارك التي تهمك.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$Hyde Park Developments | Projects & Payment Plans$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse Hyde Park projects: Hyde Park One, Hyde Park Central and Tawny Hyde Park in New Cairo and 6th of October, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مشروعات هايد بارك | الأسعار وخطط السداد$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات هايد بارك: هايد بارك ون وهايد بارك سنترال وتاوني هايد بارك في القاهرة الجديدة و6 أكتوبر، مع الأسعار وخطط السداد.$q$)
where id = 'd2fab5f7-1bb3-45f9-aa6c-9278f8a03c6d';

-- Lasirena Group
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$مجموعة لاسيرينا$q$),
  description = coalesce(nullif(description, ''), $q$About Lasirena Group

Lasirena Group develops beach resorts on the Red Sea coast. Its projects on Aqar Factory are in Ain Sokhna and Ras Sedr, within driving distance of Cairo for weekend getaways.

Lasirena Mini Egypt in Ain Sokhna is a resort themed around the landmarks of Egyptian civilization, offering chalets and duplexes with long installment plans. Lasirena Palm Beach, also in Ain Sokhna, is a completed resort on a wide sandy beach, and La Vento in Ayoun Moussa, Ras Sedr offers fully finished chalets that are ready for delivery.

Chalet prices and payment plans differ from one resort to another, so use each project page to compare them, and contact Aqar Factory for current offers or to arrange a visit.

$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن مجموعة لاسيرينا

تطور مجموعة لاسيرينا قرى سياحية على ساحل البحر الأحمر، وتقع مشروعاتها على Aqar Factory في العين السخنة ورأس سدر، على مسافة قريبة بالسيارة من القاهرة لقضاء عطلات نهاية الأسبوع.

تقدم لاسيرينا ميني إيجيبت في العين السخنة قرية سياحية مستوحاة من معالم الحضارة المصرية بشاليهات ودوبلكس وخطط تقسيط ممتدة، بينما تمثل لاسيرينا بالم بيتش في العين السخنة قرية مكتملة على شاطئ رملي واسع، ويقدم مشروع لافينتو في عيون موسى برأس سدر شاليهات كاملة التشطيب جاهزة للاستلام.

وتختلف أسعار الشاليهات وخطط السداد من قرية إلى أخرى، لذا يمكنك المقارنة بينها من صفحة كل مشروع، ثم التواصل مع Aqar Factory لمعرفة العروض الحالية أو ترتيب زيارة.

$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$Lasirena Group | Ain Sokhna & Ras Sedr Chalets$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore Lasirena resorts in Ain Sokhna and Ras Sedr: Mini Egypt, Palm Beach and La Vento chalets with prices and installment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مجموعة لاسيرينا | شاليهات العين السخنة ورأس سدر$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على قرى لاسيرينا في العين السخنة ورأس سدر: ميني إيجيبت وبالم بيتش ولافينتو، مع أسعار الشاليهات وخطط التقسيط.$q$)
where id = '49e8e296-03f8-4494-829e-219a68f2a9ca';

-- tatweer
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$تطوير مصر$q$),
  description = coalesce(nullif(description, ''), $q$About Tatweer Misr

Tatweer Misr develops residential communities and coastal resorts. Its projects on Aqar Factory include Bloomfields and Scenes in Mostakbal City, New Cairo, and Salt Marina in Ras El Hekma on the North Coast.

Bloomfields is a completed community offering apartments with quick handover. Scenes offers villas and townhouses with delivery within two years and installment plans spread over several years. Salt Marina is an off-plan resort with chalets and townhouses on the North Coast.

Each project page shows the starting price, payment plan and delivery details, so you can compare Tatweer Misr's offers across New Cairo and the coast. Aqar Factory can share the latest availability and arrange a visit.

$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن تطوير مصر

تطرح شركة تطوير مصر مجتمعات سكنية وقرى ساحلية، ومن مشروعاتها على Aqar Factory بلومفيلدز وسينز في مدينة المستقبل بالقاهرة الجديدة، وسولت مارينا في رأس الحكمة بالساحل الشمالي.

بلومفيلدز مجتمع سكني مكتمل يقدم شققًا بتسليم سريع، بينما يقدم سينز فيلات وتاون هاوس باستلام خلال سنتين وخطط تقسيط تمتد لعدة سنوات. أما سولت مارينا فهي قرية قيد الإطلاق بشاليهات وتاون هاوس على الساحل الشمالي.

وتعرض صفحة كل مشروع سعر البداية وخطة السداد وتفاصيل الاستلام لتتمكن من المقارنة بين عروض تطوير مصر في القاهرة الجديدة والساحل. ويمكن لفريق Aqar Factory إطلاعك على المتاح حاليًا وترتيب زيارة.

$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$Tatweer Misr | Bloomfields, Scenes & Salt Marina$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore Tatweer Misr projects in Mostakbal City and Ras El Hekma: Bloomfields, Scenes and Salt Marina, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$تطوير مصر | بلومفيلدز وسينز وسولت مارينا$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات تطوير مصر في مدينة المستقبل ورأس الحكمة: بلومفيلدز وسينز وسولت مارينا، مع الأسعار وخطط السداد.$q$)
where id = '41359dcb-c10d-40eb-a343-9734f659c215';

-- Qatari Diar
update public.developers set
  description = coalesce(nullif(description, ''), $q$About Qatari Diar

Qatari Diar is a real estate investment company owned by the Qatar Investment Authority. Established in 2005, it has a portfolio of international projects spread across more than 20 countries, which gives it broad experience in developing large communities, tourist destinations and hotels.

In Egypt, its land bank is reported to exceed 50 million square meters, split between residential projects in East and West Cairo and new coastal expansions on the Mediterranean and the Red Sea. Its assets in Egypt include CityGate in New Cairo, New Giza in 6th of October, a recently announced 29-million-square-meter site between Makadi and Soma Bay on the Red Sea, and the St. Regis Cairo hotel on the Nile Corniche.

On Aqar Factory you can browse Alam El Roum on the North Coast and the Sapphire Riverside phase of CityGate New Cairo, with prices, payment plans and delivery details on each project page.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse Qatari Diar projects in Egypt: Alam El Roum on the North Coast and CityGate New Cairo, with prices, payment plans and delivery details.$q$)
where id = 'add9c4eb-d480-4e2b-b0df-b1b4230935d6';

-- Marakez
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$مراكز$q$),
  description = $q$About Marakez

Marakez is a regional real estate developer and operator affiliated with Saudi Arabia's Fawaz Alhokair Group. It is known for developing and running large projects that combine upscale living with major retail destinations, such as Mall of Arabia in 6th of October and District 5 in the Fifth Settlement, as well as Ramla on the North Coast and Shams in Soma Bay on the Red Sea.

On Aqar Factory you can browse Crescent Walk in the Sixth Settlement, New Cairo, whose homes have ceilings of more than 3.9 meters, and Shams Soma Bay, a beachfront resort of chalets and villas next to Cholan with a 700-meter shoreline.

Marakez's record in operating and delivering large projects gives buyers and investors a useful reference point for build quality and delivery. Each project page shows the starting price, payment plan and delivery details.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$,
  description_ar = $q$نبذة عن مراكز

مراكز العقارية (MARAKEZ) إحدى الشركات الإقليمية الكبرى التابعة لمجموعة فواز الحكير السعودية، وتشتهر بتطوير وتشغيل مشروعات ضخمة تجمع بين السكن الراقي والمراكز التجارية الكبرى، مثل مول العرب في مدينة 6 أكتوبر ومشروع ديستريكت 5 في التجمع الخامس، إلى جانب رملة في الساحل الشمالي وشمس سوما باي في البحر الأحمر.

يمكنك عبر Aqar Factory تصفح مشروع كريسنت ووك في التجمع السادس بالقاهرة الجديدة، الذي تتميز بيوته بأسقف يزيد ارتفاعها على 3.9 متر، ومشروع شمس سوما باي، وهو قرية على البحر من شاليهات وفيلات بجوار شولان بواجهة شاطئية طولها 700 متر.

ويمنح سجل مراكز في تشغيل المشروعات الكبرى وتسليمها المشترين والمستثمرين مرجعًا مفيدًا لجودة التنفيذ والالتزام بالتسليم. وتعرض صفحة كل مشروع سعر البداية وخطة السداد وتفاصيل الاستلام.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$,
  seo_title = coalesce(nullif(seo_title, ''), $q$Marakez Egypt | Crescent Walk & Shams Soma Bay$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore Marakez projects in Egypt: Crescent Walk in New Cairo and Shams Soma Bay on the Red Sea, with prices, payment plans and delivery details.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مراكز | كريسنت ووك وشمس سوما باي$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات مراكز في مصر: كريسنت ووك في القاهرة الجديدة وشمس سوما باي على البحر الأحمر، مع الأسعار وخطط السداد وتفاصيل الاستلام.$q$)
where id = '96c08c2a-d549-4d35-8f57-e7355aca4cb7';

-- Mountain View Developments (Arabic name only)
update public.developers set name_ar = coalesce(nullif(name_ar, ''), $q$ماونتن فيو$q$) where id = '786c2be3-66f5-41ff-9e74-9a8bd4c858cd';

-- ORASCOM (Arabic name only)
update public.developers set name_ar = coalesce(nullif(name_ar, ''), $q$أوراسكوم للتنمية$q$) where id = 'bf6cad8d-e9ca-4897-9f36-3caa5ff052fc';

commit;

-- check
select name, name_ar, length(description) as en_chars, length(description_ar) as ar_chars from public.developers
where name in ('SODIC', 'IL CAZAR', 'KAYAN', 'ORA Development', 'HDP', 'Hyde Park Developments', 'Lasirena Group', 'tatweer', 'Qatari Diar', 'Marakez', 'Mountain View Developments', 'ORASCOM') order by name;
