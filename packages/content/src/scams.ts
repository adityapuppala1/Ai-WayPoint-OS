import type { ScamPattern, ScamReportChannel, SourceRef } from './types';

/**
 * The scam library shown in Shield, and where to report.
 *
 * Patterns describe how a scam feels from the inside, in plain words, with red flags a person
 * can actually check. They were written from consumer-protection guidance (Scamwatch, FTC,
 * RBI/PIB, operators) checked on 2026-09-29. Report channels are official services only.
 */

const CHECKED = '2026-09-29';
const src = (url: string, title: string): SourceRef => ({ url, title, checkedAt: CHECKED });
const scamwatch = (slug: string, title: string): SourceRef =>
  src(`https://www.scamwatch.gov.au/types-of-scams/${slug}`, `Scamwatch (ACCC): ${title}`);

const RBI_CYBER = src(
  'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=53185',
  'Reserve Bank of India: consumer awareness – cyber threats and frauds',
);
const PIB_DIGITAL_ARREST = src(
  'https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2082761&reg=48&lang=2',
  'PIB (Ministry of Home Affairs): digital arrest scam',
);

export const SCAM_PATTERNS: ScamPattern[] = [
  {
    id: 'pay-to-work-job',
    category: 'job',
    title: 'Jobs that ask you to pay first',
    howItWorks:
      'You get a job offer you did not apply for, often by WhatsApp, Telegram or text, with high pay for easy work. Before you can start, you are asked to pay for training, a uniform, a visa, a “registration fee” or equipment. After you pay, the job never appears, or the fees keep growing.',
    redFlags: [
      'You are asked to pay anything to get or start a job',
      'The offer came without an interview, or the interview was only by chat',
      'The pay is far above normal for the work',
      'They push you to decide today',
      'The recruiter uses a personal email or messaging account, not a company one',
    ],
    whatToDo: [
      'Do not pay. Real employers do not charge you to work for them.',
      'Look up the company yourself and contact it through its official website.',
      'If you already paid, contact your bank or payment app straight away and report it.',
    ],
    sources: [scamwatch('jobs-and-employment-scams', 'jobs and employment scams')],
  },
  {
    id: 'task-scam',
    category: 'job',
    title: 'Paid “tasks” that turn into deposits',
    howItWorks:
      'You are offered money to like videos, write reviews or “boost” products. The first small payments are real, to win your trust. Then you are told to deposit your own money to unlock bigger tasks or withdraw your earnings. The more you put in, the more they ask for.',
    redFlags: [
      'You earn money for simple online tasks with no clear employer',
      'You must deposit money or buy crypto to continue or to withdraw',
      'Your “balance” grows on a website but you cannot take it out',
      'You are added to a group chat where others boast about earnings',
    ],
    whatToDo: [
      'Stop depositing. Money shown on their site is not real.',
      'Do not pay a “fee” or “tax” to withdraw. It is part of the scam.',
      'Report it, and warn anyone who introduced you to it.',
    ],
    sources: [scamwatch('jobs-and-employment-scams', 'jobs and employment scams')],
  },
  {
    id: 'bank-kyc-update',
    category: 'bank-kyc',
    title: 'Fake “update your KYC” or account-blocked messages',
    howItWorks:
      'A text, call or email says your bank account, card or wallet will be blocked unless you update your details now. It links to a copy of your bank’s website or asks you to install an app or share an OTP. Once you do, the scammer takes over the account and moves your money.',
    redFlags: [
      'A threat that your account will be blocked today',
      'A link in a text or chat, instead of your bank’s app',
      'Anyone asking for your OTP, PIN, CVV or password',
      'A request to install a screen-sharing or “support” app',
    ],
    whatToDo: [
      'Never share an OTP, PIN or password — your bank will never ask for them.',
      'Open your bank’s own app or call the number on your card instead.',
      'If you shared details, call your bank now to block the account.',
    ],
    regions: ['IN'],
    sources: [RBI_CYBER, scamwatch('phishing-scams', 'phishing scams')],
  },
  {
    id: 'parcel-delivery-fee',
    category: 'delivery',
    title: 'Parcel delivery “fee” texts',
    howItWorks:
      'A text says a parcel could not be delivered and asks you to pay a small fee or confirm your address through a link. The page looks like a real courier or postal service. The fee is small, but the card details you enter are used to steal much more.',
    redFlags: [
      'You were not expecting a parcel',
      'A small payment is needed to “release” it',
      'The link does not go to the courier’s real website',
      'Urgency: the parcel will be “returned” or “destroyed” soon',
    ],
    whatToDo: [
      'Do not tap the link. Track parcels on the courier’s own website or app.',
      'If you entered card details, call your bank and cancel the card.',
      'Report the text and delete it.',
    ],
    sources: [scamwatch('text-or-sms-scams', 'text or SMS scams')],
  },
  {
    id: 'investment-guaranteed-returns',
    category: 'investment',
    title: 'Investments with guaranteed high returns',
    howItWorks:
      'Someone shares a “sure” investment: trading signals, a stock tip group, forex, gold or a new platform. Early returns may appear on screen. When you try to withdraw, there are new fees, or the platform disappears.',
    redFlags: [
      'Guaranteed returns, or returns far above a bank',
      'Pressure to invest quickly before the chance is gone',
      'You met the “adviser” on social media or a dating app',
      'The platform is not registered with your country’s financial regulator',
      'You are asked to pay to withdraw your own money',
    ],
    whatToDo: [
      'Check whether the firm is licensed with your financial regulator before paying anything.',
      'Never pay a fee to withdraw. Stop sending money.',
      'Report it, and keep screenshots of chats and payments.',
    ],
    sources: [scamwatch('investment-scams', 'investment scams')],
  },
  {
    id: 'crypto-pig-butchering',
    category: 'crypto',
    title: 'Crypto “opportunities” from a new online friend',
    howItWorks:
      'A friendly stranger messages you by “mistake” or on social media and builds a friendship over weeks. They mention how much they earn from crypto and help you open an account on a trading site. Your balance seems to grow, so you invest more — but the site is fake and the money is gone.',
    redFlags: [
      'A new online contact steers the conversation to investing',
      'They guide you to a specific app or website you had never heard of',
      'Your profits look huge but withdrawing needs another payment',
      'They refuse video calls or always have an excuse',
    ],
    whatToDo: [
      'Stop sending money, even if they get upset or say you will lose everything.',
      'Do not install apps or use sites they recommend.',
      'Report it. Be careful of “recovery” services that promise to get money back for a fee.',
    ],
    sources: [
      scamwatch('investment-scams', 'investment scams'),
      scamwatch('relationship-scams', 'relationship scams'),
    ],
  },
  {
    id: 'lottery-prize',
    category: 'lottery-prize',
    title: 'You “won” a prize or lottery you never entered',
    howItWorks:
      'A message says you won a lottery, a car, a phone or cash. To receive it you must pay a delivery fee, tax or processing charge first, or share your bank details. The prize never exists.',
    redFlags: [
      'You never entered the competition',
      'You must pay to receive a prize',
      'They ask for bank details or ID “to transfer the money”',
      'The message says to keep it secret',
    ],
    whatToDo: [
      'Do not pay or share details. Real prizes do not cost money to collect.',
      'Block the sender and report the message.',
    ],
    sources: [scamwatch('unexpected-money-scams', 'unexpected money scams')],
  },
  {
    id: 'romance-money-request',
    category: 'romance',
    title: 'Online partners who need money',
    howItWorks:
      'You meet someone online who is warm, attentive and quickly serious. They cannot meet in person — they work abroad, on a ship or in the military. Then an emergency comes up: a medical bill, a customs fee, a ticket to visit you. The requests keep coming.',
    redFlags: [
      'Strong feelings very quickly, before you have met',
      'Always an excuse not to video call or meet',
      'Requests for money, gift cards or crypto, even small amounts',
      'They ask you to keep the relationship secret',
    ],
    whatToDo: [
      'Do not send money to someone you have not met in person.',
      'Do a reverse image search on their photos.',
      'Talk to someone you trust. Report the profile to the platform.',
    ],
    sources: [scamwatch('relationship-scams', 'relationship scams')],
  },
  {
    id: 'sextortion',
    category: 'sextortion',
    title: 'Threats to share intimate images',
    howItWorks:
      'Someone you met online gets you to share intimate images or join a video call, then threatens to send the images to your family or friends unless you pay. Sometimes they have no images at all and are bluffing. Paying usually leads to more demands.',
    redFlags: [
      'A new contact moves quickly to sexual chat or video',
      'Sudden demands for money with a deadline',
      'They list your friends or family to scare you',
    ],
    whatToDo: [
      'Stop replying and do not pay. Paying rarely makes it stop.',
      'Keep evidence: screenshots, usernames and payment requests.',
      'Report the account to the platform and to police. If you are under 18, tell a trusted adult or a child helpline — you are not in trouble.',
    ],
    sources: [scamwatch('threat-scams', 'threat scams')],
  },
  {
    id: 'tech-support-remote-access',
    category: 'tech-support',
    title: 'Fake tech support that wants remote access',
    howItWorks:
      'A pop-up, call or message says your computer or phone has a virus or your account was hacked. A “technician” asks you to install an app so they can fix it. Once they control your device, they can see your banking and move money.',
    redFlags: [
      'A warning with a phone number that says to call now',
      'An unexpected call from “Microsoft”, “Apple”, your bank or internet provider',
      'A request to install AnyDesk, TeamViewer or similar',
      'They ask you to log in to your bank while they watch',
    ],
    whatToDo: [
      'Hang up or close the page. Real companies do not call you about viruses.',
      'Never give remote access to someone who contacted you.',
      'If you already did, disconnect from the internet, contact your bank, and change passwords from another device.',
    ],
    sources: [scamwatch('phone-scams', 'phone scams')],
  },
  {
    id: 'authority-impersonation',
    category: 'impersonation-authority',
    title: 'Callers pretending to be police, tax or government officials',
    howItWorks:
      'Someone claims to be from the police, tax office, customs or immigration. They say you owe money or are linked to a crime, and must pay immediately to avoid arrest, deportation or a fine. They often ask for gift cards, crypto or a bank transfer.',
    redFlags: [
      'Threats of arrest, deportation or legal action unless you pay now',
      'Payment by gift card, crypto or transfer to a personal account',
      'They tell you not to hang up or not to tell anyone',
      'Caller ID looks official (it can be faked)',
    ],
    whatToDo: [
      'Hang up. Contact the agency yourself using the number on its official website.',
      'Government agencies do not ask for gift cards or crypto.',
    ],
    sources: [scamwatch('phone-scams', 'phone scams')],
  },
  {
    id: 'digital-arrest',
    category: 'digital-arrest',
    title: '“Digital arrest” video calls',
    howItWorks:
      'You get a call saying a parcel in your name contained drugs, or your number was used in a crime. The call moves to a video call with people in uniform in what looks like a police station. They say you are under “digital arrest”, must stay on camera, and must transfer money to “verify” it.',
    redFlags: [
      'There is no such thing as a “digital arrest” — police do not arrest people by video call',
      'You are told not to disconnect or speak to anyone',
      'You are asked to move money to a “safe” or “verification” account',
      'Fake documents, badges or court orders shared on screen',
    ],
    whatToDo: [
      'Disconnect. No real agency will hold you on a video call.',
      'In India, call 1930 or report at cybercrime.gov.in as fast as you can if you paid.',
      'Tell family members, especially older relatives, about this scam.',
    ],
    regions: ['IN'],
    sources: [PIB_DIGITAL_ARREST],
  },
  {
    id: 'predatory-loan-app',
    category: 'loan-app',
    title: 'Instant-loan apps that harass and blackmail',
    howItWorks:
      'An app offers a quick loan with no paperwork. It asks for access to your contacts and photos. The amount you receive is smaller than promised, the charges are huge, and if you are late the app messages your contacts, shares edited photos or threatens you.',
    redFlags: [
      'The app is not from a lender registered with the central bank',
      'It asks for access to your contacts, photos or messages',
      'You get less than you borrowed but must repay far more',
      'Threats or messages to your family and friends',
    ],
    whatToDo: [
      'Check that a lender is registered with your central bank before borrowing.',
      'Do not give an app access to your contacts or gallery.',
      'If you are being harassed, keep evidence and report it to police. You do not have to face this alone.',
    ],
    regions: ['IN', 'KE', 'NG', 'PH', 'ID'],
    sources: [
      src(
        'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1683572&reg=48&lang=2',
        'PIB: RBI cautions against unauthorised digital lending platforms and mobile apps',
      ),
    ],
  },
  {
    id: 'utility-disconnection',
    category: 'utility-disconnection',
    title: '“Your power will be cut tonight” messages',
    howItWorks:
      'A message says your electricity, water or gas will be disconnected tonight because a bill was not paid. It gives a phone number or link to pay immediately. The number reaches a scammer who asks for payment or remote access to your phone.',
    redFlags: [
      'A deadline of a few hours',
      'A personal mobile number instead of the utility’s official number',
      'Payment through a link, app or transfer to a person',
    ],
    whatToDo: [
      'Check your account through the utility’s official app or website.',
      'Do not call numbers from the message.',
    ],
    sources: [scamwatch('threat-scams', 'threat scams')],
  },
  {
    id: 'tax-refund',
    category: 'tax-refund',
    title: 'Fake tax refund messages',
    howItWorks:
      'An email or text says you are due a tax refund and must claim it through a link. The page asks for your bank or card details and ID. The refund does not exist; your details are stolen.',
    redFlags: [
      'A refund you did not expect, with a link to claim it',
      'The sender address or link is not your tax authority’s real website',
      'Requests for card numbers or passwords',
    ],
    whatToDo: [
      'Log in to your tax account directly by typing the official address.',
      'Forward the message to your tax authority’s phishing address if it has one, then delete it.',
    ],
    sources: [scamwatch('phishing-scams', 'phishing scams')],
  },
  {
    id: 'fake-government-scheme',
    category: 'government-scheme',
    title: 'Fake benefits, grants and subsidy schemes',
    howItWorks:
      'A message or video promotes a new government scheme: free money, a laptop, a subsidy or a job programme. To register, you pay a fee or share your ID and bank details on an unofficial site. Real schemes are never sold through forwarded messages.',
    redFlags: [
      'A registration fee for a government benefit',
      'The website is not a government domain',
      'Forwarded on WhatsApp with “share with 10 groups”',
      'Requests for OTPs or full bank details',
    ],
    whatToDo: [
      'Check schemes on your government’s official portal (see Civic).',
      'Never pay a fee to apply for a benefit.',
    ],
    sources: [scamwatch('unexpected-money-scams', 'unexpected money scams')],
  },
  {
    id: 'family-emergency',
    category: 'family-emergency',
    title: '“Hi Mum, I lost my phone” and family emergencies',
    howItWorks:
      'A message from an unknown number says it is your child or relative with a new phone. Soon they need money urgently for a bill, rent or an emergency, and ask you to pay someone else’s account. Sometimes it is a call claiming a relative is in hospital or in jail.',
    redFlags: [
      'A “new number” from a family member',
      'An urgent money request to an account in someone else’s name',
      'They avoid a voice or video call',
      'They ask you not to tell anyone',
    ],
    whatToDo: [
      'Call your relative on the number you already have.',
      'Ask a question only the real person would know.',
      'Agree a family code word for emergencies.',
    ],
    sources: [
      src(
        'https://consumer.ftc.gov/all-scams/family-emergency-scams',
        'FTC: family emergency scams',
      ),
    ],
  },
  {
    id: 'ai-voice-clone',
    category: 'deepfake-voice',
    title: 'Cloned voices and deepfake video calls',
    howItWorks:
      'Scammers can copy a voice from a short clip online and use it to call you, sounding like a relative or your boss. Video can be faked too. The call creates panic and asks for money or a payment approval right away.',
    redFlags: [
      'A familiar voice with an unusual, urgent money request',
      'Pressure to act before you can check',
      'The caller cannot answer a personal question',
    ],
    whatToDo: [
      'Hang up and call the person back on a number you know.',
      'Use a family or team code word for money requests.',
      'At work, confirm any payment request through a second channel.',
    ],
    sources: [
      src(
        'https://consumer.ftc.gov/consumer-alerts/2023/03/scammers-use-ai-enhance-their-family-emergency-schemes',
        'FTC: scammers use AI to enhance their family emergency schemes',
      ),
    ],
  },
  {
    id: 'marketplace-fake-payment',
    category: 'marketplace',
    title: 'Online marketplace buyers and sellers who are not real',
    howItWorks:
      'A buyer “pays” you with a fake payment screenshot or asks you to accept a payment through a link that actually takes money from you. Or a seller asks for a deposit for a phone, car or pet that does not exist.',
    redFlags: [
      'A buyer who pays without seeing the item, or overpays and asks for a refund',
      'A “receive money” link or QR code you must scan',
      'A seller who will not meet or show the item on video',
      'A price far below normal',
    ],
    whatToDo: [
      'Check your actual bank or wallet balance, not screenshots.',
      'You never need to scan a QR code or enter a PIN to receive money.',
      'Meet in a safe public place, or use the platform’s protected payment.',
    ],
    sources: [scamwatch('buying-and-selling-scams', 'buying and selling scams')],
  },
  {
    id: 'rental-deposit',
    category: 'rental',
    title: 'Rentals that ask for a deposit before a viewing',
    howItWorks:
      'A home is listed at a good price. The “landlord” is abroad and cannot show it, but will send the keys once you pay a deposit or first month’s rent. The listing was copied from a real home.',
    redFlags: [
      'You cannot view the home or meet the landlord',
      'Payment by transfer, crypto or gift card before signing',
      'The rent is well below similar homes nearby',
    ],
    whatToDo: [
      'Never pay before seeing the home and checking who owns it.',
      'Search the address and photos online to see if they appear elsewhere.',
    ],
    sources: [
      src('https://consumer.ftc.gov/articles/rental-listing-scams', 'FTC: rental listing scams'),
    ],
  },
  {
    id: 'fake-charity',
    category: 'charity',
    title: 'Fake charities after disasters',
    howItWorks:
      'After a disaster or war, messages and posts ask for urgent donations. Some use real charity names, others invent new ones. Money goes to the scammer.',
    redFlags: [
      'A new charity you cannot find on an official charity register',
      'Pressure to give immediately',
      'Donations by gift card, crypto or transfer to a person',
    ],
    whatToDo: [
      'Give through a charity’s own website that you look up yourself.',
      'Check it is registered in your country.',
    ],
    sources: [scamwatch('donation-scams', 'donation scams')],
  },
  {
    id: 'phishing-link',
    category: 'phishing-link',
    title: 'Links that copy real websites',
    howItWorks:
      'A message copies a real company — a bank, a streaming service, a shop, a social network — and asks you to log in through a link. The page looks right but steals your password and then your account.',
    redFlags: [
      'The web address is slightly wrong (extra letters, strange ending, shortened link)',
      'Urgency: account locked, payment failed, unusual login',
      'A request to “verify” your details',
    ],
    whatToDo: [
      'Go to the website or app yourself instead of using the link.',
      'Turn on two-step verification for important accounts.',
      'If you typed a password, change it now everywhere you used it.',
    ],
    sources: [
      scamwatch('phishing-scams', 'phishing scams'),
      scamwatch('website-scams', 'website scams'),
    ],
  },
  {
    id: 'otp-sim-swap',
    category: 'sim-swap-otp',
    title: 'Requests for your OTP or to “port” your SIM',
    howItWorks:
      'Someone calls pretending to be your bank, phone company or a delivery service and asks you to read out a code you just received. That code lets them log in to your account, reset your password or move your number to their SIM.',
    redFlags: [
      'Anyone asking you to read out a code sent to your phone',
      'Your phone suddenly loses signal for no reason',
      'Messages about a SIM change you did not request',
    ],
    whatToDo: [
      'Never share a one-time code with anyone, even if they know your details.',
      'If your phone loses service unexpectedly, call your phone company from another phone.',
      'Ask your phone company for a SIM PIN or port-out protection.',
    ],
    sources: [
      scamwatch('account-or-identity-takeover-scams', 'account or identity takeover scams'),
      RBI_CYBER,
    ],
  },
  {
    id: 'qr-code-swap',
    category: 'qr-code',
    title: 'QR codes that take money instead of paying it',
    howItWorks:
      'A fake QR code is stuck over a real one at a parking meter or shop, or sent to you to “receive” a payment. Scanning it opens a fake payment page or asks for your PIN, and money leaves your account.',
    redFlags: [
      'A sticker QR code placed on top of another',
      'Being told to scan a code and enter your PIN to receive money',
      'A payment page you reach from a QR code that asks for card details',
    ],
    whatToDo: [
      'You never need your PIN to receive money.',
      'Type the official app or website address yourself where possible.',
    ],
    sources: [
      src(
        'https://consumer.ftc.gov/consumer-alerts/2026/09/see-qr-code-parked-somewhere-dont-scan-ityet',
        'FTC consumer alert (September 2026): QR codes',
      ),
      RBI_CYBER,
    ],
  },
  {
    id: 'mpesa-fake-reversal',
    category: 'other',
    title: 'Fake “sent by mistake” mobile money messages',
    howItWorks:
      'You get an SMS that looks like a mobile money confirmation saying someone sent you money. Then they call, upset, asking you to send it back. No money ever arrived — the SMS was fake.',
    redFlags: [
      'The SMS comes from a normal phone number, not the official sender name',
      'Your actual balance has not changed',
      'The caller is pushy and emotional',
    ],
    whatToDo: [
      'Check your balance in the official app or USSD menu.',
      'Real reversals are handled by your provider, not by sending money back yourself.',
      'In Kenya, forward the fake SMS to 333 (Safaricom).',
    ],
    regions: ['KE', 'TZ', 'UG', 'GH'],
    sources: [
      src(
        'https://www.safaricom.co.ke/fraud-awareness/m-pesa-fraud',
        'Safaricom: M-PESA fraud and fake reversal SMS',
      ),
    ],
  },
  {
    id: 'money-recovery',
    category: 'other',
    title: 'Offers to recover money you lost to a scam',
    howItWorks:
      'After you lose money, someone contacts you claiming to be a lawyer, investigator or government agency who can get it back — for a fee. They are often the same scammers, or working with them.',
    redFlags: [
      'They contact you first and already know about your loss',
      'An upfront fee to recover your money',
      'A guaranteed recovery',
    ],
    whatToDo: [
      'Only use official reporting channels (police, your bank, national fraud services) — they do not charge.',
      'Do not pay anyone who promises to recover your money.',
    ],
    sources: [scamwatch('money-recovery-scams', 'money recovery scams')],
  },
];

export const SCAM_REPORT_CHANNELS: ScamReportChannel[] = [
  // Global
  {
    country: 'ZZ',
    name: 'econsumer.gov',
    url: 'https://www.econsumer.gov',
    what: 'Report scams that crossed borders to consumer protection agencies around the world.',
    sources: [
      src('https://consumer.ftc.gov/node/76676', 'FTC: econsumer.gov, international scam fighter'),
      src('https://www.econsumer.gov/', 'econsumer.gov'),
    ],
  },
  // India
  {
    country: 'IN',
    name: 'National Cyber Crime Helpline 1930',
    phone: '1930',
    what: 'Call immediately if money was taken in an online fraud — fast reports can freeze the transfer.',
    timeCritical: true,
    sources: [
      src(
        'https://www.pib.gov.in/PressNoteDetails.aspx?NoteId=155384&ModuleId=3&reg=48&lang=2',
        'PIB: helpline 1930 and the National Cyber Crime Reporting Portal',
      ),
    ],
  },
  {
    country: 'IN',
    name: 'National Cyber Crime Reporting Portal',
    url: 'https://cybercrime.gov.in',
    what: 'File a complaint about any cybercrime, including financial fraud.',
    sources: [
      src(
        'https://www.pib.gov.in/PressNoteDetails.aspx?NoteId=155384&ModuleId=3&reg=48&lang=2',
        'PIB: helpline 1930 and the National Cyber Crime Reporting Portal',
      ),
    ],
  },
  {
    country: 'IN',
    name: 'Chakshu (Sanchar Saathi)',
    url: 'https://www.sancharsaathi.gov.in',
    what: 'Report suspected fraud calls, SMS or WhatsApp messages so the numbers can be blocked.',
    sources: [
      src('https://www.sancharsaathi.gov.in/', 'Department of Telecommunications: Sanchar Saathi'),
    ],
  },
  // United States
  {
    country: 'US',
    name: 'FTC ReportFraud',
    url: 'https://reportfraud.ftc.gov',
    what: 'Report scams, fraud and bad business practices to the Federal Trade Commission.',
    sources: [src('https://reportfraud.ftc.gov/', 'Federal Trade Commission: ReportFraud')],
  },
  {
    country: 'US',
    name: 'FBI Internet Crime Complaint Center (IC3)',
    url: 'https://www.ic3.gov',
    what: 'Report online fraud, investment scams, ransomware and account takeovers.',
    sources: [src('https://www.ic3.gov/', 'FBI IC3')],
  },
  // United Kingdom
  {
    country: 'GB',
    name: 'Report Fraud',
    phone: '0300 123 2040',
    url: 'https://www.reportfraud.police.uk',
    what: 'Report fraud and cybercrime in England, Wales and Northern Ireland. In Scotland, call Police Scotland on 101.',
    sources: [src('https://www.reportfraud.police.uk/', 'Report Fraud (City of London Police)')],
  },
  {
    country: 'GB',
    name: 'Forward scam texts to 7726',
    phone: '7726',
    what: 'Forward scam texts to 7726 for free so your mobile network can block the sender.',
    sources: [
      src(
        'https://www.ofcom.org.uk/phones-and-broadband/scam-calls-and-messages/7726-reporting-scam-texts-and-calls',
        'Ofcom: report scam texts and calls to 7726',
      ),
    ],
  },
  {
    country: 'GB',
    name: 'NCSC Suspicious Email Reporting Service',
    url: 'https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email',
    what: 'Forward suspicious emails to report@phishing.gov.uk.',
    sources: [
      src(
        'https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email',
        'National Cyber Security Centre: report a scam email',
      ),
    ],
  },
  // Canada
  {
    country: 'CA',
    name: 'Canadian Anti-Fraud Centre',
    phone: '1-888-495-8501',
    url: 'https://reportcyberandfraud.canada.ca',
    what: 'Report fraud or cybercrime online, or by phone Monday to Friday, 10:00–16:45 Eastern.',
    sources: [
      src(
        'https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm',
        'Canadian Anti-Fraud Centre: report fraud',
      ),
    ],
  },
  // Australia
  {
    country: 'AU',
    name: 'Scamwatch',
    url: 'https://portal.scamwatch.gov.au/report-a-scam/',
    what: 'Report any scam contact so others can be warned. If you lost money, also contact your bank.',
    sources: [src('https://www.scamwatch.gov.au/report-a-scam', 'Scamwatch: report a scam')],
  },
  {
    country: 'AU',
    name: 'ReportCyber',
    url: 'https://www.cyber.gov.au/report-and-recover/report',
    what: 'Report cybercrime to police.',
    sources: [src('https://www.scamwatch.gov.au/report-a-scam', 'Scamwatch: report a scam')],
  },
  // Singapore
  {
    country: 'SG',
    name: 'ScamShield Helpline 1799',
    phone: '1799',
    url: 'https://www.scamshield.gov.sg',
    what: 'Call 24/7 if you are unsure whether something is a scam, or report one online.',
    timeCritical: true,
    sources: [src('https://www.scamshield.gov.sg/', 'ScamShield (Singapore Government)')],
  },
  // Malaysia
  {
    country: 'MY',
    name: 'National Scam Response Centre 997',
    phone: '997',
    what: 'Call within 24 hours of a scam transfer so accounts can be blocked. Open daily, 24 hours.',
    timeCritical: true,
    sources: [
      src(
        'https://www.malaysia.gov.my/en/categories/safety-and-community/cybersecurity/nsrc-997-hotline',
        'MyGOV: NSRC 997 hotline',
      ),
    ],
  },
  // Philippines
  {
    country: 'PH',
    name: 'Inter-Agency Response Center 1326',
    phone: '1326',
    what: 'Report investment, phishing, text, romance and other online scams, 24/7.',
    timeCritical: true,
    sources: [
      src(
        'https://www.pna.gov.ph/articles/1207775',
        'Philippine News Agency: anti-scam hotline 1326',
      ),
    ],
  },
  // Indonesia
  {
    country: 'ID',
    name: 'Indonesia Anti-Scam Centre (IASC)',
    url: 'https://iasc.ojk.go.id',
    what: 'Report financial scams quickly so funds can be traced. Only use the official site — fake IASC sites exist.',
    timeCritical: true,
    sources: [
      src(
        'https://ojk.go.id/id/berita-dan-kegiatan/info-terkini/Pages/Waspada-Penipuan-Website-Mengatasnamakan-Indonesia-Anti-Scam-Centre-IASC.aspx',
        'OJK: beware of fake websites impersonating IASC',
      ),
    ],
  },
  // Kenya
  {
    country: 'KE',
    name: 'Safaricom fraud line 333',
    what: 'Forward fake M-PESA or scam SMS messages to 333 so the numbers can be blocked.',
    sources: [
      src(
        'https://www.safaricom.co.ke/fraud-awareness/tips-tricks',
        'Safaricom: fraud awareness tips',
      ),
    ],
  },
  // Nigeria
  {
    country: 'NG',
    name: 'EFCC',
    url: 'https://www.efcc.gov.ng/efcc/channels-of-reporting-complaints-2',
    what: 'Report financial fraud and scams to the Economic and Financial Crimes Commission.',
    sources: [
      src(
        'https://www.efcc.gov.ng/efcc/channels-of-reporting-complaints-2',
        'EFCC: channels of reporting complaints',
      ),
    ],
  },
  // Mexico
  {
    country: 'MX',
    name: 'Guardia Nacional 088',
    phone: '088',
    what: 'Call if you are the victim of an online crime or fraud.',
    sources: [
      src(
        'https://www.gob.mx/gncertmx/articulos/en-caso-de-ser-victima-de-algun-ciberdelito-llama-al-088-atencion-ciudadana',
        'Guardia Nacional CERT-MX: call 088 for cybercrime',
      ),
    ],
  },
  // Spain
  {
    country: 'ES',
    name: 'INCIBE 017',
    phone: '017',
    what: 'Free, confidential cybersecurity help, 08:00–23:00 every day. Also on WhatsApp (900 116 117) and Telegram (@INCIBE017).',
    sources: [
      src(
        'https://www.incibe.es/linea-de-ayuda-en-ciberseguridad',
        'INCIBE: línea de ayuda en ciberseguridad 017',
      ),
    ],
  },
  // France
  {
    country: 'FR',
    name: '17Cyber',
    url: 'https://www.17cyber.gouv.fr',
    what: 'Government help to identify a cyberattack or scam and what to do next, run by the police, gendarmerie and Cybermalveillance.gouv.fr.',
    sources: [src('https://www.17cyber.gouv.fr/', '17Cyber')],
  },
];
