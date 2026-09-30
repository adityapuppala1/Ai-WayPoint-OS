/**
 * Starter circles: small, public peer groups hosted by Waypoint so nobody arrives to an empty
 * room. Real (not demo) — they start with zero members. Translations reviewed for plain,
 * warm wording; improve them through the normal translation review.
 */
import type { circles } from '../schema';

type NewCircle = Pick<
  typeof circles.$inferInsert,
  'slug' | 'name' | 'description' | 'topic' | 'language'
>;

const t = (topic: string, language: string, name: string, description: string): NewCircle => ({
  slug: `${topic}-${language}`,
  topic,
  language,
  name,
  description,
});

export const STARTER_CIRCLES: NewCircle[] = [
  // Starting again after losing work
  t(
    'lost-job',
    'en',
    'Starting again after a job loss',
    'A small group for people who recently lost work. Share what is working, swap leads and keep each other going.',
  ),
  t(
    'lost-job',
    'hi',
    'नौकरी जाने के बाद नई शुरुआत',
    'हाल ही में नौकरी खोने वाले लोगों का छोटा समूह। जो काम आ रहा है वह साझा करें, अवसरों की जानकारी दें और एक-दूसरे का साथ दें।',
  ),
  t(
    'lost-job',
    'es',
    'Volver a empezar tras perder el empleo',
    'Un grupo pequeño para personas que han perdido su trabajo hace poco. Compartan lo que funciona, pistas de empleo y ánimo.',
  ),
  t(
    'lost-job',
    'fr',
    'Rebondir après la perte d’un emploi',
    'Un petit groupe pour les personnes qui ont perdu leur emploi récemment. Partagez ce qui marche, des pistes et du soutien.',
  ),
  t(
    'lost-job',
    'pt',
    'Recomeçar depois de perder o emprego',
    'Um grupo pequeno para quem perdeu o trabalho recentemente. Compartilhem o que funciona, oportunidades e apoio.',
  ),
  t(
    'lost-job',
    'ar',
    'بداية جديدة بعد فقدان العمل',
    'مجموعة صغيرة لمن فقدوا عملهم مؤخرًا. شاركوا ما ينجح، وتبادلوا الفرص، وادعموا بعضكم.',
  ),
  t(
    'lost-job',
    'sw',
    'Kuanza upya baada ya kupoteza kazi',
    'Kikundi kidogo kwa watu waliopoteza kazi hivi karibuni. Shirikini kinachofanya kazi, fursa za kazi na mtiane moyo.',
  ),

  // First job
  t(
    'first-job',
    'en',
    'Looking for a first job',
    'For students and school leavers finding their first paid work. Practise interviews, share openings and celebrate wins.',
  ),
  t(
    'first-job',
    'hi',
    'पहली नौकरी की तलाश',
    'पहला काम ढूँढ रहे छात्रों और युवाओं के लिए। इंटरव्यू का अभ्यास करें, अवसर साझा करें और सफलताओं का जश्न मनाएँ।',
  ),
  t(
    'first-job',
    'es',
    'Buscando el primer empleo',
    'Para estudiantes y jóvenes que buscan su primer trabajo. Practiquen entrevistas, compartan ofertas y celebren logros.',
  ),
  t(
    'first-job',
    'fr',
    'À la recherche d’un premier emploi',
    'Pour les étudiants et jeunes diplômés qui cherchent leur premier travail. Entraînez-vous aux entretiens, partagez des offres, fêtez vos réussites.',
  ),
  t(
    'first-job',
    'pt',
    'Em busca do primeiro emprego',
    'Para estudantes e jovens procurando o primeiro trabalho. Pratiquem entrevistas, compartilhem vagas e comemorem conquistas.',
  ),
  t(
    'first-job',
    'ar',
    'البحث عن أول وظيفة',
    'للطلاب والخريجين الجدد الباحثين عن أول عمل. تدرّبوا على المقابلات، وشاركوا الفرص، واحتفلوا بالنجاحات.',
  ),
  t(
    'first-job',
    'sw',
    'Kutafuta kazi ya kwanza',
    'Kwa wanafunzi na vijana wanaotafuta kazi yao ya kwanza. Jizoezeni mahojiano, shirikini nafasi za kazi na sherehekeeni mafanikio.',
  ),

  // New country
  t(
    'new-country',
    'en',
    'New in a new country',
    'For people who recently moved abroad for work or safety. Paperwork, jobs, loneliness — you are not alone in it.',
  ),
  t(
    'new-country',
    'hi',
    'नए देश में नए हैं',
    'काम या सुरक्षा के लिए हाल ही में विदेश गए लोगों के लिए। कागज़ी काम, नौकरी, अकेलापन — आप अकेले नहीं हैं।',
  ),
  t(
    'new-country',
    'es',
    'Recién llegados a un nuevo país',
    'Para quienes se mudaron hace poco a otro país por trabajo o seguridad. Trámites, empleo, soledad: no estás solo.',
  ),
  t(
    'new-country',
    'fr',
    'Nouveau dans un nouveau pays',
    'Pour les personnes récemment installées à l’étranger pour le travail ou leur sécurité. Démarches, emploi, solitude : vous n’êtes pas seul.',
  ),
  t(
    'new-country',
    'pt',
    'Recém-chegados a um novo país',
    'Para quem se mudou há pouco para outro país por trabalho ou segurança. Documentos, trabalho, solidão — você não está sozinho.',
  ),
  t(
    'new-country',
    'ar',
    'جديد في بلد جديد',
    'لمن انتقلوا مؤخرًا إلى بلد آخر للعمل أو من أجل الأمان. الأوراق والعمل والوحدة — لستَ وحدك.',
  ),
  t(
    'new-country',
    'sw',
    'Mgeni katika nchi mpya',
    'Kwa watu waliohamia nchi nyingine hivi karibuni kwa ajili ya kazi au usalama. Nyaraka, kazi, upweke — hauko peke yako.',
  ),

  // Life situations (English first; more languages as hosts join)
  t(
    'changing-career',
    'en',
    'Changing careers',
    'For people moving into a new field, including away from work that AI is changing. Plans, projects and honest feedback.',
  ),
  t(
    'caring',
    'en',
    'Caring for someone',
    'For people looking after a parent, partner or child who needs extra care. Practical tips and a place to breathe.',
  ),
  t(
    'caring',
    'es',
    'Cuidar de alguien',
    'Para quienes cuidan de un padre, una pareja o un hijo que necesita atención extra. Consejos prácticos y un lugar para respirar.',
  ),
  t(
    'caring',
    'hi',
    'किसी की देखभाल करना',
    'माता-पिता, जीवनसाथी या बच्चे की देखभाल करने वालों के लिए। काम की सलाह और थोड़ा सुकून।',
  ),
  t(
    'running-business',
    'en',
    'Running a small business',
    'For shop owners, traders and freelancers. Customers, cash flow and pricing — learn from people doing it.',
  ),
  t(
    'studying',
    'en',
    'Studying online together',
    'Keep each other on track with courses and certificates. Weekly check-ins help.',
  ),
  t(
    'retiring',
    'en',
    'Planning retirement',
    'For people planning the next chapter: money, purpose and staying connected.',
  ),

  // Role paths
  t(
    'data-analyst',
    'en',
    'Becoming a data analyst',
    'Learning spreadsheets, SQL and dashboards? Share projects and get feedback from people a few steps ahead.',
  ),
  t(
    'care-worker',
    'en',
    'Working in care',
    'For care workers and people training for care roles. Support, advice and recognition for important work.',
  ),
  t(
    'solar-technician',
    'en',
    'Solar and green jobs',
    'For people training for solar, energy efficiency and other green work.',
  ),
  t(
    'ai-at-work',
    'en',
    'Using AI at work',
    'Share practical ways you use AI tools safely at work, and what to double-check.',
  ),
];
