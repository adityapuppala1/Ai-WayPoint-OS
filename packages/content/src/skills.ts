import type { Skill } from './types';

/**
 * Waypoint's skill taxonomy: small on purpose, so a person can place themselves on it in a
 * minute. Skills are practical and portable across countries. Where a skill maps to ESCO or
 * O*NET concepts, the name follows common usage rather than the formal label.
 */
export const SKILLS: Skill[] = [
  // Foundational
  {
    id: 'literacy-numeracy',
    name: 'Everyday reading, writing and numbers',
    category: 'foundational',
    description:
      'Reading forms and instructions, writing short messages, and working with percentages, budgets and measurements.',
  },
  {
    id: 'problem-solving',
    name: 'Problem solving',
    category: 'foundational',
    description: 'Breaking a problem into parts, trying options and checking whether a fix worked.',
  },
  {
    id: 'learning-to-learn',
    name: 'Learning how to learn',
    category: 'foundational',
    description:
      'Planning practice, remembering what you learn and staying motivated when it gets hard.',
  },
  {
    id: 'time-management',
    name: 'Planning and time management',
    category: 'foundational',
    description: 'Prioritising tasks, estimating time and keeping commitments.',
  },
  {
    id: 'teamwork',
    name: 'Working with others',
    category: 'foundational',
    description: 'Sharing work, giving and receiving feedback, and resolving disagreements calmly.',
  },
  {
    id: 'customer-service',
    name: 'Customer service',
    category: 'foundational',
    description:
      'Helping people with questions and problems patiently, in person, by phone or in writing.',
  },

  // Digital
  {
    id: 'digital-basics',
    name: 'Using a computer and smartphone',
    category: 'digital',
    description:
      'Files, apps, settings, browsers and forms — the basics that everything else builds on.',
  },
  {
    id: 'online-safety',
    name: 'Staying safe online',
    category: 'digital',
    description:
      'Strong passwords, two-step verification, spotting scams and protecting your privacy.',
  },
  {
    id: 'office-docs',
    name: 'Documents and presentations',
    category: 'digital',
    description: 'Writing, formatting and sharing documents and slides.',
  },
  {
    id: 'spreadsheets',
    name: 'Spreadsheets',
    category: 'digital',
    description: 'Tables, formulas, sorting and simple charts in Excel, Google Sheets or similar.',
  },
  {
    id: 'online-collaboration',
    name: 'Email and online collaboration',
    category: 'digital',
    description: 'Professional email, shared drives, video calls and team chat.',
  },
  {
    id: 'social-media-marketing',
    name: 'Social media marketing',
    category: 'digital',
    description:
      'Planning posts, growing an audience and reading basic results for a business or cause.',
  },
  {
    id: 'web-content',
    name: 'Websites and online content',
    category: 'digital',
    description: 'Updating websites, writing for the web and basic search visibility.',
  },

  // Data
  {
    id: 'data-cleaning',
    name: 'Data cleaning',
    category: 'data',
    description: 'Finding and fixing errors, duplicates and gaps so data can be trusted.',
  },
  {
    id: 'data-analysis',
    name: 'Data analysis',
    category: 'data',
    description: 'Asking clear questions of data and turning the answers into decisions.',
  },
  {
    id: 'data-visualisation',
    name: 'Data visualisation',
    category: 'data',
    description: 'Charts and dashboards that make numbers easy to understand.',
  },
  {
    id: 'sql',
    name: 'SQL',
    category: 'data',
    description: 'Querying databases to find, join and summarise data.',
  },
  {
    id: 'statistics-basics',
    name: 'Statistics basics',
    category: 'data',
    description: 'Averages, spread, sampling, probability and knowing when a difference is real.',
  },

  // AI
  {
    id: 'ai-literacy',
    name: 'Understanding AI',
    category: 'ai',
    description:
      'What AI can and cannot do, where it makes mistakes, and how to use it responsibly.',
  },
  {
    id: 'prompting',
    name: 'Working with AI assistants',
    category: 'ai',
    description:
      'Giving clear instructions and context, checking output and iterating to good results.',
  },
  {
    id: 'ai-automation',
    name: 'Automating work with AI and no-code tools',
    category: 'ai',
    description: 'Connecting apps and AI to remove repetitive steps from everyday work.',
  },
  {
    id: 'ai-evaluation',
    name: 'Checking AI output',
    category: 'ai',
    description: 'Testing AI results for accuracy, bias and safety before they are used.',
  },
  {
    id: 'ml-basics',
    name: 'Machine learning basics',
    category: 'ai',
    description:
      'How models learn from data, how they are trained and evaluated, and common pitfalls.',
  },

  // Software
  {
    id: 'programming-basics',
    name: 'Programming basics (Python)',
    category: 'software',
    description: 'Variables, loops, functions and small scripts that automate tasks.',
  },
  {
    id: 'web-development',
    name: 'Web development',
    category: 'software',
    description: 'Building web pages and apps with HTML, CSS and JavaScript.',
  },
  {
    id: 'version-control',
    name: 'Version control (Git)',
    category: 'software',
    description: 'Tracking changes and collaborating on code safely.',
  },
  {
    id: 'cloud-basics',
    name: 'Cloud basics',
    category: 'software',
    description: 'How cloud services work: storage, computing, accounts and costs.',
  },
  {
    id: 'cybersecurity-basics',
    name: 'Cybersecurity basics',
    category: 'software',
    description: 'Threats, defences and how organisations protect systems and data.',
  },
  {
    id: 'it-support',
    name: 'IT support',
    category: 'software',
    description: 'Troubleshooting devices, accounts, software and networks for other people.',
  },
  {
    id: 'networking-basics',
    name: 'Networking basics',
    category: 'software',
    description: 'How devices connect: Wi-Fi, IP addresses, routers and common faults.',
  },

  // Communication
  {
    id: 'writing-clearly',
    name: 'Writing clearly',
    category: 'communication',
    description: 'Short, plain writing that people understand the first time.',
  },
  {
    id: 'speaking-presenting',
    name: 'Speaking and presenting',
    category: 'communication',
    description: 'Explaining ideas out loud with confidence, in meetings or to groups.',
  },
  {
    id: 'negotiation',
    name: 'Negotiation',
    category: 'communication',
    description: 'Preparing, listening and reaching agreements that work for both sides.',
  },
  {
    id: 'facilitation',
    name: 'Facilitating groups',
    category: 'communication',
    description: 'Running meetings, workshops and community sessions where everyone takes part.',
  },

  // Business
  {
    id: 'sales',
    name: 'Sales',
    category: 'business',
    description: 'Understanding what people need, presenting an offer honestly and following up.',
  },
  {
    id: 'project-coordination',
    name: 'Project coordination',
    category: 'business',
    description: 'Planning tasks, tracking progress and keeping people informed.',
  },
  {
    id: 'entrepreneurship',
    name: 'Running a small business',
    category: 'business',
    description: 'Finding customers, pricing, costs, cash flow and the legal basics.',
  },
  {
    id: 'logistics',
    name: 'Logistics and supply chain basics',
    category: 'business',
    description: 'Inventory, ordering, dispatch and delivery tracking.',
  },
  {
    id: 'hr-basics',
    name: 'People and HR basics',
    category: 'business',
    description: 'Recruiting, onboarding, records and fair treatment at work.',
  },

  // Finance
  {
    id: 'personal-finance',
    name: 'Personal finance',
    category: 'finance',
    description: 'Budgeting, saving, borrowing safely and avoiding financial scams.',
  },
  {
    id: 'bookkeeping',
    name: 'Bookkeeping',
    category: 'finance',
    description: 'Recording income and expenses, invoices and receipts accurately.',
  },
  {
    id: 'financial-analysis',
    name: 'Financial analysis',
    category: 'finance',
    description: 'Reading financial statements, forecasting and judging performance.',
  },

  // Care
  {
    id: 'caregiving',
    name: 'Caring for older or disabled people',
    category: 'care',
    description:
      'Personal care, dignity, safe moving and handling, and noticing changes in health.',
  },
  {
    id: 'first-aid',
    name: 'First aid',
    category: 'care',
    description: 'What to do in the first minutes of an injury or medical emergency.',
  },
  {
    id: 'early-childhood',
    name: 'Early childhood care',
    category: 'care',
    description: 'Play, learning, safety and development for young children.',
  },
  {
    id: 'community-health',
    name: 'Community health work',
    category: 'care',
    description: 'Health education, home visits, referrals and follow-up in a community.',
  },
  {
    id: 'psychological-first-aid',
    name: 'Psychological first aid',
    category: 'care',
    description: 'Supporting someone in distress: listening, calming and connecting them to help.',
  },

  // Trades
  {
    id: 'electrical-basics',
    name: 'Electrical basics',
    category: 'trades',
    description:
      'Circuits, safe isolation, wiring and testing. Paid electrical work usually needs a licence.',
  },
  {
    id: 'plumbing-basics',
    name: 'Plumbing basics',
    category: 'trades',
    description: 'Pipes, fittings, leaks and water systems.',
  },
  {
    id: 'construction-safety',
    name: 'Construction and site safety',
    category: 'trades',
    description: 'Working safely at height, with tools and on building sites.',
  },
  {
    id: 'equipment-maintenance',
    name: 'Equipment maintenance',
    category: 'trades',
    description: 'Inspecting, servicing and repairing machines and vehicles.',
  },
  {
    id: 'professional-driving',
    name: 'Professional driving',
    category: 'trades',
    description: 'Safe driving, route planning and vehicle checks for delivery or transport work.',
  },

  // Green
  {
    id: 'solar-installation',
    name: 'Solar PV installation',
    category: 'green',
    description: 'Planning, mounting, wiring and maintaining solar panels and batteries.',
  },
  {
    id: 'energy-efficiency',
    name: 'Energy efficiency',
    category: 'green',
    description:
      'Reducing energy use in homes and buildings through insulation, controls and better equipment.',
  },
  {
    id: 'circular-economy',
    name: 'Recycling and repair',
    category: 'green',
    description: 'Sorting, reuse, repair and turning waste into value.',
  },
  {
    id: 'climate-literacy',
    name: 'Understanding climate change',
    category: 'green',
    description: 'Causes, impacts and practical ways communities and businesses adapt.',
  },

  // Creative
  {
    id: 'graphic-design',
    name: 'Graphic design',
    category: 'creative',
    description: 'Layout, type, colour and images for print and screens.',
  },
  {
    id: 'video-editing',
    name: 'Video editing',
    category: 'creative',
    description: 'Cutting, sound, captions and exporting video for different platforms.',
  },
  {
    id: 'photography',
    name: 'Photography',
    category: 'creative',
    description: 'Composition, light and editing for products, people and events.',
  },
  {
    id: 'copywriting',
    name: 'Copywriting',
    category: 'creative',
    description: 'Words that inform and persuade: ads, product pages, emails and scripts.',
  },
  {
    id: 'ux-design',
    name: 'User experience design',
    category: 'creative',
    description: 'Researching what people need and designing screens that are easy to use.',
  },

  // Language
  {
    id: 'english-workplace',
    name: 'English for work',
    category: 'language',
    description: 'Emails, meetings, interviews and everyday workplace English.',
  },
  {
    id: 'language-learning',
    name: 'Learning another language',
    category: 'language',
    description: 'Building everyday conversation in a new language.',
  },
  {
    id: 'translation',
    name: 'Translation and interpreting',
    category: 'language',
    description: 'Carrying meaning accurately between languages, in writing or speech.',
  },

  // Agriculture & food
  {
    id: 'climate-smart-farming',
    name: 'Climate-smart farming',
    category: 'agriculture',
    description: 'Soil, water and crop practices that raise yields and cope with drought and heat.',
  },
  {
    id: 'agribusiness',
    name: 'Selling produce and agribusiness',
    category: 'agriculture',
    description:
      'Markets, pricing, storage, cooperatives and records for farms and food businesses.',
  },
  {
    id: 'food-safety',
    name: 'Food safety and hygiene',
    category: 'agriculture',
    description: 'Handling, storing and preparing food so it is safe to eat.',
  },
];
