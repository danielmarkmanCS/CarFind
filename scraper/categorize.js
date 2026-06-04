const RULES = [
  { category: 'vehicles', keywords: ['רכב','מכונית','אופנוע','טרקטור','קרוון','שטח','ג׳יפ','סדאן','האצ׳בק','פיקאפ','וואן','אוטובוס','משאית','car','truck','van','bus','motorcycle','bike','honda','toyota','ford','hyundai','kia','mazda','bmw','mercedes','audi','volkswagen','vw','nissan','subaru','seat','skoda','fiat','peugeot','renault','volvo','jeep','chevrolet','dodge','tesla','יונדאי','טויוטה','מאזדה','פולקסווגן','סקודה','סיאט','פיאט','קיה','רנו','פיג'] },
  { category: 'real-estate', keywords: ['דירה','חדר','בית','קוטג','פנטהאוס','סטודיו','דופלקס','שכירות','השכרה','למכירה','חדרים','מ"ר','מטר','נדל','apartment','room','house','rent','studio','floor','bedroom','property'] },
  { category: 'electronics', keywords: ['טלוויזיה','מחשב','לפטופ','טלפון','אייפון','סמסונג','אייפד','טאבלט','מסך','מקרן','מדפסת','מצלמה','אוזניות','רמקול','שואב','מקרר','מדיח','מכונת','מקפיא','טוסטר','קפה','מיקסר','tv','phone','iphone','samsung','laptop','computer','screen','camera','speaker','headphones','tablet','ipad','printer','monitor','keyboard','mouse','playstation','xbox','nintendo','console','ps4','ps5'] },
  { category: 'furniture', keywords: ['ספה','כיסא','שולחן','מיטה','ארון','מדף','מזרון','ספריה','מגירה','פינת','ביסלי','sofa','chair','table','bed','wardrobe','shelf','desk','couch','cabinet','mattress'] },
  { category: 'clothing', keywords: ['חולצה','מכנסיים','שמלה','נעל','מעיל','סוודר','ג׳ינס','תיק','שעון','תכשיט','shirt','pants','dress','shoes','jacket','coat','bag','watch','jewelry','clothes','fashion','jeans','sneakers'] },
  { category: 'sports', keywords: ['אופניים','קורקינט','כדור','טניס','כושר','ריצה','גלישה','אופני','ספורט','bicycle','scooter','ball','sport','fitness','gym','yoga','surf','swim','ski','running'] },
  { category: 'pets', keywords: ['כלב','חתול','דג','ציפור','ארנב','גורי','גורים','dog','cat','fish','bird','rabbit','pet','puppy','kitten','hamster','parrot'] },
  { category: 'jobs', keywords: ['דרוש','מחפש','עבודה','משרה','פוזיציה','hiring','job','work','position','career','staff','employee','wanted'] },
];

export function classifyListing(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }
  return 'general';
}
