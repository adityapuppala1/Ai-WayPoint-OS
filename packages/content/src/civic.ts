import type { CivicChecklist, GovPortal, SourceRef } from './types';

/**
 * Life-event checklists and official "front doors" to government services.
 *
 * The generic (`ZZ`) checklists are practical steps that apply almost anywhere; they link to
 * nothing country-specific. Country checklists add official links, checked on 2026-09-29.
 * Items are ordered by urgency. Plain language; no legal or medical advice.
 */

const CHECKED = '2026-09-29';
const src = (url: string, title: string): SourceRef => ({ url, title, checkedAt: CHECKED });

export const CIVIC_CHECKLISTS: CivicChecklist[] = [
  // ───────────────────────────── Generic (works anywhere) ─────────────────────────────
  {
    event: 'job-loss',
    country: 'ZZ',
    title: 'If you have lost your job',
    intro:
      'Losing work is hard, and it is not a measure of your worth. These steps protect your money and rights first, then help you plan what comes next.',
    items: [
      {
        id: 'get-it-in-writing',
        title: 'Get the decision and your final pay details in writing',
        detail:
          'Ask for your termination letter, last payslip, any unpaid wages, holiday pay, notice pay and severance. Keep copies somewhere safe.',
        urgency: 'now',
      },
      {
        id: 'check-benefits',
        title: 'Check unemployment support straight away',
        detail:
          'Many countries have unemployment insurance or benefits with short deadlines to apply. Apply as soon as you can, even if you are not sure you qualify.',
        urgency: 'now',
      },
      {
        id: 'protect-essentials',
        title: 'Work out how long your money lasts',
        detail:
          'List essential costs (housing, food, power, medicine, minimum debt payments). Money in Waypoint can show your runway and what to pause.',
        urgency: 'this-week',
      },
      {
        id: 'health-cover',
        title: 'Check what happens to health cover and pension',
        detail:
          'If your health insurance or pension came through your job, find out when it ends and how to keep it or move it.',
        urgency: 'this-week',
      },
      {
        id: 'talk-to-lenders',
        title: 'Talk to lenders before you miss a payment',
        detail:
          'Banks and landlords often have hardship options that are easier to get before a payment is missed.',
        urgency: 'this-week',
      },
      {
        id: 'references',
        title: 'Ask for references and save your work records',
        detail:
          'Ask a manager or colleague for a reference while things are fresh. Save examples of your work you are allowed to keep.',
        urgency: 'this-week',
      },
      {
        id: 'plan-next',
        title: 'Make a short plan for your next role',
        detail:
          'Path can suggest roles that fit your skills and build a week-by-week plan, including one small project that shows what you can do.',
        urgency: 'this-month',
      },
      {
        id: 'watch-for-scams',
        title: 'Be careful of job offers that ask you to pay',
        detail:
          'People who have just lost work are targeted by fake jobs and loan apps. Check any offer in Shield before you pay or share documents.',
        urgency: 'this-month',
      },
      {
        id: 'look-after-yourself',
        title: 'Keep a routine and stay connected',
        detail:
          'Sleep, movement and people you trust make the search easier. If it starts to feel too heavy, talking to someone helps.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'first-job',
    country: 'ZZ',
    title: 'Starting your first job',
    intro: 'A few things to set up early so your first job protects you and pays you properly.',
    items: [
      {
        id: 'contract',
        title: 'Read your contract or offer before you sign',
        detail:
          'Check pay, hours, notice period, probation and who you report to. Ask about anything unclear — asking is normal.',
        urgency: 'now',
      },
      {
        id: 'tax-id',
        title: 'Register for tax and social security if needed',
        detail:
          'Many countries need a tax number or social security registration before your first pay. Your employer can tell you what they need.',
        urgency: 'this-week',
      },
      {
        id: 'bank-account',
        title: 'Open an account in your own name for your pay',
        detail: 'Never share your bank login, PIN or OTPs with an employer or recruiter.',
        urgency: 'this-week',
      },
      {
        id: 'first-payslip',
        title: 'Check your first payslip',
        detail: 'Make sure hours, pay rate and deductions match what you agreed.',
        urgency: 'this-month',
      },
      {
        id: 'save-first',
        title: 'Start a small buffer from your first pay',
        detail: 'Even a small, automatic amount builds a safety net for surprises.',
        urgency: 'this-month',
      },
      {
        id: 'record-wins',
        title: 'Keep a record of what you learn and achieve',
        detail:
          'Write down what you finish and what you learn while it is fresh, and update your skills in Path. It makes your next application or pay conversation easier.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'moving-country',
    country: 'ZZ',
    title: 'Moving to a new country',
    intro:
      'The first weeks decide a lot. Get your legal status, money and support in place before anything else.',
    items: [
      {
        id: 'legal-status',
        title: 'Keep your visa or residence documents safe and know their dates',
        detail:
          'Make digital copies. Never give your passport to an employer or agent — keeping it from you is a warning sign of trafficking.',
        urgency: 'now',
      },
      {
        id: 'register',
        title: 'Register where you live if the country requires it',
        detail: 'Some countries require registering your address within days of arriving.',
        urgency: 'now',
      },
      {
        id: 'embassy',
        title: 'Save your embassy’s emergency number',
        detail:
          'Your country’s embassy or consulate can help if you lose documents or are in danger.',
        urgency: 'now',
      },
      {
        id: 'emergency-numbers',
        title: 'Learn the local emergency number',
        detail: 'Waypoint shows it on the Support page once you set your country.',
        urgency: 'now',
      },
      {
        id: 'bank-and-id',
        title: 'Get a local ID number, bank account and phone number',
        detail: 'These often unlock everything else: renting, work, healthcare.',
        urgency: 'this-week',
      },
      {
        id: 'healthcare',
        title: 'Find out how healthcare works and register with a clinic',
        detail: 'Check whether you need insurance and what to do in an emergency.',
        urgency: 'this-month',
      },
      {
        id: 'qualifications',
        title: 'Check whether your qualifications are recognised',
        detail: 'Some jobs need recognition of your degree or licence before you can work in them.',
        urgency: 'this-month',
      },
      {
        id: 'community',
        title: 'Find your people',
        detail: 'Circles can connect you with others who moved recently or speak your language.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'moving-city',
    country: 'ZZ',
    title: 'Moving to a new city',
    intro: 'Small admin now saves missed letters, fines and benefits later.',
    items: [
      {
        id: 'update-address',
        title: 'Update your address with your bank, employer and government',
        detail: 'Missing letters can mean missed deadlines, bills or benefits.',
        urgency: 'this-week',
      },
      {
        id: 'rental-check',
        title: 'See a home in person before paying a deposit',
        detail: 'Fake rental listings are common. Check the landlord and the contract.',
        urgency: 'now',
      },
      {
        id: 'local-services',
        title: 'Register with a local clinic and school if needed',
        detail: 'Some services are tied to where you live.',
        urgency: 'this-month',
      },
      {
        id: 'surroundings',
        title: 'Learn your new surroundings',
        detail:
          'Surroundings shows the weather, air quality and sun where you are, and what they mean for your day.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'new-baby',
    country: 'ZZ',
    title: 'Having a baby',
    intro: 'A lot changes at once. These are the things with deadlines.',
    items: [
      {
        id: 'register-birth',
        title: 'Register the birth',
        detail:
          'Birth registration often has a legal deadline and is needed for ID, healthcare and benefits.',
        urgency: 'now',
      },
      {
        id: 'health-checks',
        title: 'Book health checks and vaccinations for your baby',
        detail: 'Ask your clinic for the schedule used in your country.',
        urgency: 'this-week',
      },
      {
        id: 'leave-and-pay',
        title: 'Check parental leave and pay',
        detail: 'Find out what leave you and your partner can take and how to claim it.',
        urgency: 'this-week',
      },
      {
        id: 'family-benefits',
        title: 'Apply for family or child benefits',
        detail:
          'Many countries support families with young children. Apply early — some are not backdated.',
        urgency: 'this-month',
      },
      {
        id: 'your-wellbeing',
        title: 'Look after your own wellbeing',
        detail:
          'Low mood after birth is common and treatable. Tell a health worker if you feel very low or anxious.',
        urgency: 'this-month',
      },
    ],
    sources: [],
  },
  {
    event: 'bereavement',
    country: 'ZZ',
    title: 'When someone dies',
    intro: 'There is no right way to grieve. Only a few things are urgent; the rest can wait.',
    items: [
      {
        id: 'certificate',
        title: 'Get the medical certificate and register the death',
        detail: 'Registration often has a deadline and is needed for almost everything else.',
        urgency: 'now',
      },
      {
        id: 'funeral',
        title: 'Arrange the funeral or burial',
        detail: 'Check whether the person left wishes, insurance or a funeral plan.',
        urgency: 'now',
      },
      {
        id: 'secure-home',
        title: 'Secure their home, belongings and documents',
        detail: 'Keep bank cards, ID and keys safe. Scammers target grieving families.',
        urgency: 'this-week',
      },
      {
        id: 'notify',
        title: 'Tell banks, employer, pension and government services',
        detail: 'Stopping payments and accounts early avoids overpayments you may have to return.',
        urgency: 'this-month',
      },
      {
        id: 'will-estate',
        title: 'Find out about the will and the estate',
        detail: 'Rules differ by country and religion. Free legal advice services can help.',
        urgency: 'this-month',
      },
      {
        id: 'bereavement-support',
        title: 'Check bereavement benefits and support',
        detail: 'Some countries offer payments or leave for bereaved partners and children.',
        urgency: 'this-month',
      },
      {
        id: 'grief-support',
        title: 'Let people support you',
        detail:
          'Grief can hit in waves, even months later. Talking helps, whether to friends, a group or a helpline.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'retirement',
    country: 'ZZ',
    title: 'Planning to retire',
    intro: 'Good decisions here can add years of security. Start well before your last day.',
    items: [
      {
        id: 'pension-forecast',
        title: 'Get a forecast of your state and work pensions',
        detail: 'Find out how much, from when, and whether working longer changes it.',
        urgency: 'this-month',
      },
      {
        id: 'find-old-pensions',
        title: 'Find pensions from old jobs',
        detail: 'Many people lose track of small pensions from earlier employers.',
        urgency: 'this-month',
      },
      {
        id: 'budget',
        title: 'Make a retirement budget',
        detail: 'Compare expected income with essential costs, including health.',
        urgency: 'this-month',
      },
      {
        id: 'pension-scams',
        title: 'Watch for pension and investment scams',
        detail:
          'Be wary of anyone offering to “unlock” your pension early or promising high returns.',
        urgency: 'this-month',
      },
      {
        id: 'purpose',
        title: 'Plan how you want to spend your time',
        detail:
          'Volunteering, part-time work, learning and people keep life meaningful. Goals can help you shape it.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'disability',
    country: 'ZZ',
    title: 'Living with a new disability or long-term condition',
    intro: 'You have rights, and there is often more support than people know about.',
    items: [
      {
        id: 'medical-records',
        title: 'Keep copies of medical assessments and letters',
        detail: 'Most support applications need evidence.',
        urgency: 'this-week',
      },
      {
        id: 'disability-benefits',
        title: 'Check disability benefits and allowances',
        detail: 'Support may cover living costs, mobility, care or equipment.',
        urgency: 'this-month',
      },
      {
        id: 'work-adjustments',
        title: 'Ask your employer or school about adjustments',
        detail:
          'Many countries require reasonable adjustments so you can keep working or studying.',
        urgency: 'this-month',
      },
      {
        id: 'peer-support',
        title: 'Connect with people who understand',
        detail: 'Disability organisations and peer groups share practical know-how.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'serious-illness',
    country: 'ZZ',
    title: 'Facing a serious illness',
    intro:
      'Focus on treatment first. These steps reduce money and paperwork worries along the way.',
    items: [
      {
        id: 'questions',
        title: 'Write down your questions for each appointment',
        detail:
          'Bring someone with you if you can. It is fine to ask for things to be explained again.',
        urgency: 'now',
      },
      {
        id: 'sick-pay',
        title: 'Check sick pay, leave and insurance',
        detail: 'Find out what your employer, insurance or government provides and how to claim.',
        urgency: 'this-week',
      },
      {
        id: 'costs',
        title: 'Ask about treatment costs and financial help',
        detail: 'Hospitals and charities often have support schemes for costs and travel.',
        urgency: 'this-week',
      },
      {
        id: 'trusted-person',
        title: 'Choose someone who can act for you if needed',
        detail: 'Some countries let you name a person for health or money decisions.',
        urgency: 'this-month',
      },
      {
        id: 'emotional-support',
        title: 'Get emotional support too',
        detail: 'Fear and low mood are normal. Patient groups and counselling can help.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'starting-business',
    country: 'ZZ',
    title: 'Starting a small business',
    intro:
      'Test the idea cheaply, then make it official. Keep business and personal money apart from day one.',
    items: [
      {
        id: 'test-demand',
        title: 'Test demand before spending much',
        detail:
          'Sell to a few real customers first. Their feedback is worth more than a perfect plan.',
        urgency: 'this-month',
      },
      {
        id: 'register',
        title: 'Register the business and get any licences',
        detail: 'Rules depend on your country, city and the type of business.',
        urgency: 'this-month',
      },
      {
        id: 'tax',
        title: 'Understand the taxes you must pay',
        detail: 'Set aside a share of each payment for tax so the bill is not a shock.',
        urgency: 'this-month',
      },
      {
        id: 'separate-money',
        title: 'Open a separate account for the business',
        detail: 'It makes tax, loans and knowing your real profit much easier.',
        urgency: 'this-month',
      },
      {
        id: 'avoid-debt-traps',
        title: 'Be careful with high-cost loans',
        detail: 'Compare offers and check a lender is registered before you borrow.',
        urgency: 'later',
      },
    ],
    sources: [],
  },
  {
    event: 'disaster',
    country: 'ZZ',
    title: 'After a flood, storm, fire or earthquake',
    intro: 'Safety first, then records, then recovery. Official alerts come before social media.',
    items: [
      {
        id: 'safety',
        title: 'Follow official instructions and stay safe',
        detail:
          'Do not return home until authorities say it is safe. Avoid floodwater and damaged buildings.',
        urgency: 'now',
      },
      {
        id: 'contact-family',
        title: 'Let family know you are safe',
        detail: 'Short messages use less battery and network than calls.',
        urgency: 'now',
      },
      {
        id: 'photos',
        title: 'Photograph damage before cleaning up',
        detail: 'Insurers and relief programmes usually need evidence.',
        urgency: 'this-week',
      },
      {
        id: 'relief',
        title: 'Apply for emergency relief',
        detail:
          'Governments and aid groups often provide cash, shelter or food. Apply only through official channels.',
        urgency: 'this-week',
      },
      {
        id: 'fake-charities',
        title: 'Watch for fake charities and repair scams',
        detail: 'Disasters attract scammers. Check organisations before you give or pay.',
        urgency: 'this-month',
      },
      {
        id: 'recovery',
        title: 'Look after your mind as well as your home',
        detail: 'Stress after a disaster is normal and can show up later. Support is available.',
        urgency: 'later',
      },
    ],
    sources: [],
  },

  // ───────────────────────────── Country-specific ─────────────────────────────
  {
    event: 'job-loss',
    country: 'IN',
    title: 'If you have lost your job in India',
    intro: 'Official places to start, alongside the general steps below.',
    items: [
      {
        id: 'ncs-register',
        title: 'Register on the National Career Service portal',
        detail: 'Find jobs, career counselling and job fairs from the Ministry of Labour.',
        urgency: 'this-week',
        links: [{ label: 'National Career Service', url: 'https://www.ncs.gov.in/' }],
      },
      {
        id: 'myscheme',
        title: 'Check government schemes you may qualify for',
        detail: 'myScheme lets you search central and state schemes by your situation.',
        urgency: 'this-week',
        links: [{ label: 'myScheme', url: 'https://www.myscheme.gov.in/' }],
      },
      {
        id: 'skill-india',
        title: 'Look at free courses on SWAYAM',
        detail: 'Free online courses from Indian universities, many with certificates.',
        urgency: 'this-month',
        links: [{ label: 'SWAYAM', url: 'https://swayam.gov.in/' }],
      },
      {
        id: 'mental-health',
        title: 'Talk to someone if it feels heavy',
        detail: 'Tele MANAS (14416) is free and available day and night in many languages.',
        urgency: 'later',
      },
    ],
    sources: [
      src('https://www.ncs.gov.in/', 'National Career Service'),
      src('https://www.myscheme.gov.in/', 'myScheme'),
      src('https://swayam.gov.in/', 'SWAYAM'),
    ],
  },
  {
    event: 'job-loss',
    country: 'GB',
    title: 'If you have lost your job in the UK',
    intro: 'Official places to start, alongside the general steps below.',
    items: [
      {
        id: 'check-benefits-gb',
        title: 'Check what support you can get',
        detail: 'The official checker points you to benefits and cost-of-living help.',
        urgency: 'now',
        links: [
          {
            label: 'Check benefits and financial support',
            url: 'https://www.gov.uk/check-benefits-financial-support',
          },
        ],
      },
      {
        id: 'universal-credit',
        title: 'See whether to claim Universal Credit',
        detail:
          'A monthly payment to help with living costs if you are on a low income or out of work.',
        urgency: 'now',
        links: [{ label: 'Universal Credit', url: 'https://www.gov.uk/universal-credit' }],
      },
      {
        id: 'money-guidance',
        title: 'Get free money guidance',
        detail: 'MoneyHelper is free, impartial and backed by the government.',
        urgency: 'this-week',
        links: [{ label: 'MoneyHelper', url: 'https://www.moneyhelper.org.uk/en' }],
      },
    ],
    sources: [
      src(
        'https://www.gov.uk/check-benefits-financial-support',
        'GOV.UK: check benefits and financial support',
      ),
      src('https://www.gov.uk/universal-credit', 'GOV.UK: Universal Credit'),
      src('https://www.moneyhelper.org.uk/en', 'MoneyHelper (Money and Pensions Service)'),
    ],
  },
  {
    event: 'job-loss',
    country: 'US',
    title: 'If you have lost your job in the United States',
    intro: 'Official places to start, alongside the general steps below.',
    items: [
      {
        id: 'unemployment-insurance',
        title: 'Apply for unemployment insurance in your state',
        detail:
          'It pays you money if you lost your job through no fault of your own. Apply quickly.',
        urgency: 'now',
        links: [
          {
            label: 'USAGov: unemployment benefits',
            url: 'https://www.usa.gov/unemployment-benefits',
          },
        ],
      },
      {
        id: 'benefit-finder',
        title: 'Find other benefits you may qualify for',
        detail: 'Food, health, housing and other help, filtered to your situation.',
        urgency: 'this-week',
        links: [{ label: 'USAGov benefit finder', url: 'https://www.usa.gov/benefit-finder' }],
      },
      {
        id: 'money-tools',
        title: 'Use free, impartial money tools',
        detail:
          'The Consumer Financial Protection Bureau has guides on debt, credit and budgeting.',
        urgency: 'this-week',
        links: [
          { label: 'CFPB consumer tools', url: 'https://www.consumerfinance.gov/consumer-tools/' },
        ],
      },
    ],
    sources: [
      src('https://www.usa.gov/unemployment-benefits', 'USAGov: unemployment benefits'),
      src('https://www.usa.gov/benefit-finder', 'USAGov: benefit finder'),
      src(
        'https://www.consumerfinance.gov/consumer-tools/',
        'Consumer Financial Protection Bureau: consumer tools',
      ),
    ],
  },
  {
    event: 'job-loss',
    country: 'CA',
    title: 'If you have lost your job in Canada',
    intro: 'Official places to start, alongside the general steps below.',
    items: [
      {
        id: 'employment-insurance',
        title: 'Apply for Employment Insurance (EI)',
        detail:
          'Apply as soon as you stop working, even if you have not received your record of employment.',
        urgency: 'now',
        links: [
          {
            label: 'Employment Insurance',
            url: 'https://www.canada.ca/en/services/benefits/ei.html',
          },
        ],
      },
      {
        id: 'benefits-finder-ca',
        title: 'Find other federal benefits',
        detail: 'Filter by your situation and province or territory.',
        urgency: 'this-week',
        links: [
          {
            label: 'Benefits Finder',
            url: 'https://www.canada.ca/en/services/benefits/finder.html',
          },
        ],
      },
    ],
    sources: [
      src('https://www.canada.ca/en/services/benefits/ei.html', 'Canada.ca: Employment Insurance'),
      src('https://www.canada.ca/en/services/benefits/finder.html', 'Canada.ca: Benefits Finder'),
    ],
  },
];

const portal = (country: string, name: string, url: string, what: string): GovPortal => ({
  country,
  name,
  url,
  what,
  sources: [src(url, name)],
});

export const GOV_PORTALS: GovPortal[] = [
  portal(
    'IN',
    'National Portal of India',
    'https://www.india.gov.in/',
    'Single-window access to government information and services.',
  ),
  portal(
    'IN',
    'myScheme',
    'https://www.myscheme.gov.in/',
    'Search and check eligibility for central and state government schemes.',
  ),
  portal(
    'IN',
    'National Career Service',
    'https://www.ncs.gov.in/',
    'Government job search, career counselling and job fairs.',
  ),
  portal('GB', 'GOV.UK', 'https://www.gov.uk/', 'Government services and information for the UK.'),
  portal(
    'GB',
    'Check benefits and financial support',
    'https://www.gov.uk/check-benefits-financial-support',
    'Find out what help with living costs you might get.',
  ),
  portal('US', 'USAGov', 'https://www.usa.gov/', 'The official guide to US government services.'),
  portal(
    'US',
    'USAGov benefit finder',
    'https://www.usa.gov/benefit-finder',
    'Find government benefits you may be eligible for.',
  ),
  portal(
    'CA',
    'Canada.ca Benefits Finder',
    'https://www.canada.ca/en/services/benefits/finder.html',
    'Find federal programs and benefits.',
  ),
  portal(
    'AU',
    'myGov',
    'https://my.gov.au/',
    'Access Australian government services in one place.',
  ),
  portal(
    'NZ',
    'Govt.nz',
    'https://www.govt.nz/',
    'A guide to finding and using New Zealand government services.',
  ),
  portal(
    'IE',
    'Citizens Information',
    'https://www.citizensinformation.ie/en/',
    'Your rights and entitlements in Ireland.',
  ),
  portal(
    'ZA',
    'South African Government',
    'https://www.gov.za/',
    'Public services and government information.',
  ),
  portal(
    'KE',
    'eCitizen',
    'https://www.ecitizen.go.ke/',
    'Kenya’s portal for paying for and applying to government services.',
  ),
  portal('RW', 'IremboGov', 'https://irembo.gov.rw/', 'Rwanda’s portal for government services.'),
  portal('BR', 'gov.br', 'https://www.gov.br/pt-br', 'Federal government services in one place.'),
  portal('MX', 'gob.mx', 'https://www.gob.mx/', 'Mexico’s federal government portal.'),
  portal(
    'AR',
    'Argentina.gob.ar',
    'https://www.argentina.gob.ar/',
    'Official portal of the Argentine state: services and procedures.',
  ),
  portal(
    'CO',
    'GOV.CO',
    'https://www.gov.co/',
    'Colombia’s portal for online and in-person government procedures.',
  ),
  portal(
    'CL',
    'ChileAtiende',
    'https://www.chileatiende.gob.cl/',
    'Benefits and services from the Chilean state.',
  ),
  portal('PE', 'gob.pe', 'https://www.gob.pe/', 'Peru’s single government portal.'),
  portal(
    'ES',
    'Punto de Acceso General',
    'https://administracion.gob.es/',
    'Spain’s central portal for public services.',
  ),
  portal(
    'FR',
    'Service-Public',
    'https://www.service-public.gouv.fr/',
    'Your rights and everyday procedures in France.',
  ),
  portal(
    'DE',
    'Bundesportal',
    'https://verwaltung.bund.de/',
    'Germany’s federal administration services portal.',
  ),
  portal(
    'PT',
    'gov.pt',
    'https://www.gov.pt/',
    'Portugal’s portal for public services and practical guides.',
  ),
  portal('PL', 'gov.pl', 'https://www.gov.pl/', 'Poland’s portal for public services online.'),
  portal('UA', 'Diia', 'https://diia.gov.ua/', 'Ukraine’s unified portal for state services.'),
  portal('TR', 'e-Devlet', 'https://www.turkiye.gov.tr/', 'Türkiye’s e-government gateway.'),
  portal(
    'EG',
    'Digital Egypt',
    'https://digital.gov.eg/',
    'Egypt’s digital government services platform.',
  ),
  portal(
    'SA',
    'Unified National Platform',
    'https://my.gov.sa/en',
    'Saudi government services and information in one place.',
  ),
  portal('AE', 'u.ae', 'https://u.ae/en', 'The official UAE government portal.'),
  portal('MY', 'MyGOV', 'https://www.malaysia.gov.my/', 'Malaysia’s government services portal.'),
  portal(
    'SG',
    'gov.sg',
    'https://www.gov.sg/',
    'Official information from the Singapore Government.',
  ),
  portal(
    'ID',
    'Indonesia.go.id',
    'https://indonesia.go.id/',
    'Indonesia’s government information and services portal.',
  ),
  portal('PH', 'GOV.PH', 'https://www.gov.ph/', 'The Philippine government’s official portal.'),
  portal(
    'VN',
    'National Public Service Portal',
    'https://dichvucong.gov.vn/',
    'Vietnam’s national portal for public services.',
  ),
  portal(
    'JP',
    'e-Gov',
    'https://www.e-gov.go.jp/',
    'Japan’s portal for administrative information and online applications.',
  ),
  portal(
    'KR',
    'Government24',
    'https://www.gov.kr/',
    'Korea’s portal for government services and documents.',
  ),
];
