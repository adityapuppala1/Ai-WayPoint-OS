import type { EmergencyNumbers, SourceRef } from './types';

/**
 * Emergency numbers per country. Safety-critical.
 *
 * Every entry was checked on 2026-09-29 against at least one official list — usually the
 * UK FCDO "getting help" page for the country (updated 2026) — and, where reachable, a second
 * official source (Australian Smartraveller, a national government or regulator page, or an
 * embassy page). Where sources disagreed, the national source won and the conflict is noted in
 * packages/content/SOURCES.md.
 */

const CHECKED = '2026-09-29';

const fcdo = (slug: string, name: string): SourceRef => ({
  url: `https://www.gov.uk/foreign-travel-advice/${slug}/getting-help`,
  title: `UK FCDO travel advice: ${name} – getting help (emergency services)`,
  checkedAt: CHECKED,
});

const smartraveller = (path: string, name: string): SourceRef => ({
  url: `https://www.smartraveller.gov.au/destinations/${path}`,
  title: `Smartraveller (Australian Government): ${name} – local contacts`,
  checkedAt: CHECKED,
});

const EU_112: SourceRef = {
  url: 'https://digital-strategy.ec.europa.eu/en/policies/112',
  title: 'European Commission: 112, the European emergency number',
  checkedAt: CHECKED,
};

export const EMERGENCY_NUMBERS: EmergencyNumbers[] = [
  // ───────────── South Asia ─────────────
  {
    country: 'IN',
    general: '112',
    notes:
      '112 connects you to police, fire, ambulance and other emergency help anywhere in India. The 112 India app can also send an alert.',
    sources: [
      {
        url: 'https://112.gov.in/',
        title: 'Emergency Response Support System (ERSS) 112, Government of India',
        checkedAt: CHECKED,
      },
      fcdo('india', 'India'),
    ],
  },
  {
    country: 'PK',
    police: '15',
    ambulance: '1122',
    fire: '1122',
    notes:
      'Rescue 1122 handles ambulance, fire and rescue. It is run by provincial governments, so coverage can vary by area. Some city fire brigades also answer 16, and the Edhi charity ambulance answers 115.',
    sources: [
      fcdo('pakistan', 'Pakistan'),
      smartraveller('asia/pakistan', 'Pakistan'),
      {
        url: 'https://rescue.gov.pk/',
        title: 'Rescue 1122 (Punjab Emergency Service)',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'BD',
    general: '999',
    notes: '999 is the national emergency number for police, fire and ambulance.',
    sources: [fcdo('bangladesh', 'Bangladesh'), smartraveller('asia/bangladesh', 'Bangladesh')],
  },
  {
    country: 'NP',
    police: '100',
    fire: '101',
    ambulance: '102',
    notes: 'Tourist police (English spoken): 1144.',
    sources: [
      fcdo('nepal', 'Nepal'),
      {
        url: 'https://np.usembassy.gov/emergency-assistance/',
        title: 'U.S. Embassy in Nepal: emergency assistance',
        checkedAt: CHECKED,
      },
      {
        url: 'https://npsc.nepalpolice.gov.np/stations/emergency-contacts/',
        title: 'Nepal Police: emergency contacts',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'LK',
    police: '119',
    ambulance: '1990',
    fire: '110',
    notes:
      '1990 Suwa Seriya is a free 24-hour ambulance service that covers the whole island. Police can also be reached on 118.',
    sources: [
      {
        url: 'https://www.1990.lk/about-us/',
        title: '1990 Suwa Seriya Foundation: about the service',
        checkedAt: CHECKED,
      },
      {
        url: 'https://www.colombo.mc.gov.lk/fire-services.php',
        title: 'Colombo Municipal Council: fire service (110)',
        checkedAt: CHECKED,
      },
      fcdo('sri-lanka', 'Sri Lanka'),
      smartraveller('asia/sri-lanka', 'Sri Lanka'),
    ],
  },

  // ───────────── Southeast Asia ─────────────
  {
    country: 'ID',
    police: '110',
    fire: '113',
    ambulance: '119',
    notes:
      '112 connects to all emergency services, free and 24 hours, in the 70+ cities and regencies that have set it up — but not yet everywhere. Some areas also use 118 for ambulances.',
    sources: [
      {
        url: 'https://layanan112.komdigi.go.id/tentang',
        title: 'Komdigi (Ministry of Communication and Digital Affairs): Call Center 112',
        checkedAt: CHECKED,
      },
      fcdo('indonesia', 'Indonesia'),
      smartraveller('asia/indonesia', 'Indonesia'),
    ],
  },
  {
    country: 'PH',
    general: '911',
    notes: '911 is the national emergency hotline for police, fire and medical help.',
    sources: [fcdo('philippines', 'Philippines'), smartraveller('asia/philippines', 'Philippines')],
  },
  {
    country: 'VN',
    police: '113',
    fire: '114',
    ambulance: '115',
    notes:
      '112 is the 24/7 national line for disasters, accidents and search and rescue. 111 is the national child protection hotline. Vietnam plans to merge 113, 114 and 115 into 113 from late 2027.',
    sources: [
      fcdo('vietnam', 'Vietnam'),
      {
        url: 'https://xaydungchinhsach.chinhphu.vn/tong-dai-so-112-tiep-nhan-24-7-cac-thong-tin-ve-su-co-thien-tai-tham-hoa-119250902150528929.htm',
        title:
          'Government of Viet Nam portal: 112 hotline receives incident and disaster reports 24/7',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'TH',
    police: '191',
    ambulance: '1669',
    fire: '199',
    notes: 'Tourist police (English spoken): 1155.',
    sources: [fcdo('thailand', 'Thailand'), smartraveller('asia/thailand', 'Thailand')],
  },
  {
    country: 'MY',
    general: '999',
    fire: '994',
    notes: '999 connects to police, ambulance and fire. From a mobile phone you can also dial 112.',
    sources: [fcdo('malaysia', 'Malaysia'), smartraveller('asia/malaysia', 'Malaysia')],
  },
  {
    country: 'SG',
    police: '999',
    ambulance: '995',
    fire: '995',
    notes:
      '995 is for emergency ambulance and fire (Singapore Civil Defence Force). 999 is for police.',
    sources: [fcdo('singapore', 'Singapore'), smartraveller('asia/singapore', 'Singapore')],
  },

  // ───────────── East Asia ─────────────
  {
    country: 'CN',
    police: '110',
    ambulance: '120',
    fire: '119',
    notes: 'Traffic accidents: 122. Calls to these numbers are free.',
    sources: [
      fcdo('china', 'China'),
      {
        url: 'https://english.beijing.gov.cn/travellinginbeijing/quickguideontravelservices/traveltips/202108/t20210811_2466839.html',
        title: 'Beijing Municipal Government: emergency numbers',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'JP',
    police: '110',
    ambulance: '119',
    fire: '119',
    notes: 'For police advice that is not urgent, call #9110 (weekdays, office hours).',
    sources: [fcdo('japan', 'Japan'), smartraveller('asia/japan', 'Japan')],
  },
  {
    country: 'KR',
    police: '112',
    ambulance: '119',
    fire: '119',
    notes:
      '1330 is the Korea Travel Hotline, with interpretation, for help that is not life-threatening.',
    sources: [
      fcdo('south-korea', 'South Korea'),
      {
        url: 'https://english.visitkorea.or.kr/svc/faq/faqMainView.do?menuSn=404&pstSn=94',
        title: 'VISITKOREA (Korea Tourism Organization): emergency FAQ',
        checkedAt: CHECKED,
      },
    ],
  },

  // ───────────── Middle East & North Africa ─────────────
  {
    country: 'AE',
    police: '999',
    ambulance: '998',
    fire: '997',
    notes: 'If you are not sure which number to call, 999 can help with any emergency.',
    sources: [
      {
        url: 'https://u.ae/en/information-and-services/justice-safety-and-the-law/Safety/handling-emergencies',
        title: 'UAE Government portal: handling emergencies',
        checkedAt: CHECKED,
      },
      fcdo('united-arab-emirates', 'United Arab Emirates'),
      smartraveller('middle-east/united-arab-emirates', 'United Arab Emirates'),
    ],
  },
  {
    country: 'SA',
    general: '911',
    police: '999',
    ambulance: '997',
    fire: '998',
    notes: '911 is the unified emergency number. If you do not have a Saudi SIM card, call 112.',
    sources: [
      fcdo('saudi-arabia', 'Saudi Arabia'),
      smartraveller('middle-east/saudi-arabia', 'Saudi Arabia'),
    ],
  },
  {
    country: 'EG',
    police: '122',
    ambulance: '123',
    fire: '180',
    notes: 'Tourist police: 126.',
    sources: [
      fcdo('egypt', 'Egypt'),
      {
        url: 'https://web.vodafone.com.eg/en/emergency-numbers',
        title: 'Vodafone Egypt: emergency numbers',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'TR',
    general: '112',
    notes:
      '112 connects to ambulance, fire, police, gendarmerie and other emergency services across Türkiye.',
    sources: [
      {
        url: 'https://www.112.gov.tr/acil-durumda-tek-numara-112',
        title: '112 Acil Çağrı Merkezi (Ministry of Interior): one number for emergencies',
        checkedAt: CHECKED,
      },
      fcdo('turkey', 'Türkiye'),
    ],
  },
  {
    country: 'MA',
    police: '190',
    ambulance: '150',
    fire: '150',
    notes:
      'Royal Gendarmerie (outside towns): 177. Older lists show 19 for police and 15 for fire and ambulance; if one number does not connect, try the other.',
    sources: [
      fcdo('morocco', 'Morocco'),
      smartraveller('africa/morocco', 'Morocco'),
      {
        url: 'https://www.syndicat-pharmaciens-marrakech.com/pharmacies-de-garde-marrakech/numeros-utiles',
        title: 'Syndicat des Pharmaciens de Marrakech: numéros utiles',
        checkedAt: CHECKED,
      },
    ],
  },

  // ───────────── Sub-Saharan Africa ─────────────
  {
    country: 'NG',
    general: '112',
    notes:
      '112 is the free national emergency number. Connections can be unreliable; if it does not work, go to the nearest police station or hospital.',
    sources: [
      {
        url: 'https://ncc.gov.ng/node/3132',
        title: 'Nigerian Communications Commission: Emergency Communications Centres (112)',
        checkedAt: CHECKED,
      },
      fcdo('nigeria', 'Nigeria'),
      smartraveller('africa/nigeria', 'Nigeria'),
    ],
  },
  {
    country: 'KE',
    general: '999',
    notes: '999 connects to police, ambulance and fire.',
    sources: [fcdo('kenya', 'Kenya'), smartraveller('africa/kenya', 'Kenya')],
  },
  {
    country: 'GH',
    general: '112',
    police: '191',
    fire: '192',
    ambulance: '193',
    notes: 'Police also answer 18555 on some networks.',
    sources: [
      fcdo('ghana', 'Ghana'),
      smartraveller('africa/ghana', 'Ghana'),
      {
        url: 'https://www.ghanaweb.com/GhanaHomePage/NewsArchive/Call-191-and-18555-to-combat-crime-Ghana-Police-Service-679169',
        title: 'Ghana Police Service statement: call 191 and 18555',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'ZA',
    general: '112',
    police: '10111',
    ambulance: '10177',
    fire: '10177',
    notes:
      '112 works from mobile phones. From a landline, call 10111 for police or 10177 for ambulance and fire.',
    sources: [
      fcdo('south-africa', 'South Africa'),
      {
        url: 'https://za.usembassy.gov/emergency-assistance/',
        title: 'U.S. Embassy & Consulates in South Africa: emergency assistance',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'ET',
    police: '991',
    ambulance: '907',
    fire: '939',
    notes:
      'These numbers work mainly in Addis Ababa (907 is the Ethiopian Red Cross ambulance). Some official lists also give 911 for police and emergencies. Outside the capital, go to the nearest police station or health centre if calls do not connect.',
    sources: [
      {
        url: 'https://et.diplomatie.gouv.fr/en/en/node/7',
        title: 'Embassy of France in Ethiopia: in case of emergency',
        checkedAt: CHECKED,
      },
      fcdo('ethiopia', 'Ethiopia'),
      smartraveller('africa/ethiopia', 'Ethiopia'),
    ],
  },
  {
    country: 'UG',
    general: '999',
    notes: '999 connects to police, fire and ambulance.',
    sources: [fcdo('uganda', 'Uganda'), smartraveller('africa/uganda', 'Uganda')],
  },
  {
    country: 'TZ',
    general: '112',
    notes: '112 connects to police, fire and ambulance.',
    sources: [fcdo('tanzania', 'Tanzania'), smartraveller('africa/tanzania', 'Tanzania')],
  },
  {
    country: 'RW',
    general: '112',
    fire: '111',
    notes: 'Traffic accidents: 113. Child helpline: 116. Gender-based violence: 3512.',
    sources: [
      {
        url: 'https://www.police.gov.rw/fileadmin/user_upload/Tender_Files/Rwanda_National_Police.pdf',
        title: 'Rwanda National Police: emergency and toll-free numbers',
        checkedAt: CHECKED,
      },
      fcdo('rwanda', 'Rwanda'),
      smartraveller('africa/rwanda', 'Rwanda'),
    ],
  },

  // ───────────── Europe ─────────────
  {
    country: 'GB',
    general: '999',
    notes:
      '112 also works. For urgent medical advice that is not life-threatening, NHS 111 can help. For police when it is not an emergency, call 101.',
    sources: [
      {
        url: 'https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/',
        title: 'NHS: when to call 999',
        checkedAt: CHECKED,
      },
      {
        url: 'https://www.ofcom.org.uk/siteassets/resources/documents/phones-telecoms-and-internet/advice/3-digit.pdf',
        title: 'Ofcom: 3-digit numbers (999, 112, 111, 101)',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'IE',
    general: '112',
    notes: '999 also works.',
    sources: [fcdo('ireland', 'Ireland'), smartraveller('europe/ireland', 'Ireland'), EU_112],
  },
  {
    country: 'DE',
    general: '112',
    police: '110',
    ambulance: '112',
    fire: '112',
    sources: [fcdo('germany', 'Germany'), EU_112],
  },
  {
    country: 'FR',
    general: '112',
    police: '17',
    ambulance: '15',
    fire: '18',
    notes:
      'People who are deaf or hard of hearing can reach emergency services on 114 (SMS, chat or video).',
    sources: [fcdo('france', 'France'), EU_112],
  },
  {
    country: 'ES',
    general: '112',
    notes: '112 connects to ambulance, fire and police.',
    sources: [fcdo('spain', 'Spain'), EU_112],
  },
  {
    country: 'IT',
    general: '112',
    ambulance: '118',
    fire: '115',
    sources: [fcdo('italy', 'Italy'), EU_112],
  },
  {
    country: 'NL',
    general: '112',
    notes: '112 connects to ambulance, fire and police.',
    sources: [fcdo('netherlands', 'Netherlands'), EU_112],
  },
  {
    country: 'PL',
    general: '112',
    police: '997',
    ambulance: '999',
    fire: '998',
    sources: [fcdo('poland', 'Poland'), EU_112],
  },
  {
    country: 'SE',
    general: '112',
    notes: '112 connects to ambulance, fire and police.',
    sources: [fcdo('sweden', 'Sweden'), EU_112],
  },
  {
    country: 'PT',
    general: '112',
    notes: '112 connects to ambulance, fire and police.',
    sources: [fcdo('portugal', 'Portugal'), EU_112],
  },
  {
    country: 'UA',
    police: '102',
    ambulance: '103',
    fire: '101',
    sources: [fcdo('ukraine', 'Ukraine')],
  },

  // ───────────── North America ─────────────
  {
    country: 'US',
    general: '911',
    notes: 'Always call 911 if you can. Text-to-911 works only in some areas.',
    sources: [
      {
        url: 'https://www.911.gov/',
        title: 'National 911 Program (U.S. Department of Transportation)',
        checkedAt: CHECKED,
      },
      {
        url: 'https://www.fcc.gov/consumers/guides/what-you-need-know-about-text-911',
        title: 'FCC: what you need to know about text-to-911',
        checkedAt: CHECKED,
      },
      fcdo('usa', 'USA'),
    ],
  },
  {
    country: 'CA',
    general: '911',
    notes:
      'People who are deaf, hard of hearing or speech-impaired can register with their mobile provider for Text with 9-1-1 in most areas.',
    sources: [
      {
        url: 'https://crtc.gc.ca/eng/phone/911/can.htm',
        title: 'CRTC: 9-1-1 services',
        checkedAt: CHECKED,
      },
      fcdo('canada', 'Canada'),
    ],
  },
  {
    country: 'MX',
    general: '911',
    notes: '911 is the single emergency number for police, medical help and fire, 24 hours a day.',
    sources: [
      fcdo('mexico', 'Mexico'),
      {
        url: 'https://www.c5.cdmx.gob.mx/canales-de-atencion-emergencias/emergencias-9-1-1',
        title: 'C5 Ciudad de México: Emergencias 9-1-1',
        checkedAt: CHECKED,
      },
    ],
  },

  // ───────────── Latin America ─────────────
  {
    country: 'BR',
    police: '190',
    ambulance: '192',
    fire: '193',
    notes: 'Civil defence: 199.',
    sources: [
      fcdo('brazil', 'Brazil'),
      {
        url: 'https://www.ssp.df.gov.br/emergencia-190-193-e-199/',
        title: 'Secretaria de Segurança Pública do DF: emergency numbers 190, 192, 193, 199',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'AR',
    general: '911',
    ambulance: '107',
    fire: '100',
    notes:
      '911 is the national emergency centre for police and ambulance. 107 (SAME) handles medical emergencies in the Buenos Aires area.',
    sources: [
      {
        url: 'https://www.argentina.gob.ar/tema/emergencias',
        title: 'Argentina.gob.ar: emergencias',
        checkedAt: CHECKED,
      },
      fcdo('argentina', 'Argentina'),
    ],
  },
  {
    country: 'CO',
    general: '123',
    fire: '119',
    notes: '123 is the main emergency line for police and ambulance.',
    sources: [
      fcdo('colombia', 'Colombia'),
      {
        url: 'https://bogota.gov.co/mi-ciudad/seguridad/para-que-sirve-la-linea-123-de-emergencias-y-cuando-llamar-en-bogota',
        title: 'Alcaldía de Bogotá: Línea 123',
        checkedAt: CHECKED,
      },
    ],
  },
  {
    country: 'CL',
    police: '133',
    ambulance: '131',
    fire: '132',
    notes: 'Investigations police (PDI): 134.',
    sources: [
      {
        url: 'https://www.consulado.gob.cl/emergencias-en-chile',
        title: 'Consulado.gob.cl: emergencias en Chile',
        checkedAt: CHECKED,
      },
      fcdo('chile', 'Chile'),
    ],
  },
  {
    country: 'PE',
    police: '105',
    ambulance: '106',
    fire: '116',
    notes:
      '106 (SAMU) is free. 911 is being tested as a single emergency number in Lima and Callao. Línea 100 helps people facing family or sexual violence.',
    sources: [
      fcdo('peru', 'Peru'),
      {
        url: 'https://www.pronatel.gob.pe/central911/informacion_911_20022023.pdf',
        title: 'PRONATEL (Government of Peru): Central 911 information',
        checkedAt: CHECKED,
      },
      {
        url: 'https://www.infobae.com/peru/2026/06/26/numeros-de-emergencia-en-peru-cuando-llamar-a-la-policia-bomberos-samu-linea-100-y-911/',
        title: 'Infobae (June 2026): emergency numbers in Peru',
        checkedAt: CHECKED,
      },
    ],
  },

  // ───────────── Oceania ─────────────
  {
    country: 'AU',
    general: '000',
    notes:
      'Calls to 000 are free. 112 also works from mobile phones and reaches the same service. People with a hearing or speech impairment can use 106 by TTY.',
    sources: [
      {
        url: 'https://www.triplezero.gov.au/',
        title: 'Triple Zero (000), Australian Government',
        checkedAt: CHECKED,
      },
      {
        url: 'https://www.triplezero.gov.au/triple-zero/other-emergency-numbers',
        title: 'Triple Zero: other emergency numbers (112 and 106)',
        checkedAt: CHECKED,
      },
      fcdo('australia', 'Australia'),
    ],
  },
  {
    country: 'NZ',
    general: '111',
    notes:
      'If you have hearing or speech difficulties, register for the 111 TXT service. For police when it is not an emergency, call 105.',
    sources: [
      {
        url: 'https://www.police.govt.nz/contact-us/111-police-emergency',
        title: 'New Zealand Police: 111 emergency',
        checkedAt: CHECKED,
      },
      fcdo('new-zealand', 'New Zealand'),
    ],
  },
];
