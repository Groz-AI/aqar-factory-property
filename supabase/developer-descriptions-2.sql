-- Developer descriptions (EN + AR), Arabic names and search titles, second batch (developers with two projects).
-- Safe to re-run: fills only empty fields.
-- Run:  docker exec -i supabase-db psql -U postgres -d postgres < developer-descriptions-2.sql

begin;

-- CITY EDGE
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$سيتي إيدج$q$),
  description = coalesce(nullif(description, ''), $q$About CITY EDGE

CITY EDGE develops residential projects in the New Administrative Capital and on the North Coast. Its projects on Aqar Factory are Jade Park in the R3 district of the New Capital and Latin District in New Alamein.

Both projects are completed, so units are available for immediate handover. Jade Park offers apartments, duplexes and penthouses overlooking the Iconic Tower, while Latin District offers fully finished apartments in the heart of New Alamein.

Starting prices, payment plans and delivery details are on each project page.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن سيتي إيدج

تطرح شركة سيتي إيدج مشروعات سكنية في العاصمة الإدارية الجديدة وعلى الساحل الشمالي، ومشروعاتها على Aqar Factory هي جادي بارك في الحي الثالث بالعاصمة الإدارية والحي اللاتيني في العلمين الجديدة.

المشروعان مكتملان، ولذلك تتوفر وحدات للاستلام الفوري. يقدم جادي بارك شققًا ودوبلكس وبنتهاوس تطل على البرج الأيقوني، بينما يقدم الحي اللاتيني شققًا كاملة التشطيب في قلب العلمين الجديدة.

وتجد سعر البداية وخطة السداد وتفاصيل الاستلام في صفحة كل مشروع.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$CITY EDGE | Jade Park & Latin District Projects$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse CITY EDGE projects: Jade Park in the New Capital and Latin District in New Alamein, with prices, payment plans and delivery details.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$سيتي إيدج | جادي بارك والحي اللاتيني$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات سيتي إيدج: جادي بارك في العاصمة الإدارية والحي اللاتيني في العلمين الجديدة، مع الأسعار وخطط السداد وتفاصيل الاستلام.$q$)
where id = 'c2a2dccd-84b6-4822-870b-456cf9f9233c';

-- El Masria Group
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$المصرية جروب$q$),
  description = coalesce(nullif(description, ''), $q$About El Masria Group

El Masria Group develops residential compounds in the Fifth Settlement, New Cairo. Its projects on Aqar Factory are Isola Centra and ADAGIO in the Golden Square area, both under construction with delivery planned for 2029.

Isola Centra offers apartments, ground-floor apartments with gardens and penthouses, two minutes from the American University. ADAGIO is a villa community with standalone villas, twin houses, townhouses and luxury estates.

Each project page lists the starting price, payment plan and unit types so you can compare them with other Fifth Settlement compounds.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن المصرية جروب

تطرح المصرية جروب كمبوندات سكنية في التجمع الخامس بالقاهرة الجديدة، ومشروعاتها على Aqar Factory هي إيزولا سينترا وأداجيو في منطقة المربع الذهبي، وكلاهما قيد الإنشاء بموعد استلام مخطط في 2029.

يقدم إيزولا سينترا شققًا وشقق أرضي بحديقة وبنتهاوس على بعد دقيقتين من الجامعة الأمريكية، بينما أداجيو مجتمع للفيلات يضم فيلات مستقلة وتوين هاوس وتاون هاوس وقصورًا فاخرة.

وتعرض صفحة كل مشروع سعر البداية وخطة السداد وأنواع الوحدات لتتمكن من المقارنة بينهما وبين كمبوندات التجمع الخامس الأخرى.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$El Masria Group | Isola Centra & ADAGIO New Cairo$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore El Masria Group projects in the Fifth Settlement: Isola Centra and ADAGIO, with unit types, prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$المصرية جروب | إيزولا سينترا وأداجيو$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات المصرية جروب في التجمع الخامس: إيزولا سينترا وأداجيو، مع أنواع الوحدات والأسعار وخطط السداد.$q$)
where id = '44334f19-7aeb-4b83-8f61-916fee463b97';

-- El-Attal Holding
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$العطال القابضة$q$),
  description = coalesce(nullif(description, ''), $q$About El-Attal Holding

El-Attal Holding develops residential projects in Mostakbal City, New Cairo and in the New Administrative Capital. Its projects on Aqar Factory are The 101 Mostakbal City, developed with Arab Contractors, and Park Lane in the Seventh District (R7) of the New Capital.

The 101 offers studios, apartments and fully furnished hotel apartments in Mostakbal City. Park Lane offers apartments, ground-floor apartments with gardens, penthouses and duplexes.

Compare starting prices, payment plans and delivery details on each project page, then contact us to arrange a visit.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن العطال القابضة

تطرح العطال القابضة مشروعات سكنية في مدينة المستقبل بالقاهرة الجديدة وفي العاصمة الإدارية الجديدة، ومشروعاتها على Aqar Factory هي ذا 101 مستقبل سيتي بالتعاون مع المقاولون العرب، وبارك لين في الحي السابع بالعاصمة الإدارية.

يقدم ذا 101 استوديوهات وشققًا وشققًا فندقية مفروشة في مدينة المستقبل، بينما يقدم بارك لين شققًا وشقق أرضي بحديقة وبنتهاوس ودوبلكس.

قارن بين أسعار البداية وخطط السداد وتفاصيل الاستلام من صفحة كل مشروع، ثم تواصل معنا لترتيب زيارة.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$El-Attal Holding | The 101 & Park Lane Projects$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse El-Attal Holding projects: The 101 in Mostakbal City and Park Lane in the New Capital, with prices, payment plans and delivery details.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$العطال القابضة | ذا 101 وبارك لين$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات العطال القابضة: ذا 101 في مدينة المستقبل وبارك لين في العاصمة الإدارية، مع الأسعار وخطط السداد وتفاصيل الاستلام.$q$)
where id = '4660ab6f-24b1-44b4-8695-109e95924de8';

-- La Vista Develobments
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$لافيستا للتطوير$q$),
  description = coalesce(nullif(description, ''), $q$About La Vista Developments

La Vista Developments builds residential communities in the Fifth Settlement, New Cairo. Its projects on Aqar Factory are El Patio Oro, in the Golden Square, and El Patio Townside.

El Patio Oro is a completed compound with three-bedroom apartments and penthouses that are ready for immediate handover. El Patio Townside is an off-plan, villa-only community of 390 feddans on the Gamal Abdel Nasser axis.

Each project page shows the starting price, payment plan and delivery details, so you can compare ready apartments with off-plan villas.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن لافيستا للتطوير

تبني لافيستا للتطوير مجتمعات سكنية في التجمع الخامس بالقاهرة الجديدة، ومشروعاتها على Aqar Factory هي الباتيو أورو في المربع الذهبي والباتيو تاون سايد.

الباتيو أورو كمبوند مكتمل يضم شققًا من ثلاث غرف نوم وبنتهاوس جاهزة للاستلام الفوري، بينما الباتيو تاون سايد مجتمع للفيلات فقط على مساحة 390 فدانًا على محور جمال عبد الناصر وهو قيد الإطلاق.

وتعرض صفحة كل مشروع سعر البداية وخطة السداد وتفاصيل الاستلام لتتمكن من المقارنة بين الشقق الجاهزة والفيلات قيد الإطلاق.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$La Vista Developments | El Patio Oro & Townside$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore La Vista Developments projects in the Fifth Settlement: El Patio Oro and El Patio Townside, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$لافيستا للتطوير | الباتيو أورو والباتيو تاون سايد$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات لافيستا للتطوير في التجمع الخامس: الباتيو أورو والباتيو تاون سايد، مع الأسعار وخطط السداد.$q$)
where id = 'd553d710-9cf6-4c55-9aa4-d06bf16b86c9';

-- MBG Developments
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$إم بي جي للتطوير العقاري$q$),
  description = coalesce(nullif(description, ''), $q$About MBG Developments

MBG Developments has projects in the New Administrative Capital and on the Mediterranean coast at Ras El Bar. Its projects on Aqar Factory are Diplo East in the New Capital and Doray Bay in Ras El Bar.

Diplo East is an off-plan compound on a corner of the R8 district overlooking the Diplomatic Quarter, with apartments, garden apartments and penthouses and delivery planned for 2030. Doray Bay is an ongoing, fully finished beachfront community developed in partnership with the New Urban Communities Authority, with apartments, beach chalets, duplexes and standalone villas.

Compare starting prices, payment plans and unit types on each project page.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن إم بي جي للتطوير العقاري

لدى إم بي جي للتطوير العقاري مشروعات في العاصمة الإدارية الجديدة وعلى ساحل البحر المتوسط في رأس البر، ومشروعاتها على Aqar Factory هي ديبلو إيست في العاصمة الإدارية ودوراي باي في رأس البر.

ديبلو إيست كمبوند قيد الإطلاق على ناصية الحي الثامن بإطلالة على حي السفارات، ويضم شققًا وشقق أرضي بحديقة وبنتهاوس بموعد استلام مخطط في 2030. أما دوراي باي فهو مجتمع قيد الإنشاء على البحر مباشرة بتشطيب كامل وبالشراكة مع هيئة المجتمعات العمرانية، ويضم شققًا وشاليهات شاطئية ودوبلكس وفيلات مستقلة.

قارن بين أسعار البداية وخطط السداد وأنواع الوحدات من صفحة كل مشروع.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$MBG Developments | Diplo East & Doray Bay$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse MBG Developments projects: Diplo East in the New Capital and Doray Bay in Ras El Bar, with prices, unit types and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$إم بي جي للتطوير | ديبلو إيست ودوراي باي$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات إم بي جي للتطوير العقاري: ديبلو إيست في العاصمة الإدارية ودوراي باي في رأس البر، مع الأسعار وأنواع الوحدات وخطط السداد.$q$)
where id = 'fb548c7b-c239-463d-9c84-1c2046f5018f';

-- MURTAQA Developments
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$مرتقى للتطوير العقاري$q$),
  description = coalesce(nullif(description, ''), $q$About MURTAQA Developments

MURTAQA Developments has two projects on the Cairo–Ismailia Road near New Sheraton, in the Obour area: a retail destination and a villa community.

Quelevant New Sheraton Mall is a mixed-use mall project offering shops, restaurants and cafes, administrative offices and medical clinics. Que Gardens is a compound of luxury villas in New Sheraton.

Each project page lists the starting price, payment plan and delivery details, and Aqar Factory can arrange a visit to either one.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن مرتقى للتطوير العقاري

لدى مرتقى للتطوير العقاري مشروعان على طريق القاهرة الإسماعيلية بالقرب من نيو شيراتون في منطقة العبور: وجهة تجارية ومجتمع للفيلات.

مول كيو ليفارد نيو شيراتون مشروع مول متعدد الاستخدامات يضم محلات تجارية ومطاعم وكافيهات ومكاتب إدارية وعيادات طبية. أما كيو جاردنز فهو كمبوند للفيلات الفاخرة في نيو شيراتون.

وتعرض صفحة كل مشروع سعر البداية وخطة السداد وتفاصيل الاستلام، ويمكن لفريق Aqar Factory ترتيب زيارة لأي منهما.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$MURTAQA Developments | Quelevant Mall & Que Gardens$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore MURTAQA projects near New Sheraton: Quelevant Mall for shops and offices and Que Gardens villas, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$مرتقى للتطوير | كيو ليفارد وكيو جاردنز$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على مشروعات مرتقى قرب نيو شيراتون: مول كيو ليفارد للمحلات والمكاتب وفيلات كيو جاردنز، مع الأسعار وخطط السداد.$q$)
where id = '67f824e3-3479-42a1-bdd4-3a5192adf8db';

-- Royal Developments
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$رويال للتطوير العقاري$q$),
  description = coalesce(nullif(description, ''), $q$About Royal Developments

Royal Developments builds residential compounds in New Cairo. Its projects on Aqar Factory are Najm in the Sixth Settlement and Monark Residences in Mostakbal City.

Najm offers apartments, star houses with terraces and garden lofts, and is currently an off-plan launch. Monark Residences offers apartments, spine villas, quattro villas and townhouses. Both projects are sold with long installment plans or a discount for shorter terms.

Starting prices and exact terms are on each project page.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن رويال للتطوير العقاري

تبني رويال للتطوير العقاري كمبوندات سكنية في القاهرة الجديدة، ومشروعاتها على Aqar Factory هي نجم في التجمع السادس ومونارك ريزيدنس في مدينة المستقبل.

يقدم نجم شققًا ووحدات ستار هاوس بتراس ولوفت بحديقة، وهو حاليًا في مرحلة الإطلاق. ويقدم مونارك ريزيدنس شققًا وفيلات سباين وفيلات كواترو وتاون هاوس. ويُباع المشروعان بخطط تقسيط ممتدة أو بخصم عند السداد على مدة أقصر.

وتجد أسعار البداية والشروط الدقيقة في صفحة كل مشروع.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$Royal Developments | Najm & Monark Residences$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse Royal Developments projects in New Cairo: Najm in the Sixth Settlement and Monark Residences in Mostakbal City, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$رويال للتطوير | نجم ومونارك ريزيدنس$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات رويال للتطوير العقاري في القاهرة الجديدة: نجم في التجمع السادس ومونارك ريزيدنس في مدينة المستقبل، مع الأسعار وخطط السداد.$q$)
where id = 'ac160d2e-e98f-493c-b4ad-3391dc9e9263';

-- Saudi Egyptian Developers (SED)
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$المطورون السعوديون المصريون (SED)$q$),
  description = coalesce(nullif(description, ''), $q$About Saudi Egyptian Developers (SED)

Saudi Egyptian Developers (SED) focuses on commercial and mixed-use projects. Its projects on Aqar Factory are Khan Arabesque in Cairo and Central New Cairo in the Fifth Settlement.

Khan Arabesque is a commercial project with retail, food and beverage, restaurants and offices, with delivery planned for 2028. Central New Cairo, on the 90th Street, offers offices, shops, restaurants and cafes in a mixed-use development.

Each project page shows the starting price, payment plan and unit types, which helps business owners and investors compare them.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن المطورون السعوديون المصريون (SED)

تركز شركة المطورون السعوديون المصريون (SED) على المشروعات التجارية ومتعددة الاستخدامات، ومشروعاتها على Aqar Factory هي خان أرابيسك في القاهرة وسنترال التجمع الخامس.

خان أرابيسك مشروع تجاري يضم محلات تجارية ومطاعم ومكاتب إدارية بموعد استلام مخطط في 2028. أما سنترال التجمع الخامس على التسعين فيقدم مكاتب ومحلات ومطاعم وكافيهات في مشروع متعدد الاستخدامات.

وتعرض صفحة كل مشروع سعر البداية وخطة السداد وأنواع الوحدات، مما يساعد أصحاب الأعمال والمستثمرين على المقارنة.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$SED | Khan Arabesque & Central New Cairo$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore Saudi Egyptian Developers (SED) commercial projects: Khan Arabesque in Cairo and Central New Cairo, with prices and payment plans.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$SED | خان أرابيسك وسنترال التجمع الخامس$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تعرف على المشروعات التجارية للمطورون السعوديون المصريون (SED): خان أرابيسك في القاهرة وسنترال التجمع الخامس، مع الأسعار وخطط السداد.$q$)
where id = 'a80f7e17-b237-4604-b935-3b6a28ca4d41';

-- STM
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$إس تي إم$q$),
  description = coalesce(nullif(description, ''), $q$About STM

STM has two completed residential projects on Aqar Factory: Kayan City in the New Administrative Capital and Mayan in El Shorouk City.

Kayan City offers fully finished three-bedroom apartments ready for immediate handover, luxury townhouses, and commercial and administrative space. Mayan offers apartments in El Shorouk City with installment plans.

Compare starting prices, payment plans and delivery details on each project page, then contact us to arrange a visit.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  description_ar = coalesce(nullif(description_ar, ''), $q$نبذة عن إس تي إم

لدى إس تي إم مشروعان سكنيان مكتملان على Aqar Factory: كيان سيتي في العاصمة الإدارية الجديدة ومايان في مدينة الشروق.

يقدم كيان سيتي شققًا من ثلاث غرف نوم كاملة التشطيب للاستلام الفوري، إلى جانب تاون هاوس فاخر ومساحات تجارية وإدارية. ويقدم مايان شققًا في مدينة الشروق بأنظمة تقسيط.

قارن بين أسعار البداية وخطط السداد وتفاصيل الاستلام من صفحة كل مشروع، ثم تواصل معنا لترتيب زيارة.

تواصل مع Aqar Factory للحصول على أحدث قوائم الأسعار وخطط التقسيط أو لحجز معاينة.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$STM | Kayan City & Mayan El Shorouk$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Browse STM projects: Kayan City in the New Capital and Mayan in El Shorouk City, with prices, payment plans and delivery details.$q$),
  seo_title_ar = coalesce(nullif(seo_title_ar, ''), $q$إس تي إم | كيان سيتي ومايان الشروق$q$),
  seo_description_ar = coalesce(nullif(seo_description_ar, ''), $q$تصفح مشروعات إس تي إم: كيان سيتي في العاصمة الإدارية ومايان في مدينة الشروق، مع الأسعار وخطط السداد وتفاصيل الاستلام.$q$)
where id = 'e15c7c75-3ed9-40df-8eb8-41e33babc731';

-- شركة عامر جروب للتطوير العقاري Amer Group
update public.developers set
  name_ar = coalesce(nullif(name_ar, ''), $q$عامر جروب$q$),
  description = coalesce(nullif(description, ''), $q$About Amer Group

Amer Group has two completed resorts in Ain Sokhna on the Red Sea coast, both listed on Aqar Factory: Polo Resort and Polotano Sokhna.

These are vacation-home projects within driving distance of Cairo, so units are available for immediate handover. Each project page shows the starting price, unit types and payment plan.

Contact Aqar Factory for the latest price lists and installment plans, or to book a viewing.$q$),
  seo_title = coalesce(nullif(seo_title, ''), $q$Amer Group | Polo Resort & Polotano Ain Sokhna$q$),
  seo_description = coalesce(nullif(seo_description, ''), $q$Explore Amer Group resorts in Ain Sokhna: Polo Resort and Polotano Sokhna, with prices, unit types and payment plans.$q$)
where id = '11c29cef-a61d-4936-aff3-90a0f80baa21';

commit;

-- check
select name, name_ar, length(description) as en_chars, length(description_ar) as ar_chars from public.developers
where name in ('CITY EDGE', 'El Masria Group', 'El-Attal Holding', 'La Vista Develobments', 'MBG Developments', 'MURTAQA Developments', 'Royal Developments', 'Saudi Egyptian Developers (SED)', 'STM', 'شركة عامر جروب للتطوير العقاري Amer Group') order by name;
