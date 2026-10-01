import type { ShieldText } from './index';

/** Kiswahili sanifu, lugha rahisi ya kila siku. */
export const sw: ShieldText = {
  signals: {
    'pay-to-work': {
      title: 'Anakuomba ulipe kabla ya kuanza kazi',
      explanation:
        'Waajiri halisi hukulipa wewe. Hawatozi kamwe ada ya kukuajiri, kukufunza au kukupa kazi.',
    },
    'task-earnings': {
      title: 'Anakulipa kwa kazi rahisi za mtandaoni',
      explanation:
        'Kazi za “task” zinazolipa kwa kupenda, kutoa alama au maoni kwa kawaida huishia kukuomba “uongeze” pesa ambazo hutarudishiwa kamwe.',
    },
    'earn-per-day': {
      title: 'Anaahidi pesa rahisi kila siku',
      explanation:
        'Mapato ya uhakika kila siku kwa kazi ndogo ni mojawapo ya chambo cha kawaida zaidi katika ulaghai wa kazi.',
    },
    'fee-to-receive': {
      title: 'Anaomba ada ili kutoa pesa au kifurushi',
      explanation:
        'Kuombwa ulipe ada ndogo ili upokee kifurushi, zawadi, mkopo au marejesho ni ulaghai wa kawaida wa kulipa kabla.',
    },
    'gift-cards': {
      title: 'Anataka malipo kwa kadi za zawadi',
      explanation:
        'Hakuna biashara halisi, ofisi ya kodi wala polisi wanaoomba kulipwa kwa kadi za zawadi.',
    },
    'crypto-payment': {
      title: 'Anakuomba utume sarafu za kidijitali',
      explanation:
        'Malipo ya sarafu za kidijitali ni vigumu kufuatilia au kurudisha, ndiyo sababu walaghai huyapenda.',
    },
    'pin-to-receive': {
      title: 'Anakuomba uchanganue msimbo au uweke PIN yako ili kupokea pesa',
      explanation:
        'Huhitaji kamwe kuchanganua msimbo wa QR au kuweka PIN yako ili kupokea pesa — ni kwa kutuma tu.',
    },
    overpayment: {
      title: 'Anasema amekulipa zaidi na anataka urudishe sehemu',
      explanation:
        'Malipo ya kwanza mara nyingi hurudishwa au hayakuwa halisi kamwe, na “marejesho” unayotuma hupotea.',
    },
    'rental-deposit': {
      title: 'Anataka amana kabla hujaona nyumba',
      explanation:
        'Usilipe kamwe nyumba ambayo hujaiona, kwa mwenye nyumba ambaye hujakutana naye wala kumthibitisha.',
    },
    'share-otp': {
      title: 'Anaomba msimbo, PIN au nenosiri',
      explanation:
        'Benki, programu na maafisa kamwe hawaombi msimbo wako wa mara moja (OTP), PIN au nenosiri. Anayeviomba anajaribu kuingia kwenye akaunti yako.',
    },
    'kyc-block': {
      title: 'Anatishia kufunga akaunti yako usiposasisha taarifa',
      explanation:
        'Benki na kampuni za simu hazifungi akaunti kwa ujumbe mfupi. Thibitisha kupitia programu rasmi au tawi.',
    },
    'click-to-verify': {
      title: 'Anakuomba uingie au uthibitishe kupitia kiungo',
      explanation:
        'Viungo vilivyo kwenye jumbe vinaweza kukupeleka kwenye nakala za tovuti halisi zilizotengenezwa kuiba nenosiri lako.',
    },
    'remote-access': {
      title: 'Anataka kudhibiti simu au kompyuta yako kwa mbali',
      explanation:
        'Programu za kudhibiti kwa mbali humruhusu mgeni kuona skrini yako na kuhamisha pesa kutoka akaunti zako.',
    },
    'install-apk': {
      title: 'Anakuomba usakinishe programu kutoka kwenye ujumbe',
      explanation:
        'Programu zinazotumwa kwa ujumbe zinaweza kusoma jumbe zako na misimbo ya mara moja. Sakinisha programu kutoka duka rasmi pekee.',
    },
    deadline: {
      title: 'Anakuharakisha',
      explanation: 'Shinikizo la kuchukua hatua haraka linalenga kukuzuia usimuulize mtu yeyote.',
    },
    threat: {
      title: 'Anakutishia kwa faini au kukatiwa huduma',
      explanation:
        'Vitisho vya kukamatwa, faini au kukatiwa huduma hutumika kuwatisha watu ili walipe haraka.',
    },
    secrecy: {
      title: 'Anakuambia ulifanye siri',
      explanation:
        'Walaghai hukutenga ili mtu yeyote asikuonye. Maafisa na waajiri halisi kamwe hawadai usiri.',
    },
    'digital-arrest': {
      title: 'Anadai uko chini ya “kukamatwa kidijitali”',
      explanation:
        'Hakuna kitu kinachoitwa kukamatwa kidijitali. Polisi kamwe hawamshikilii mtu kwa simu ya video wala kuomba pesa ili kumaliza kesi.',
    },
    'agency-parcel': {
      title: 'Anajifanya polisi, forodha au taasisi ya serikali',
      explanation:
        'Taasisi hazipigi simu kuhusu vifurushi vilivyokamatwa wala kuomba ulipe ili kusafisha jina lako. Kata simu na upige nambari rasmi ya taasisi hiyo mwenyewe.',
    },
    'utility-cutoff': {
      title: 'Anasema umeme wako utakatwa usiku wa leo',
      explanation:
        'Kampuni za umeme hutuma taarifa kupitia bili na programu rasmi, si kwa jumbe zinazokuomba upige nambari ya mtu binafsi.',
    },
    'tax-refund': {
      title: 'Anatoa marejesho ya kodi kupitia kiungo',
      explanation:
        'Marejesho ya kodi hushughulikiwa kupitia tovuti rasmi ya mamlaka ya kodi, si viungo vilivyo kwenye jumbe.',
    },
    'gov-scheme-fee': {
      title: 'Anatoa mafao ya serikali kwa ada au kupitia kiungo',
      explanation:
        'Kuomba mipango ya serikali ni bure kupitia tovuti rasmi. Hakuna anayehitaji kumlipa wakala.',
    },
    'guaranteed-returns': {
      title: 'Anaahidi faida kubwa au ya uhakika',
      explanation:
        'Uwekezaji halisi unaweza kupata hasara. Faida kubwa ya uhakika ndiyo alama ya ulaghai wa uwekezaji.',
    },
    prize: {
      title: 'Anasema umeshinda zawadi ya shindano ambalo hukushiriki',
      explanation:
        'Huwezi kushinda bahati nasibu au droo ambayo hukuwahi kushiriki. Ulaghai wa zawadi huishia kwa “ada” ya kuidai.',
    },
    'instant-loan': {
      title: 'Anatoa mkopo wa papo hapo bila ukaguzi',
      explanation:
        'Programu za mikopo zisizosajiliwa mara nyingi hutoza ada zilizofichwa na kuwasumbua wakopaji. Tumia wakopeshaji waliosajiliwa na benki kuu.',
    },
    'family-new-number': {
      title: 'Anadai kuwa ndugu yako kwa nambari mpya',
      explanation:
        'Walaghai hujifanya ndugu mwenye simu mpya anayehitaji pesa haraka. Mpigie kwenye nambari unayoijua tayari.',
    },
    'romance-money': {
      title: 'Mtu uliyekutana naye mtandaoni anahitaji pesa',
      explanation:
        'Usimtumie pesa kamwe mtu ambaye hujakutana naye ana kwa ana, hata kama uhusiano unaonekana kuwa wa kweli.',
    },
    sextortion: {
      title: 'Anatishia kusambaza picha au video za faragha',
      explanation:
        'Usilipe — kulipa kwa kawaida huleta madai zaidi. Acha kujibu, hifadhi ushahidi na uripoti.',
    },
    'voice-clone': {
      title: 'Simu ya dharura kwa sauti ya mpendwa wako',
      explanation:
        'Sasa sauti zinaweza kuigwa kwa AI. Kata simu kisha upige tena nambari unayoijua, au uliza neno la siri la familia.',
    },
    'move-to-chat': {
      title: 'Anahamishia mazungumzo kwenye programu ya gumzo la faragha',
      explanation:
        'Walaghai hukuondoa kwenye majukwaa rasmi na kukupeleka mahali penye ulinzi mdogo na bila kumbukumbu.',
    },
    'charity-urgent': {
      title: 'Mchango wa dharura kwenda akaunti ya mtu binafsi',
      explanation:
        'Changia kupitia tovuti rasmi za mashirika ya hisani yaliyosajiliwa, kamwe si kwa akaunti binafsi zinazotumwa kwenye jumbe.',
    },
    'virus-alert': {
      title: 'Anadai kifaa chako kina virusi',
      explanation:
        'Kampuni halisi hazikutumii ujumbe wala kukupigia simu kuhusu virusi. Funga ukurasa na usipige nambari iliyoonyeshwa.',
    },
    'delivery-problem': {
      title: 'Anasema usafirishaji umeshindikana au umezuiliwa',
      explanation:
        'Jumbe bandia za usafirishaji hukupeleka kwenye kurasa za malipo. Fuatilia vifurushi kwenye programu au tovuti rasmi ya kampuni ya usafirishaji pekee.',
    },
    'combo-authority-secrecy': {
      title: 'Tishio linaloonekana rasmi pamoja na usiri',
      explanation:
        'Hii inalingana na mtindo wa “kukamatwa kidijitali”: afisa bandia, shtaka la kutisha na amri ya kutomwambia mtu yeyote.',
    },
    'combo-credentials-link': {
      title: 'Tishio pamoja na kiungo cha “kulitatua”',
      explanation:
        'Kutisha kwanza, kisha kutuma kiungo ndiyo mbinu ya kawaida zaidi ya kuiba taarifa.',
    },
    inheritance: {
      title: 'Inasema umerithi mali nyingi',
      explanation:
        'Urithi usiotarajiwa kutoka kwa watu usiowajua huishia kwa kuombwa “ada” au kodi ili kuachilia pesa ambazo hazifiki kamwe.',
    },
    'combo-delivery-link': {
      title: 'Tatizo la kifurushi pamoja na kiungo cha kulitatua',
      explanation:
        'Kampuni za usafirishaji mara chache hutuma kiungo cha kulipa au kurekebisha anwani yako. Angalia kifurushi kwenye programu au tovuti rasmi ya kampuni.',
    },
    'combo-job-chat': {
      title: 'Pesa rahisi zinazotolewa kupitia programu ya gumzo',
      explanation:
        'Ofa za kazi ambazo hukuziomba zenye malipo ya kila siku kupitia WhatsApp au Telegram karibu kila mara ni ulaghai wa kazi za “task”.',
    },
    'link-lookalike': {
      title: 'Kiungo kinaiga tovuti inayojulikana',
      titleBrand: 'Kiungo kinaiga {brand}',
      explanation: 'Anwani hii inafanana na ya chapa halisi, lakini si tovuti yake rasmi.',
    },
    'link-ip-host': {
      title: 'Kiungo ni nambari tupu, si jina',
      explanation: 'Kampuni halisi hutumia tovuti zenye majina, si anwani za nambari.',
    },
    'link-punycode': {
      title: 'Kiungo kinatumia herufi zinazofanana',
      explanation: 'Herufi maalum zinaweza kufanya anwani bandia ionekane sawa kabisa na halisi.',
    },
    'link-at-sign': {
      title: 'Kiungo kinaficha kinakoelekea kwa kweli',
      explanation:
        'Alama ya “@” kwenye anwani ya tovuti inaweza kukupeleka mahali tofauti na jina unaloliona.',
    },
    'link-data-uri': {
      title: 'Kiungo kina ukurasa uliofichwa',
      explanation:
        'Kiungo hiki kimebeba ukurasa mzima wa tovuti ndani yake, mbinu ya kuepuka kugunduliwa.',
    },
    'link-file-download': {
      title: 'Kiungo kinapakua programu',
      explanation:
        'Programu zinazopakuliwa kupitia viungo zinaweza kusoma jumbe na misimbo yako. Sakinisha kutoka duka rasmi pekee.',
    },
    'link-shortener': {
      title: 'Kiungo kimefupishwa',
      explanation: 'Viungo vifupi huficha vinakoelekea. Walaghai huvitumia kuficha tovuti bandia.',
    },
    'link-suspicious-tld': {
      title: 'Kiungo kinaishia kwa kikoa kisicho cha kawaida',
      explanation:
        'Aina hii ya anwani mara nyingi hutumika kwa tovuti za ulaghai zinazodumu kwa muda mfupi.',
    },
    'link-free-hosting': {
      title: 'Kiungo kiko kwenye kijenzi cha tovuti cha bure',
      explanation:
        'Mtu yeyote anaweza kutengeneza kurasa hizi kwa dakika chache; benki na serikali hazizitumii.',
    },
    'link-messaging-redirect': {
      title: 'Kiungo kinafungua gumzo la faragha',
      explanation: 'Kiungo hiki kinakupeleka WhatsApp au Telegram kwa akaunti usiyoijua.',
    },
    'link-many-subdomains': {
      title: 'Kiungo kina mnyororo mrefu wa majina',
      explanation:
        'Minyororo mirefu inaweza kuweka jina linaloaminika mwanzoni mwa anwani isiyoaminika.',
    },
    'link-insecure-http': {
      title: 'Kiungo si salama',
      explanation: 'Ukurasa huu hautumii muunganisho uliosimbwa.',
    },
    'link-very-long': {
      title: 'Kiungo ni kirefu isivyo kawaida',
      explanation: 'Viungo virefu sana vinaweza kuficha ufuatiliaji au anwani iliyojificha.',
    },
    'free-mail-official': {
      title: 'Jina linaloonekana rasmi kwenye barua pepe ya bure',
      explanation:
        'Benki, waajiri na taasisi hutuma barua pepe kutoka kwenye vikoa vyao, si Gmail au Yahoo.',
    },
    'foreign-number': {
      title: 'Nambari ni ya nchi nyingine',
      explanation:
        'Jumbe za kazi na zawadi kutoka nambari za kimataifa usizozitarajia ni mtindo wa kawaida wa ulaghai.',
    },
    'hidden-instructions': {
      title: 'Una maagizo yanayolenga zana ya ukaguzi, si wewe',
      explanation:
        'Ujumbe halisi huandikwa kwa ajili ya mtu anayeusoma. Maandishi yanayoiambia kompyuta jinsi ya kuupima ujumbe yanajaribu kukwepa ukaguzi.',
    },
  },
  advice: {
    'check-anyway':
      'Hatukupata dalili za kawaida za ulaghai. Ikiwa unaomba pesa, misimbo au hatua ya haraka, muulize kwanza mtu unayemwamini.',
    pause: 'Simama kwanza kabla ya kujibu, kubofya au kulipa. Ulaghai hutegemea haraka.',
    'verify-independently':
      'Mthibitishe mtumaji mwenyewe: tumia programu rasmi, tovuti au nambari ya simu unayoijua tayari, si maelezo yaliyo kwenye ujumbe.',
    'dont-engage': 'Usijibu, usifungue viungo na usilipe.',
    'block-report': 'Mzuie mtumaji na uripoti (angalia mahali pa kuripoti hapa chini).',
    'if-paid':
      'Umeshalipa au umetoa taarifa? Piga simu benki yako sasa hivi ili kusimamisha malipo, badilisha manenosiri yako, na uripoti haraka — kasi huongeza nafasi ya kurudishiwa pesa.',
    'cat-job':
      'Waajiri halisi kamwe hawakuombi ulipe ili upate kazi, mafunzo au “vifaa vya kuanzia”.',
    'cat-bank-kyc':
      'Benki yako haitakuomba kamwe PIN, nenosiri au msimbo wa mara moja, wala haitafunga akaunti yako kwa ujumbe mfupi. Piga nambari iliyo nyuma ya kadi yako.',
    'cat-delivery':
      'Fuatilia vifurushi kwenye programu au tovuti rasmi ya kampuni ya usafirishaji pekee. Kampuni hizo haziombi ada ndogo kwa ujumbe mfupi.',
    'cat-investment':
      'Faida kubwa ya uhakika ni dalili ya hatari. Kagua kampuni kwa mamlaka ya udhibiti wa fedha kabla ya kuwekeza.',
    'cat-crypto':
      'Malipo ya sarafu za kidijitali hayawezi kurudishwa. Usimtumie sarafu za kidijitali mtu yeyote aliyekutafuta kwanza.',
    'cat-lottery-prize':
      'Huwezi kushinda droo ambayo hukushiriki. Usilipe kamwe ada ili kudai zawadi.',
    'cat-romance':
      'Usimtumie pesa kamwe mtu ambaye hujakutana naye ana kwa ana, hata ukijiona uko karibu naye kiasi gani.',
    'cat-sextortion':
      'Usilipe — kulipa kwa kawaida huleta madai zaidi. Acha kujibu, hifadhi ushahidi na uripoti. Hujafanya kosa lolote.',
    'cat-tech-support':
      'Usisakinishe programu za kudhibiti kwa mbali wala kununua kadi za zawadi kwa ajili ya wanaokupigia simu. Kampuni halisi hazikupigii simu kuhusu virusi.',
    'cat-impersonation-authority':
      'Kata simu. Piga taasisi hiyo kwa nambari yake rasmi, unayoitafuta mwenyewe.',
    'cat-digital-arrest':
      'Hakuna “kukamatwa kidijitali”. Polisi kamwe hawamshikilii mtu kwa simu ya video wala kuomba pesa ili kumaliza kesi. Kata simu na upige polisi wa eneo lako.',
    'cat-loan-app':
      'Kopa tu kutoka kwa wakopeshaji waliosajiliwa na benki kuu. Usiruhusu programu kufikia anwani zako au picha zako.',
    'cat-utility-disconnection':
      'Lipa bili kupitia programu, tovuti au ofisi rasmi pekee. Kampuni za umeme hazikuombi upige nambari za watu binafsi.',
    'cat-tax-refund':
      'Dai marejesho ya kodi kupitia tovuti rasmi ya kodi pekee, ukiandika anwani mwenyewe.',
    'cat-government-scheme':
      'Kuomba mipango ya serikali ni bure kupitia tovuti rasmi. Usimlipe wakala kamwe.',
    'cat-family-emergency':
      'Kabla ya kutuma chochote, mpigie ndugu yako kwenye nambari uliyo nayo tayari.',
    'cat-marketplace':
      'Usirudishe “malipo ya ziada”. Subiri hadi pesa ziingie kweli kwenye akaunti yako.',
    'cat-rental': 'Usilipe amana kamwe kabla ya kuona nyumba na kuthibitisha mmiliki wake ni nani.',
    'cat-charity':
      'Changia kupitia tovuti rasmi ya shirika la hisani lililosajiliwa, si akaunti ya mtu binafsi.',
    'cat-phishing-link': 'Usifungue kiungo. Andika anwani ya tovuti rasmi mwenyewe.',
    'cat-sim-swap-otp':
      'Usishiriki kamwe misimbo ya mara moja (OTP). Simu yako ikipoteza mtandao ghafla, piga kampuni yako ya simu mara moja.',
    'cat-qr-code': 'Huhitaji kamwe kuchanganua msimbo au kuweka PIN yako ili kupokea pesa.',
    'cat-deepfake-voice':
      'Kata simu kisha upige tena nambari unayoijua. Kubalianeni kama familia neno la siri kwa ajili ya dharura.',
  },
  aiExplanation: 'Imetambuliwa na ukaguzi wa AI, unaoangalia ujumbe mzima katika muktadha wake.',
};
