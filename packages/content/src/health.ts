import type { HealthLine, SourceRef } from './types';

/**
 * Non-emergency health advice services. SAFETY-RELEVANT.
 *
 * Every entry was checked on 2026-09-29 against the service's own website or a government
 * page. `hours` and `free` are only set when a source says so. Countries without a checked
 * service get the general guidance on the Health page (emergency number, pharmacy, clinic).
 * Known gaps: Canada (811 is run by each province and territory; Manitoba uses another
 * number), the United States (no national line), and most of Africa, Asia and Latin America.
 */

const CHECKED = '2026-09-29';
const src = (url: string, title: string): SourceRef => ({ url, title, checkedAt: CHECKED });

export const HEALTH_LINES: HealthLine[] = [
  {
    id: 'gb-nhs-111',
    country: 'GB',
    name: 'NHS 111',
    phone: '111',
    url: 'https://111.nhs.uk/',
    hours: '24/7',
    free: true,
    audience:
      'Urgent medical help when it isn’t an emergency, or your GP is closed. 111 tells you where to go.',
    notes: 'In Scotland this is NHS 24 (111) and in Wales NHS 111 Wales.',
    sources: [
      src(
        'https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-use-111/',
        'NHS: When to use 111',
      ),
      src(
        'https://www.londonambulance.nhs.uk/calling-us/calling-111/',
        'London Ambulance Service NHS Trust: When to use 111',
      ),
    ],
  },
  {
    id: 'au-healthdirect',
    country: 'AU',
    name: 'healthdirect',
    phone: '1800 022 222',
    url: 'https://www.healthdirect.gov.au/',
    hours: '24/7',
    free: true,
    audience: 'Talk to a nurse or doctor about a health problem. For an emergency, call 000.',
    sources: [src('https://www.healthdirect.gov.au/', 'healthdirect Australia')],
  },
  {
    id: 'nz-healthline',
    country: 'NZ',
    name: 'Healthline',
    phone: '0800 611 116',
    url: 'https://www.healthline.govt.nz/',
    hours: '24/7',
    free: true,
    audience: 'Free health advice, any day or time.',
    sources: [
      src(
        'https://www.govt.nz/browse/health/public-health-services/free-health-advice/',
        'New Zealand Government: Free health advice',
      ),
    ],
  },
  {
    id: 'de-116117',
    country: 'DE',
    name: '116117 (Patientenservice)',
    phone: '116117',
    url: 'https://www.116117.de/',
    hours: '24/7',
    free: true,
    languages: ['de'],
    audience:
      'The medical on-call service when your practice is closed and it can’t wait until the next day. For life-threatening emergencies, call 112.',
    notes: 'Free from German phone contracts.',
    sources: [src('https://www.116117.de/', '116117: Patientenservice (KBV)')],
  },
  {
    id: 'pt-sns-24',
    country: 'PT',
    name: 'SNS 24',
    phone: '808 24 24 24',
    url: 'https://www.sns24.gov.pt/',
    hours: '24/7',
    free: true,
    languages: ['pt'],
    audience:
      'Clinical advice and help deciding where to go: care at home, a health centre or an emergency service.',
    sources: [
      src(
        'https://www.ers.pt/pt/utentes/perguntas-frequentes/faq/o-acesso-a-cuidados-de-saude-atraves-da-linha-sns-24/',
        'Entidade Reguladora da Saúde: Linha SNS 24',
      ),
    ],
  },
  {
    id: 'in-esanjeevani',
    country: 'IN',
    name: 'eSanjeevani',
    url: 'https://esanjeevani.mohfw.gov.in/',
    free: true,
    audience:
      'Free video consultations with doctors from home, run by the Ministry of Health and Family Welfare.',
    sources: [
      src(
        'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1635174',
        'PIB: eSanjeevaniOPD – free national teleconsultation service',
      ),
      src(
        'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1809569',
        'PIB: eSanjeevani records 3 crore teleconsultations',
      ),
    ],
  },
];

/**
 * Sources behind the Health and Surroundings guidance (red-flag signs, routines, heat, cold,
 * air and sun). Shown under the guidance so people can check it.
 */
export const HEALTH_SOURCES = {
  stroke: src('https://www.nhs.uk/conditions/stroke/symptoms/', 'NHS: Stroke symptoms'),
  heartAttack: src(
    'https://www.nhs.uk/conditions/heart-attack/symptoms/',
    'NHS: Heart attack symptoms',
  ),
  anaphylaxis: src('https://www.nhs.uk/conditions/anaphylaxis/', 'NHS: Anaphylaxis'),
  heatstroke: src(
    'https://www.nhs.uk/conditions/heat-exhaustion-heatstroke/',
    'NHS: Heat exhaustion and heatstroke',
  ),
  activity: src(
    'https://www.ncbi.nlm.nih.gov/books/NBK566048/',
    'WHO guidelines on physical activity and sedentary behaviour (2020)',
  ),
  sleep: src('https://www.cdc.gov/sleep/about/index.html', 'CDC: About sleep'),
  heat: src(
    'https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health',
    'WHO: Heat and health',
  ),
  heatIndex: src(
    'https://www.weather.gov/ama/heatindex',
    'US National Weather Service: Heat index',
  ),
  cold: src(
    'https://www.weather.gov/safety/cold-wind-chill-chart',
    'US National Weather Service: Wind chill',
  ),
  air: src(
    'https://www.epa.gov/pmcourse/patient-exposure-and-air-quality-index',
    'US EPA: The Air Quality Index',
  ),
  uv: src(
    'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index',
    'WHO: The UV index',
  ),
  weatherData: src('https://open-meteo.com/', 'Weather and air data: Open-Meteo.com (CC BY 4.0)'),
} as const satisfies Record<string, SourceRef>;
