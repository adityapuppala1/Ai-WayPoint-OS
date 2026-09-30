/**
 * Seed signals: real developments with their original sources, so Signals is not blank on
 * day one. Staff add more by hand in the admin console (/admin/signals); nothing fetches
 * signals automatically, and these are not re-dated as they age.
 */
import type { signals } from '../schema';

type NewSignal = Omit<typeof signals.$inferInsert, 'contentHash'>;

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const SEED_SIGNALS: NewSignal[] = [
  {
    source: 'official',
    sourceName: 'International Labour Organization',
    sourceUrl:
      'https://www.ilo.org/resource/news/one-four-jobs-risk-being-transformed-genai-new-ilo%E2%80%93nask-global-index-shows',
    title: 'One in four jobs could be transformed by generative AI, ILO index finds',
    summary:
      'The ILO–NASK global index finds 25% of jobs are in occupations exposed to generative AI (34% in high-income countries). Clerical work is the most exposed. Most jobs are expected to change rather than disappear, and outcomes depend on how the transition is managed.',
    language: 'en',
    publishedAt: d('2025-05-20'),
    regions: ['ZZ'],
    sectors: ['clerical', 'software', 'finance', 'media'],
    topics: ['ai', 'jobs'],
    situations: ['lost-job', 'changing-career', 'first-job'],
    importance: 4,
  },
  {
    source: 'news',
    sourceName: 'The Korea Times',
    sourceUrl:
      'https://www.koreatimes.co.kr/southkorea/health/20260601/korea-increases-hotline-staff-for-suicide-prevention-calls-boosts-multilingual-support',
    title: 'Korea adds counsellors to the 109 suicide prevention line',
    summary:
      'The unified 109 line, launched in January 2024, now takes over 1,100 calls a day, most between 4 p.m. and 3 a.m. The government is adding counsellors and multilingual support for foreign residents.',
    language: 'en',
    publishedAt: d('2026-06-01'),
    regions: ['KR'],
    topics: ['mental-health', 'support-services'],
    importance: 3,
  },
  {
    source: 'official',
    sourceName: 'Ministry of Health Singapore',
    sourceUrl:
      'https://www.moh.gov.sg/newsroom/national-mindline-1771-to-provide--round-the-clock-support-for-mental-health/',
    title: 'Singapore’s national mindline 1771 offers round-the-clock mental health support',
    summary:
      'People in Singapore can call 1771, message on WhatsApp or use webchat at any hour, without having to give their name.',
    language: 'en',
    publishedAt: d('2025-06-18'),
    regions: ['SG'],
    topics: ['mental-health', 'support-services'],
    importance: 3,
  },
  {
    source: 'news',
    sourceName: 'Xinhua',
    sourceUrl: 'https://www.news.cn/politics/20250508/6a76fdf3d82b4efca742793d3e563643/c.html',
    title: 'China’s 12356 psychological support line is now open in every province',
    summary:
      'All 31 provinces, autonomous regions and municipalities have opened the national 12356 psychological assistance hotline.',
    language: 'en',
    publishedAt: d('2025-05-08'),
    regions: ['CN'],
    topics: ['mental-health', 'support-services'],
    importance: 3,
  },
  {
    source: 'official',
    sourceName: 'Press Information Bureau, Government of India',
    sourceUrl:
      'https://www.pib.gov.in/FactsheetDetails.aspx?id=150678&NoteId=150678&ModuleId=16&reg=48&lang=1',
    title: 'India’s women helpline 14490 offers 24x7 toll-free support',
    summary:
      'The National Commission for Women’s 14490 short code connects women and girls facing violence to help, day and night.',
    language: 'en',
    publishedAt: d('2026-07-03'),
    regions: ['IN'],
    topics: ['safety', 'support-services'],
    importance: 3,
  },
  {
    source: 'official',
    sourceName: 'US Federal Trade Commission',
    sourceUrl:
      'https://consumer.ftc.gov/consumer-alerts/2026/09/see-qr-code-parked-somewhere-dont-scan-ityet',
    title: 'Fake QR codes on parking meters lead to payment scams',
    summary:
      'Scammers stick fake QR codes over real ones so people pay on fraudulent sites. Check the web address before paying, or use the official app.',
    language: 'en',
    publishedAt: d('2026-09-03'),
    regions: ['US'],
    topics: ['scams'],
    importance: 2,
  },
  {
    source: 'official',
    sourceName: 'Department of Health – Abu Dhabi',
    sourceUrl:
      'https://www.doh.gov.ae/en/news/doh-activates-247-mental-health-support-hotline-800-sakina-(725462)',
    title: 'Abu Dhabi opens 24/7 mental health line 800 SAKINA',
    summary:
      'The bilingual Arabic and English line offers psychological first aid and connects callers to professionals, with services for children and families.',
    language: 'en',
    publishedAt: d('2026-03-03'),
    regions: ['AE'],
    topics: ['mental-health', 'support-services'],
    importance: 3,
  },
  {
    source: 'official',
    sourceName: 'Otoritas Jasa Keuangan (OJK)',
    sourceUrl:
      'https://ojk.go.id/id/berita-dan-kegiatan/info-terkini/Pages/Waspada-Penipuan-Website-Mengatasnamakan-Indonesia-Anti-Scam-Centre-IASC.aspx',
    title: 'Indonesia warns of fake websites pretending to be the Anti-Scam Centre',
    summary:
      'OJK says scam reports to the Indonesia Anti-Scam Centre can only be made at iasc.ojk.go.id. Sites or people claiming to recover money for you are likely scams.',
    language: 'en',
    publishedAt: d('2025-03-28'),
    regions: ['ID'],
    topics: ['scams'],
    importance: 3,
  },
  {
    source: 'official',
    sourceName: 'UN Women Africa',
    sourceUrl:
      'https://africa.unwomen.org/en/stories/news/2024/10/kenyas-national-toll-free-helpline-1195-a-lifeline-for-gender-based-violence-survivors',
    title: 'Kenya’s 1195 helpline offers 24-hour support to survivors of gender-based violence',
    summary:
      'The free national line provides psychosocial support, referrals and emergency help across Kenya.',
    language: 'en',
    publishedAt: d('2024-10-05'),
    regions: ['KE'],
    topics: ['safety', 'support-services'],
    importance: 2,
  },
];
