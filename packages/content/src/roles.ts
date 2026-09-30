import type { Role, SourceRef } from './types';

/**
 * Roles people move into, with an honest note on generative-AI exposure.
 *
 * Exposure levels follow the ILO–NASK global index (ILO Working Paper 140, May 2025): about a
 * quarter of global jobs are in occupations exposed to generative AI; clerical work is the most
 * exposed; digitised cognitive work in software, finance and media is increasingly exposed;
 * manual, care and trade work is least exposed. Exposure means tasks will change — in most jobs
 * AI changes how work is done rather than replacing the job outright.
 */

const CHECKED = '2026-09-29';
const ILO_WP140: SourceRef = {
  url: 'https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure',
  title:
    'ILO Working Paper 140: Generative AI and Jobs – a refined global index of occupational exposure (2025)',
  checkedAt: CHECKED,
};
const ILO_NEWS: SourceRef = {
  url: 'https://www.ilo.org/resource/news/one-four-jobs-risk-being-transformed-genai-new-ilo%E2%80%93nask-global-index-shows',
  title: 'ILO: one in four jobs at risk of being transformed by GenAI',
  checkedAt: CHECKED,
};
const ILO = [ILO_WP140, ILO_NEWS];

export const ROLES: Role[] = [
  // Data & technology
  {
    id: 'data-analyst',
    title: 'Data analyst',
    family: 'Data & analytics',
    summary: 'Turns messy data into answers people can act on, using spreadsheets, SQL and charts.',
    skills: [
      'spreadsheets',
      'data-cleaning',
      'sql',
      'data-analysis',
      'data-visualisation',
      'statistics-basics',
      'writing-clearly',
    ],
    entryPaths: [
      'Portfolio of 3 real projects',
      'Internal move from an operations or finance role',
      'Short certificate course',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI speeds up routine queries and charts. Framing the right question, checking results and explaining them to people stay human.',
    sources: ILO,
  },
  {
    id: 'junior-software-developer',
    title: 'Junior software developer',
    family: 'Software',
    summary: 'Builds and fixes features in apps and websites as part of a team.',
    skills: [
      'programming-basics',
      'web-development',
      'version-control',
      'problem-solving',
      'teamwork',
      'ai-evaluation',
    ],
    entryPaths: [
      'Portfolio of projects on GitHub',
      'Apprenticeship or bootcamp',
      'Open-source contributions',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI writes a lot of routine code. Developers who can review, test and integrate AI-written code and understand users are in demand.',
    sources: ILO,
  },
  {
    id: 'web-developer',
    title: 'Freelance web developer',
    family: 'Software',
    summary: 'Builds and maintains websites for small businesses and organisations.',
    skills: [
      'web-development',
      'web-content',
      'version-control',
      'customer-service',
      'entrepreneurship',
    ],
    entryPaths: [
      'Build 3 sites for real local clients',
      'Freelance platforms',
      'Agency junior role',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI site builders handle simple pages. Local trust, understanding a client’s business and ongoing support are hard to automate.',
    sources: ILO,
  },
  {
    id: 'it-support-technician',
    title: 'IT support technician',
    family: 'IT & infrastructure',
    summary: 'Keeps people’s devices, accounts and networks working.',
    skills: [
      'it-support',
      'networking-basics',
      'cybersecurity-basics',
      'customer-service',
      'problem-solving',
    ],
    entryPaths: [
      'Entry-level certificate',
      'Help-desk role',
      'Volunteer IT support in the community',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI chatbots take simple questions. Hands-on fixes, security judgement and patient help for people stay valuable.',
    sources: ILO,
  },
  {
    id: 'cybersecurity-analyst',
    title: 'Junior cybersecurity analyst',
    family: 'IT & infrastructure',
    summary: 'Monitors systems for threats and helps respond to incidents.',
    skills: [
      'cybersecurity-basics',
      'networking-basics',
      'it-support',
      'problem-solving',
      'writing-clearly',
    ],
    entryPaths: [
      'IT support experience first',
      'Security certificate',
      'Capture-the-flag practice and write-ups',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI helps sort alerts, while attackers use AI too. Investigation, judgement and clear reporting are in demand.',
    sources: ILO,
  },
  {
    id: 'ai-automation-specialist',
    title: 'AI automation specialist',
    family: 'AI & automation',
    summary: 'Helps teams and small businesses use AI and no-code tools to save time safely.',
    skills: [
      'ai-literacy',
      'prompting',
      'ai-automation',
      'ai-evaluation',
      'spreadsheets',
      'project-coordination',
      'writing-clearly',
    ],
    entryPaths: [
      'Automate 3 real workflows and document the time saved',
      'Internal champion in your current job',
      'Freelance for small businesses',
    ],
    aiExposure: 'medium',
    aiNote:
      'A role created by AI. It rewards people who understand how work actually gets done and can check AI output carefully.',
    sources: ILO,
  },
  {
    id: 'ai-quality-reviewer',
    title: 'AI quality reviewer',
    family: 'AI & automation',
    summary: 'Tests and rates AI output for accuracy, safety and language quality, often remotely.',
    skills: ['ai-evaluation', 'ai-literacy', 'writing-clearly', 'problem-solving', 'translation'],
    entryPaths: [
      'Subject expertise (health, law, a language) plus a test task',
      'Remote evaluation platforms',
      'Internal quality roles',
    ],
    aiExposure: 'high',
    aiNote:
      'Demand shifts quickly as models improve. Deep subject or language expertise keeps this work valuable; generic rating tasks are less stable.',
    sources: ILO,
  },

  // Business & office
  {
    id: 'administrative-assistant',
    title: 'Administrative assistant',
    family: 'Office & administration',
    summary: 'Keeps an office running: schedules, documents, records and communication.',
    skills: [
      'office-docs',
      'spreadsheets',
      'online-collaboration',
      'time-management',
      'writing-clearly',
      'customer-service',
    ],
    entryPaths: ['Temporary or agency work', 'Internal move', 'Short office skills course'],
    aiExposure: 'high',
    aiNote:
      'Clerical tasks are the most exposed to generative AI. Adding AI automation or a specialism (finance, HR, projects) builds resilience.',
    sources: ILO,
  },
  {
    id: 'bookkeeper',
    title: 'Bookkeeper',
    family: 'Finance',
    summary: 'Records income and spending, invoices and payments for small businesses.',
    skills: [
      'bookkeeping',
      'spreadsheets',
      'personal-finance',
      'literacy-numeracy',
      'customer-service',
    ],
    entryPaths: [
      'Bookkeeping certificate',
      'Help a local business or cooperative',
      'Accounts assistant role',
    ],
    aiExposure: 'high',
    aiNote:
      'Software and AI automate data entry. Advising owners on cash flow and tax deadlines is where bookkeepers add value.',
    sources: ILO,
  },
  {
    id: 'financial-analyst',
    title: 'Financial analyst',
    family: 'Finance',
    summary: 'Analyses numbers to help organisations plan, budget and invest.',
    skills: [
      'financial-analysis',
      'spreadsheets',
      'data-analysis',
      'statistics-basics',
      'speaking-presenting',
    ],
    entryPaths: [
      'Finance degree or professional qualification',
      'Move up from accounts or bookkeeping',
      'Analyst internship',
    ],
    aiExposure: 'high',
    aiNote:
      'Finance is among the digitised roles with rising exposure. Judgement, relationships and explaining risk remain human work.',
    sources: ILO,
  },
  {
    id: 'customer-support-agent',
    title: 'Customer support agent',
    family: 'Customer service',
    summary: 'Helps customers by phone, chat or email to solve problems.',
    skills: [
      'customer-service',
      'writing-clearly',
      'digital-basics',
      'problem-solving',
      'english-workplace',
    ],
    entryPaths: [
      'Contact centre role',
      'Retail experience',
      'Language skills for multilingual support',
    ],
    aiExposure: 'high',
    aiNote:
      'Chatbots handle simple questions. Complex, emotional or high-value cases still need people — and so does supervising AI agents.',
    sources: ILO,
  },
  {
    id: 'sales-representative',
    title: 'Sales representative',
    family: 'Sales & marketing',
    summary: 'Finds and serves customers for a product or service.',
    skills: [
      'sales',
      'negotiation',
      'customer-service',
      'speaking-presenting',
      'online-collaboration',
    ],
    entryPaths: [
      'Retail or field sales',
      'Commission-based roles with training',
      'Own small business experience',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI helps with research and emails. Trust, listening and relationships stay at the heart of sales.',
    sources: ILO,
  },
  {
    id: 'digital-marketer',
    title: 'Digital marketer',
    family: 'Sales & marketing',
    summary: 'Grows an audience and sales online through social media, content and ads.',
    skills: [
      'social-media-marketing',
      'copywriting',
      'web-content',
      'data-analysis',
      'graphic-design',
    ],
    entryPaths: [
      'Grow an account or a local business online and show results',
      'Marketing assistant role',
      'Freelance',
    ],
    aiExposure: 'medium',
    aiNote: 'AI produces content fast, so strategy, taste and reading real results matter more.',
    sources: ILO,
  },
  {
    id: 'project-coordinator',
    title: 'Project coordinator',
    family: 'Operations',
    summary: 'Keeps projects on track: plans, updates, risks and people.',
    skills: [
      'project-coordination',
      'time-management',
      'online-collaboration',
      'writing-clearly',
      'facilitation',
      'spreadsheets',
    ],
    entryPaths: [
      'Take on coordination in your current job',
      'Project certificate',
      'NGO or community projects',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI drafts plans and summaries; coordinating people, priorities and trade-offs stays human.',
    sources: ILO,
  },
  {
    id: 'logistics-coordinator',
    title: 'Logistics coordinator',
    family: 'Operations',
    summary: 'Organises stock, orders and deliveries so goods arrive on time.',
    skills: ['logistics', 'spreadsheets', 'problem-solving', 'online-collaboration', 'negotiation'],
    entryPaths: ['Warehouse or dispatch role', 'Internal move', 'Logistics certificate'],
    aiExposure: 'medium',
    aiNote:
      'Planning tools automate routing; handling exceptions, suppliers and people keeps the role human.',
    sources: ILO,
  },
  {
    id: 'hr-assistant',
    title: 'HR assistant',
    family: 'People & HR',
    summary: 'Supports hiring, onboarding and staff records.',
    skills: [
      'hr-basics',
      'office-docs',
      'writing-clearly',
      'customer-service',
      'online-collaboration',
    ],
    entryPaths: ['Administrative role first', 'HR certificate', 'Internal move'],
    aiExposure: 'high',
    aiNote:
      'Screening and paperwork are highly automatable. Fairness, confidentiality and supporting people are not.',
    sources: ILO,
  },
  {
    id: 'small-business-owner',
    title: 'Small business owner',
    family: 'Self-employment',
    summary: 'Runs their own trade, shop or service.',
    skills: [
      'entrepreneurship',
      'sales',
      'bookkeeping',
      'personal-finance',
      'social-media-marketing',
      'customer-service',
    ],
    entryPaths: [
      'Start small with real customers',
      'Cooperative or group enterprise',
      'Business development programmes',
    ],
    aiExposure: 'low',
    aiNote:
      'AI can act like a cheap assistant for marketing, bookkeeping and planning — a real advantage for small businesses.',
    sources: ILO,
  },

  // Creative & language
  {
    id: 'graphic-designer',
    title: 'Graphic designer',
    family: 'Creative',
    summary: 'Designs visuals for brands, products and campaigns.',
    skills: ['graphic-design', 'photography', 'copywriting', 'customer-service', 'ux-design'],
    entryPaths: [
      'Portfolio of 5–8 pieces for real clients',
      'Freelance platforms',
      'Agency junior role',
    ],
    aiExposure: 'medium',
    aiNote:
      'Image generators change simple design work. Brand thinking, taste and working closely with clients are harder to automate.',
    sources: ILO,
  },
  {
    id: 'video-editor',
    title: 'Video editor',
    family: 'Creative',
    summary: 'Edits video for social media, businesses and events.',
    skills: ['video-editing', 'photography', 'copywriting', 'social-media-marketing'],
    entryPaths: [
      'Portfolio of short edits',
      'Local businesses and events',
      'Content creator teams',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI tools speed up cutting and captions. Storytelling and understanding an audience stay human.',
    sources: ILO,
  },
  {
    id: 'ux-designer',
    title: 'UX designer',
    family: 'Creative',
    summary: 'Researches users and designs apps and services that are easy to use.',
    skills: ['ux-design', 'graphic-design', 'writing-clearly', 'facilitation', 'data-analysis'],
    entryPaths: [
      'Case studies of redesigns with real users',
      'Junior product role',
      'Design course',
    ],
    aiExposure: 'medium',
    aiNote:
      'AI drafts screens quickly; talking to real users and making good trade-offs matter more.',
    sources: ILO,
  },
  {
    id: 'content-writer',
    title: 'Content writer',
    family: 'Creative',
    summary: 'Writes articles, product pages, emails and scripts.',
    skills: [
      'copywriting',
      'writing-clearly',
      'web-content',
      'social-media-marketing',
      'ai-evaluation',
    ],
    entryPaths: [
      'Portfolio of published pieces',
      'Specialise in a subject you know well',
      'Freelance',
    ],
    aiExposure: 'high',
    aiNote:
      'Generic writing is highly exposed. Subject expertise, original reporting and editing AI drafts well are more resilient.',
    sources: ILO,
  },
  {
    id: 'translator-interpreter',
    title: 'Translator or interpreter',
    family: 'Language',
    summary: 'Carries meaning between languages for documents, services and people.',
    skills: ['translation', 'writing-clearly', 'language-learning', 'ai-evaluation'],
    entryPaths: [
      'Language certification',
      'Community interpreting (health, courts, migration)',
      'Freelance',
    ],
    aiExposure: 'high',
    aiNote:
      'Machine translation handles much routine text. Interpreting, sensitive settings and post-editing still need skilled people.',
    sources: ILO,
  },

  // Care, health & education
  {
    id: 'care-worker',
    title: 'Care worker',
    family: 'Care',
    summary: 'Supports older or disabled people with daily life at home or in care settings.',
    skills: ['caregiving', 'first-aid', 'psychological-first-aid', 'customer-service', 'teamwork'],
    entryPaths: ['Entry role with on-the-job training', 'Care certificate', 'Volunteer experience'],
    aiExposure: 'low',
    aiNote: 'Care is among the least exposed work, and demand is growing as populations age.',
    sources: ILO,
  },
  {
    id: 'community-health-worker',
    title: 'Community health worker',
    family: 'Health',
    summary: 'Connects communities to health services through education, visits and follow-up.',
    skills: [
      'community-health',
      'first-aid',
      'psychological-first-aid',
      'facilitation',
      'digital-basics',
    ],
    entryPaths: ['Government or NGO community health programmes', 'Health volunteer roles'],
    aiExposure: 'low',
    aiNote:
      'Face-to-face trust is the core of the job. AI tools can help with records and referrals.',
    sources: ILO,
  },
  {
    id: 'early-childhood-educator',
    title: 'Early childhood educator',
    family: 'Education',
    summary: 'Cares for and teaches young children in nurseries, pre-schools or home settings.',
    skills: ['early-childhood', 'first-aid', 'speaking-presenting', 'teamwork'],
    entryPaths: ['Assistant role with training', 'Early childhood certificate'],
    aiExposure: 'low',
    aiNote: 'Low exposure: young children learn through people.',
    sources: ILO,
  },
  {
    id: 'teaching-assistant',
    title: 'Teaching assistant or tutor',
    family: 'Education',
    summary: 'Supports learners one-to-one or in small groups.',
    skills: [
      'speaking-presenting',
      'facilitation',
      'literacy-numeracy',
      'learning-to-learn',
      'ai-literacy',
    ],
    entryPaths: ['Volunteer tutoring', 'School assistant role', 'Online tutoring platforms'],
    aiExposure: 'medium',
    aiNote: 'AI tutors help with practice. Motivation, care and knowing each learner stay human.',
    sources: ILO,
  },

  // Trades, green & logistics
  {
    id: 'electrician',
    title: 'Electrician',
    family: 'Skilled trades',
    summary: 'Installs, repairs and tests electrical systems in homes and buildings.',
    skills: ['electrical-basics', 'construction-safety', 'problem-solving', 'customer-service'],
    entryPaths: [
      'Apprenticeship',
      'Vocational college',
      'Licence or certification (check local rules)',
    ],
    aiExposure: 'low',
    aiNote:
      'Physical, regulated work with low exposure — and rising demand from solar and electrification.',
    sources: ILO,
  },
  {
    id: 'plumber',
    title: 'Plumber',
    family: 'Skilled trades',
    summary: 'Installs and repairs water, drainage and heating systems.',
    skills: ['plumbing-basics', 'construction-safety', 'problem-solving', 'customer-service'],
    entryPaths: ['Apprenticeship', 'Vocational college', 'Work alongside an experienced plumber'],
    aiExposure: 'low',
    aiNote: 'Hands-on work with low exposure to generative AI.',
    sources: ILO,
  },
  {
    id: 'solar-technician',
    title: 'Solar PV technician',
    family: 'Green jobs',
    summary: 'Installs and maintains solar panels and batteries for homes, farms and businesses.',
    skills: ['solar-installation', 'electrical-basics', 'construction-safety', 'customer-service'],
    entryPaths: [
      'Solar installer training',
      'Electrical apprenticeship',
      'Work with an installation company',
    ],
    aiExposure: 'low',
    aiNote: 'Low exposure and growing demand as countries expand clean energy.',
    sources: ILO,
  },
  {
    id: 'energy-efficiency-advisor',
    title: 'Energy efficiency advisor',
    family: 'Green jobs',
    summary: 'Helps households and businesses cut energy use and bills.',
    skills: ['energy-efficiency', 'climate-literacy', 'customer-service', 'spreadsheets'],
    entryPaths: [
      'Energy assessor training',
      'Utility or council programmes',
      'Construction background',
    ],
    aiExposure: 'low',
    aiNote: 'Site visits and advice are hard to automate; AI helps with calculations and reports.',
    sources: ILO,
  },
  {
    id: 'delivery-driver',
    title: 'Delivery or transport driver',
    family: 'Transport & logistics',
    summary: 'Moves goods or people safely and on time.',
    skills: ['professional-driving', 'customer-service', 'logistics', 'digital-basics'],
    entryPaths: ['Driving licence for the vehicle class', 'Platform or company onboarding'],
    aiExposure: 'low',
    aiNote:
      'Low exposure to generative AI. Platform work can be unstable, so pairing it with a longer-term plan helps.',
    sources: ILO,
  },

  // Agriculture & food
  {
    id: 'climate-smart-farmer',
    title: 'Climate-smart farmer',
    family: 'Agriculture',
    summary: 'Runs a farm that stays productive through drought, heat and changing markets.',
    skills: ['climate-smart-farming', 'agribusiness', 'personal-finance', 'climate-literacy'],
    entryPaths: [
      'Extension services and farmer groups',
      'Cooperatives',
      'Agricultural training programmes',
    ],
    aiExposure: 'low',
    aiNote: 'AI weather and market tools can help farmers decide; the work itself stays hands-on.',
    sources: ILO,
  },
  {
    id: 'cook',
    title: 'Cook',
    family: 'Food & hospitality',
    summary: 'Prepares food safely in restaurants, canteens or a food business.',
    skills: ['food-safety', 'teamwork', 'time-management', 'entrepreneurship'],
    entryPaths: ['Kitchen assistant role', 'Culinary training', 'Food stall or catering business'],
    aiExposure: 'low',
    aiNote: 'Low exposure to generative AI.',
    sources: ILO,
  },
];
