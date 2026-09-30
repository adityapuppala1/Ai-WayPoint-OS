/**
 * Scam Shield rules. Each rule is a signal with a weight (0–1). Signals combine with a
 * noisy-OR, so several weak signs add up and one strong sign is enough on its own.
 *
 * Patterns run on folded text (lower-case, Latin accents removed, Arabic and Hindi spelling
 * variants unified — see foldText) and are folded the same way. Every rule carries cues in each
 * supported language: English, Hindi (Devanagari and romanised), Spanish, French,
 * Portuguese, Arabic and Swahili. Add a golden case to evals/datasets/scam.jsonl, in each
 * language it covers, for every rule you add or change.
 */
import type { ScamCategory } from '@waypoint/content/types';
import { unicodeBoundaries } from '../text/boundary';
import { foldPattern } from '../text/normalize';
import type { ShieldSignalKind } from '../types';

export const SHIELD_RULES_VERSION = '2026.09.3';

export interface ShieldRule {
  id: string;
  kind: ShieldSignalKind;
  category?: ScamCategory;
  weight: number;
  /** Every pattern must match somewhere in the text. */
  all: RegExp[];
  /** If any of these match, the rule does not fire (e.g. "never share your OTP"). */
  none?: RegExp[];
  title: string;
  explanation: string;
}

/** Any character that doesn't end a sentence (Latin, Hindi and Arabic punctuation). */
const S = '[^.!?।؟\\n]';

/**
 * Every pattern's folded source, before its `\b` became a word edge (for the tests that
 * check the edges match exactly as the full Unicode edge would).
 */
export const SHIELD_PATTERN_SOURCES: string[] = [];

/** One pattern from alternatives; `\b` becomes a word edge that works in every script. */
const r = (...alternatives: string[]) => {
  const source = foldPattern(alternatives.join('|'));
  SHIELD_PATTERN_SOURCES.push(source);
  return new RegExp(unicodeBoundaries(source), 'u');
};

// Hindi and Arabic words take prefixes and suffixes, so their cues match inside words.

const JOB = r(
  '\\b(?:job|jobs|work from home|wfh|part[- ]?time|full[- ]?time|vacanc(?:y|ies)|hiring|recruit\\w*|position|salary|task|tasks|data entry|typing work|offer letter|interview|naukri|kaam|ghar baithe)\\b',
  '\\b(?:empleo|trabajo|trabajos|vacantes?|contratacion|reclutamiento|emploi|travail|offre d.emploi|recrutement|embauche|teletravail|emprego|vagas?|trabalho|trabalhe de casa|contratacao|kazi|ajira|nafasi za kazi)\\b',
  'नौकरी|काम|भर्ती|घर बैठे|वर्क फ्रॉम होम',
  'وظيفه|وظائف|توظيف|عمل من المنزل|فرصه عمل',
);
const FEE = r(
  '\\b(?:registration|processing|joining|training|security|verification|onboarding|activation|refundable|kit|uniform|visa|medical) (?:fee|fees|charge|charges|deposit|amount)|\\b(?:pay|deposit|send|transfer) (?:a |the )?(?:small |one[- ]time |refundable )?(?:fee|deposit|amount) (?:of|to|for|before)|registration (?:fees?|charges?) (?:dena|bharna|pay)|\\bfees? (?:jama|bharni|deni) (?:karni|hogi|karo|karein)\\b',
  '\\b(?:cuota|tarifa|comision|pago|costo|deposito) (?:de )?(?:registro|inscripcion|entrenamiento|capacitacion|afiliacion|activacion|uniforme|material)\\b',
  '\\bfrais (?:d.?inscription|de dossier|de formation|d.adhesion|d.activation|de materiel)\\b',
  '\\b(?:taxa|valor|pagamento) de (?:cadastro|inscricao|treinamento|matricula|adesao|ativacao|uniforme|material)\\b',
  '\\bada ya (?:usajili|mafunzo|kujiunga|maombi|fomu|sare)\\b',
  'रजिस्ट्रेशन (?:फीस|शुल्क|चार्ज)|पंजीकरण शुल्क|(?:फीस|शुल्क) (?:जमा करनी|भरनी|देनी)|सिक्योरिटी (?:फीस|डिपॉजिट|राशि)',
  'رسوم (?:التسجيل|التدريب|الاشتراك|التفعيل|فتح الملف)',
);
/** Words for handing money over, used where a request must come with a payment. */
const PAYMENT_ACTION = r(
  '\\b(?:buy|purchase|pay|send|scratch|codes?|photo|picture)\\b',
  '\\b(?:compra|comprar|compre|paga|pagar|pague|envia|envie|enviar|raspa|codigo|codigos|foto|achetez|acheter|payez|payer|envoyez|grattez|code|codes|photo|comprar|raspe|nunua|lipa|tuma|kwangua|namba|picha)\\b',
  'खरीद|भुगतान|भेज|कोड|फोटो',
  'اشتر|شراء|ادفع|ارسل|اخدش|الرمز|الكود|صوره',
);

export const SHIELD_RULES: ShieldRule[] = [
  // ───────── Payment before you get something ─────────
  {
    id: 'pay-to-work',
    kind: 'payment',
    category: 'job',
    weight: 0.72,
    all: [JOB, FEE],
    title: 'Asks you to pay before you can work',
    explanation:
      'Real employers pay you. They never charge a fee to hire, train or give you a job.',
  },
  {
    id: 'task-earnings',
    kind: 'too-good',
    category: 'job',
    weight: 0.55,
    all: [
      r(
        '\\b(?:like|rate|review|follow|subscribe|watch|complete|simple|easy|small) (?:online |daily |home )?(?:videos?|products?|hotels?|apps?|youtube|channels?|pages?|tasks?)\\b|\\b(?:task|tasks) (?:and|to) earn|prepaid task|optimi[sz]e (?:products?|orders?)|rating tasks?',
        '\\b(?:dar me gusta|dando me gusta|dando like|dar like|calificar|calificando|valorar|valorando|resenar) (?:a |los |las )?(?:videos?|productos?|hoteles|aplicaciones|paginas)\\b|\\btareas (?:sencillas|simples|faciles|diarias|en linea)\\b|\\b(?:revisando|escribiendo|dejando|escrevendo|deixando) (?:resenas|opiniones|comentarios|avaliacoes)\\b',
        '\\b(?:liker|aimer|noter|notant|evaluer|evaluant|commenter) (?:des |les )?(?:videos?|produits?|hotels?|applications?|pages?)\\b|\\btaches (?:simples|faciles|quotidiennes|en ligne)\\b',
        '\\b(?:curtir|curtindo|avaliar|avaliando|assistir|assistindo) (?:a |os |as )?(?:videos?|produtos?|hoteis|aplicativos?|paginas?)\\b|\\btarefas (?:simples|faceis|diarias|online)\\b',
        '\\b(?:ku-?like|kupenda|kutazama|kukadiria) (?:video|picha|bidhaa)\\b|\\bkazi (?:rahisi|ndogo) (?:ya|za) mtandaoni\\b',
        '(?:वीडियो|प्रोडक्ट|होटल) (?:लाइक|रेटिंग|रेट)|(?:आसान|छोटे|रोजाना) (?:टास्क|काम)|\\bvideos? like kar\\w*|\\btasks? (?:complete )?kar\\w*',
        'مهام (?:بسيطه|سهله|يوميه)|(?:الاعجاب|اعجاب|تقييم) (?:ب)?(?:الفيديوهات|فيديوهات|المنتجات|منتجات|الفنادق)',
      ),
    ],
    title: 'Pays you for simple online tasks',
    explanation:
      'Task jobs that pay for likes, ratings or reviews usually end with a request to "top up" money you never get back.',
  },
  {
    id: 'earn-per-day',
    kind: 'too-good',
    category: 'job',
    weight: 0.4,
    all: [
      r(
        `\\b(?:earn|income|kamai|kamaye|ganar|ganhe|ganhar|pata|gagner)\\b${S}{0,30}(?:₹|rs\\.?|inr|\\$|usd|ksh|kes|ngn|₦|php|₱|r\\$|€|£)?\\s?\\d[\\d,]*${S}{0,20}\\b(?:per|a|every|daily|/)\\s?(?:day|hour|hr|week|din|dia|siku|jour)|\\bdaily (?:income|earning|profit|payout)s?\\b|(?:₹|rs\\.?|inr|\\$|usd|ksh|kes|ngn|₦|php|₱|r\\$|€|£)\\s?\\d[\\d,]*\\s?(?:daily|a day|per day|every day)\\b|\\b(?:₹|rs\\.?|inr|\\$|usd|ksh|kes)\\s?\\d[\\d,]*\\s?(?:per|a|/)\\s?(?:day|hour)`,
        `\\b(?:gana|ganas|gane|ganar|ganaras|ganhe|ganha|ganhar|ganhara|gagnez|gagner|gagnerez|recibe|recibes|receba|recevez)\\b${S}{0,30}\\d[\\d.,]*${S}{0,25}\\b(?:(?:por|al|a|par|ao) (?:dia|jour|semana|semaine|hora|heure)|diarios?|diarias?)\\b`,
        '\\b\\d[\\d.,]*\\s?(?:dolares|pesos|euros|soles|reais|dollars|francs|shilingi|€|\\$|usd|r\\$)\\s?(?:diarios?|diarias?|al dia|por dia|par jour|ao dia|kwa siku)\\b',
        `\\b(?:pata|jipatie|lipwa)\\b${S}{0,30}\\d[\\d.,]*${S}{0,20}\\bkwa (?:siku|saa|wiki)\\b`,
        `(?:रोजाना|प्रतिदिन|हर दिन|रोज)${S}{0,30}\\d[\\d,]*${S}{0,20}(?:रुपये|रुपए|₹|rs)${S}{0,20}(?:कमा|की कमाई|इनकम)|(?:रोजाना|प्रतिदिन|हर दिन|रोज)${S}{0,10}(?:₹|रु\\.?|rs\\.?)\\s?\\d[\\d,]*${S}{0,20}(?:कमा|कमाई|इनकम)|(?:कमाएं|कमाइए|कमाओ|कमाई|इनकम)${S}{0,40}(?:रोजाना|प्रतिदिन|हर दिन)`,
        `(?:اربح|اكسب|دخل|ارباح)${S}{0,30}\\d[\\d,.]*${S}{0,20}(?:يوميا|في اليوم|يومي|كل يوم|اسبوعيا|في الساعه)`,
        '\\b(?:easy money|dinero facil|argent facile|dinheiro facil|pesa rahisi)\\b|आसान पैसा|اموال سهله|مال سهل',
      ),
    ],
    title: 'Promises easy money every day',
    explanation:
      'Guaranteed daily earnings for little work is one of the most common hooks in job scams.',
  },
  {
    id: 'fee-to-receive',
    kind: 'payment',
    weight: 0.6,
    all: [
      r(
        `\\b(?:pay|send|transfer|deposit|clear)\\b${S}{0,40}\\b(?:fee|charges?|tax|customs|duty|delivery charge|processing|insurance|gst)\\b${S}{0,40}\\b(?:receive|release|claim|get|unlock|collect|deliver|disburse)\\b|\\b(?:customs|delivery|redelivery|release|clearance) (?:fee|charge|duty|payment)|\\b(?:pay|paying|send)\\b${S}{0,40}\\bshipping (?:fee|charge|cost)s?\\b|\\b(?:pay|send)\\b${S}{0,30}\\bto (?:release|receive|claim|unlock|collect) (?:your|the) (?:parcel|package|prize|reward|money|funds|refund|loan|delivery)\\b|\\bto (?:release|receive|claim|unlock|collect)\\b${S}{0,40}\\b(?:pay|send|transfer|deposit)\\b${S}{0,30}\\b(?:a |the )?(?:fee|charges?|tax|customs|duty)\\b`,
        // Spanish
        `\\b(?:paga|pague|pagar|pagando|abona|abone|deposita|deposite|transfiere|transfiera|envia|envie)\\b${S}{0,50}\\b(?:tarifa|cuota|impuestos?|aranceles?|comision|cargo|gastos|costo|seguro)\\b${S}{0,50}\\b(?:recibir\\w*|liberar\\w*|reclamar\\w*|cobrar\\w*|entregar\\w*|desbloquear\\w*)`,
        `\\b(?:paga|pague|pagar|pagando|abona|abone|cubre|cubra)\\b${S}{0,40}\\b(?:tarifa|gastos|costo|cargo|impuestos?|aranceles?|tasa) (?:de )?(?:envio|entrega|aduana|liberacion|desaduanaje|reenvio|importacion)\\b|\\b(?:tarifa|gastos|costo|cargo|impuestos?|aranceles?|tasa) (?:de )?(?:envio|entrega|aduana|liberacion|desaduanaje|reenvio|importacion)\\b${S}{0,40}\\b(?:paga|pague|pagar|abona|abone|pendientes? de pago)\\b|\\b(?:paga|pague|pagar)\\b${S}{0,30}\\bpara (?:liberar|recibir|reclamar|desbloquear)\\w*|\\bpara (?:liberar|recibir|reclamar|desbloquear)\\w*${S}{0,30}\\b(?:paga|pague|pagar|deposita|deposite)\\b|\\bpendientes? de pago\\b${S}{0,20}\\b(?:tasas?|tarifas?|aranceles?|impuestos?|gastos)\\b|\\b(?:paga|pague|pagar|pagando) (?:solo |solamente |unicamente )?(?:el|los) (?:envio|gastos de envio)\\b`,
        // French
        `\\b(?:payez|payer|reglez|regler|versez|verser|envoyez|envoyer|effectuez|acquittez)\\b${S}{0,50}\\b(?:frais|taxes?|droits|commission|montant)\\b${S}{0,50}\\b(?:recevoir|liberer|debloquer|recuperer|livrer|reclamer|toucher)\\b`,
        `\\b(?:payez|payer|payant|reglez|regler|reglant|acquittez)\\b${S}{0,40}\\b(?:frais|taxes?|droits) (?:de |d.)?(?:livraison|douane|dedouanement|reexpedition|liberation|port|expedition|reception|envoi|importation)\\b|\\b(?:frais|taxes?|droits) (?:de |d.)?(?:livraison|douane|dedouanement|reexpedition|liberation|port|expedition|reception|envoi|importation)\\b${S}{0,40}\\b(?:payez|payer|reglez|regler|a regler|a payer|impayes?)\\b|\\b(?:frais|montant)\\b${S}{0,30}\\b(?:doivent|doit) etre (?:regles?|payes?|acquittes?)\\b|\\bpour (?:recevoir|liberer|debloquer|recuperer)\\b${S}{0,30}\\b(?:payez|reglez|versez)\\b`,
        // Portuguese
        `\\b(?:pague|pagar|paga|deposite|depositar|transfira|transferir|envie|enviar|quite|quitar)\\b${S}{0,50}\\b(?:taxa|tarifa|impostos?|frete|tributos?|seguro|custas|valor)\\b${S}{0,50}\\b(?:receber|receba|liberar|resgatar|desbloquear|entregar|retirar|liberacao)\\b`,
        `\\b(?:pague|pagar|pagando|quite|quitar)\\b${S}{0,40}\\b(?:taxa|tarifa|custo|impostos?|tributos?) (?:de (?:entrega|envio|liberacao|desembaraco|importacao|alfandega|reentrega|resgate)|alfandegari[oa]s?|dos correios)\\b|\\b(?:taxa|tarifa|custo|impostos?|tributos?) (?:de (?:entrega|envio|liberacao|desembaraco|importacao|alfandega|reentrega|resgate)|alfandegari[oa]s?|dos correios)\\b${S}{0,40}\\b(?:pague|pagar|pendente|em aberto)\\b|\\bpara (?:liberar|receber|resgatar|desbloquear)\\b${S}{0,30}\\b(?:pague|pagar|deposite|transfira)\\b`,
        // Swahili
        `\\b(?:lipa|lipia|lipie|tuma|weka|toa)\\b${S}{0,50}\\b(?:ada|ushuru|kodi|gharama|malipo)\\b${S}{0,60}\\b(?:kupokea|upokee|kupata|upate|kuachiliwa|kuachilia|kutoa|kuchukua|kukomboa|kufikishiwa)\\b`,
        `\\b(?:lipa|lipia|lipie|tuma|toa)\\b${S}{0,40}\\b(?:ada ya (?:usafirishaji|kusafirisha|forodha|kuachilia|kutolea|kupokea|uwasilishaji|kuwasilisha)|ushuru wa forodha)\\b|\\bili (?:kupokea|kupata|kuachiliwa)\\b${S}{0,30}\\b(?:lipa|tuma)\\b`,
        // Hindi
        `(?:डिलीवरी|डिलिवरी|री-?डिलीवरी|कस्टम|कूरियर|पार्सल) (?:शुल्क|चार्ज|फीस)${S}{0,30}(?:भरें|भरिए|भरो|जमा करें|चुकाएं|पे करें|भेजें|बकाया)|(?:भरें|भरिए|जमा करें|चुकाएं|पे करें)${S}{0,30}(?:डिलीवरी|री-?डिलीवरी|कस्टम|कूरियर) (?:शुल्क|चार्ज|फीस)`,
        `(?:फीस|शुल्क|चार्ज)${S}{0,40}(?:भेजें|भरें|जमा करें|चुकाएं)${S}{0,30}(?:लोन|ऋण|पैसे|इनाम|पार्सल|रकम|राशि) (?:पाएं|पाइए|प्राप्त करें|लें)`,
        `(?:पाने|प्राप्त करने|छुडाने|रिलीज करने|क्लेम करने) के लिए${S}{0,40}(?:शुल्क|चार्ज|फीस|टैक्स)|(?:शुल्क|चार्ज|फीस|टैक्स)${S}{0,40}(?:पाने|प्राप्त करने|छुडाने|रिलीज करने|क्लेम करने) के लिए`,
        `\\b(?:release|receive|claim|paane|lene|chhudane) karne ke liye\\b${S}{0,40}\\b(?:fee|fees|charge|charges|rs|rupaye|paise)\\b`,
        // Arabic
        `(?:ادفع|دفع|سدد|سداد|ارسل)${S}{0,30}رسوم (?:التوصيل|الشحن|الجمارك|جمركيه|التخليص|الافراج|اعاده التوصيل|التسليم|التحويل)|رسوم (?:التوصيل|الشحن|الجمارك|جمركيه|التخليص|الافراج|اعاده التوصيل|التسليم|التحويل)${S}{0,30}(?:لاستلام|للافراج|مستحقه|غير مدفوعه)`,
        `(?:ادفع|دفع|سدد|سداد|حول|تحويل)${S}{0,50}(?:رسوم|ضريبه|جمارك|مبلغ)${S}{0,50}(?:لاستلام|لتسلم|للافراج|لتحرير|للحصول)|(?:لاستلام|للافراج عن|للحصول علي)${S}{0,40}(?:ادفع|دفع|سدد|رسوم)`,
      ),
    ],
    title: 'Asks for a fee to release money or a parcel',
    explanation:
      'Being asked to pay a small fee to receive a parcel, prize, loan or refund is a classic advance-fee scam.',
  },
  {
    id: 'gift-cards',
    kind: 'payment',
    category: 'tech-support',
    weight: 0.7,
    all: [
      r(
        '\\b(?:gift ?cards?|itunes|apple (?:gift )?card|google play (?:card|codes?)|steam (?:card|codes?)|amazon (?:gift )?card|voucher codes?)\\b',
        '\\b(?:tarjetas? de regalo|tarjeta (?:itunes|google play|steam|amazon)|cartes? cadeaux?|carte (?:itunes|google play|steam|amazon|pcs|transcash|neosurf)|coupons? (?:pcs|transcash|neosurf)|cartao presente|cartoes presente|vale-presente|kadi za zawadi|kadi ya (?:itunes|google play|steam|amazon))\\b',
        'गिफ्ट कार्ड|वाउचर कोड',
        'بطاق(?:ه|ات) (?:هدايا|هديه|ايتونز|جوجل بلاي|ستيم|امازون)',
      ),
      PAYMENT_ACTION,
    ],
    title: 'Wants payment in gift cards',
    explanation: 'No real business, tax office or police force asks to be paid in gift cards.',
  },
  {
    id: 'crypto-payment',
    kind: 'payment',
    category: 'crypto',
    weight: 0.45,
    all: [
      r(
        '\\b(?:bitcoin|btc|usdt|tether|crypto|ethereum|eth|wallet address|binance|cripto|criptomonedas?|criptomoedas?|cryptomonnaies?|sarafu za kidijitali)\\b',
        'बिटकॉइन|क्रिप्टो',
        'بيتكوين|عملات رقميه|كريبتو|عمله مشفره',
      ),
      r(
        '\\b(?:send|pay|deposit|transfer|invest|top ?up|recharge)\\b',
        '\\b(?:envia|envie|paga|pague|deposita|deposite|transfiere|transfira|invierte|invista|recarga|recarregue|envoyez|payez|deposez|transferez|investissez|rechargez|tuma|lipa|weka|wekeza)\\b',
        'भेजें|भुगतान|जमा करें|निवेश|इन्वेस्ट',
        'ارسل|ادفع|اودع|حول|استثمر|اشحن',
      ),
    ],
    title: 'Asks you to send cryptocurrency',
    explanation: 'Crypto payments are hard to trace or reverse, which is why scammers prefer them.',
  },
  {
    id: 'pin-to-receive',
    kind: 'payment',
    category: 'qr-code',
    weight: 0.8,
    all: [
      r(
        `\\b(?:scan|enter|type|approve|accept)\\b${S}{0,40}\\b(?:qr|code|upi pin|pin|collect request|payment request)\\b${S}{0,40}\\b(?:receive|get|credit|claim|refund)\\b|\\bto receive\\b${S}{0,30}\\b(?:scan|enter (?:your )?(?:upi )?pin)`,
        `\\b(?:escanea|escanee|ingresa|ingrese|introduce|aprueba|acepta)\\b${S}{0,40}\\b(?:qr|pin|clave|solicitud de (?:pago|cobro))\\b${S}{0,40}\\b(?:recibir|cobrar|reembolso|acreditar)\\w*|\\bpara recibir\\b${S}{0,40}\\b(?:escanea|escanee|ingresa (?:tu )?(?:pin|clave))`,
        `\\b(?:scannez|entrez|saisissez|approuvez|acceptez)\\b${S}{0,40}\\b(?:qr|code|pin|demande de paiement)\\b${S}{0,40}\\b(?:recevoir|encaisser|remboursement|crediter)\\b|\\bpour recevoir\\b${S}{0,40}\\b(?:scannez|entrez (?:votre )?(?:code )?(?:pin|code))`,
        `\\b(?:escaneie|digite|insira|aprove|aceite)\\b${S}{0,40}\\b(?:qr|codigo|pin|senha|solicitacao de pagamento)\\b${S}{0,40}\\b(?:receber|resgatar|reembolso|creditar)\\b|\\bpara receber\\b${S}{0,40}\\b(?:escaneie|digite (?:sua )?(?:senha|pin))`,
        `\\b(?:skani|weka|ingiza|kubali|idhinisha)\\b${S}{0,40}\\b(?:qr|pin|namba (?:yako )?ya siri)\\b${S}{0,40}\\b(?:kupokea|upokee|kurejeshewa)\\b|\\bili kupokea\\b${S}{0,40}\\b(?:weka|ingiza)\\b${S}{0,20}(?:pin|namba (?:yako )?ya siri)`,
        `पैसे (?:पाने|प्राप्त करने) के लिए${S}{0,40}(?:स्कैन|पिन)|(?:स्कैन|पिन डाल|पिन दर्ज)${S}{0,40}(?:पैसे (?:पाने|प्राप्त)|रिफंड|क्रेडिट)|\\bpaise (?:paane|lene) ke liye\\b${S}{0,30}\\b(?:scan|pin)\\b`,
        `(?:امسح|ادخل|اكتب|وافق|اقبل)${S}{0,40}(?:qr|الرمز|الرقم السري|طلب الدفع)${S}{0,40}(?:لاستلام|لتستلم|للاسترداد|لايداع)|لاستلام (?:المبلغ|الاموال|المال|اموالك)${S}{0,30}(?:امسح|ادخل الرقم السري)`,
      ),
    ],
    title: 'Asks you to scan a code or enter your PIN to receive money',
    explanation:
      'You never need to scan a QR code or enter your PIN to receive money — only to send it.',
  },
  {
    id: 'overpayment',
    kind: 'payment',
    category: 'marketplace',
    weight: 0.55,
    all: [
      r(
        `\\b(?:sent|paid|transferred|credited)\\b${S}{0,30}\\b(?:extra|more than|too much|by mistake|wrongly|mistakenly|by error)\\b|\\b(?:refund|return|send back|reverse)\\b${S}{0,20}\\b(?:the )?(?:difference|extra|excess)\\b`,
        '\\b(?:envie|deposite|transferi|pague) (?:de mas|por error|demasiado)\\b|\\bdevuelve(?:me)? la diferencia\\b',
        '\\b(?:envoye|verse|paye|vire) (?:en trop|par erreur)\\b|\\brembourse(?:z)?(?:-moi)? la difference\\b',
        '\\b(?:enviei|depositei|transferi|paguei|mandei)\\b (?:a mais|por engano|errado)|\\bdevolv(?:a|e) (?:a diferenca|o valor)\\b|\\bpix (?:errado|por engano)\\b',
        '\\bnimekutumia pesa (?:kimakosa|kwa makosa)|nimetuma pesa kimakosa|\\bnirudishie\\b',
        '(?:गलती|गलत) से (?:पैसे|भुगतान|ट्रांसफर|भेज)|ज्यादा पैसे (?:भेज|चले)|\\bgalti se (?:paise|payment|transfer|bhej)\\w*',
        '(?:ارسلت|حولت|دفعت) (?:لك )?(?:بالخطا|عن طريق الخطا|مبلغا زائدا)|(?:اعد|رجع) (?:لي )?(?:المبلغ|الفرق|الفلوس)',
      ),
    ],
    title: 'Says they paid you too much and wants some back',
    explanation:
      'The first payment often bounces or was never real, and the "refund" you send is lost.',
  },
  {
    id: 'rental-deposit',
    kind: 'payment',
    category: 'rental',
    weight: 0.55,
    all: [
      r(
        '\\b(?:deposit|advance|token amount|booking amount|first month)\\b',
        '\\b(?:deposito|anticipo|adelanto|fianza|primer mes|depot de garantie|caution|acompte|premier mois|caucao|sinal|adiantamento|primeiro mes|amana|malipo ya awali|kodi ya mwezi)\\b',
        'एडवांस|जमानत|सिक्योरिटी (?:डिपॉजिट|राशि)|पहले महीने का किराया|टोकन (?:राशि|अमाउंट)',
        'عربون|تامين|دفعه مقدمه|ايجار الشهر الاول',
      ),
      r(
        "\\b(?:before (?:viewing|seeing|visiting|the visit)|without (?:viewing|seeing|visiting)|i(?:'m| am) (?:abroad|overseas|out of (?:the )?(?:country|town)|travell?ing)|send (?:you )?the keys|army (?:officer|man)|posted (?:outside|in another city))",
        '\\b(?:antes de (?:ver|visitar)(?:la|lo)?|sin (?:verla|verlo|visitar(?:la|lo)?)|estoy (?:en el extranjero|fuera del pais|de viaje)|te envio las llaves|avant (?:de visiter|la visite)|sans (?:visite|visiter)|je suis (?:a l.etranger|en voyage|expatrie)|je vous envoie les cles|antes de (?:ver|visitar)|sem (?:ver|visitar)|estou (?:no exterior|fora do pais|viajando)|envio as chaves|kabla ya kuona|bila kuona|niko nje ya nchi|nitakutumia funguo)\\b',
        'देखे बिना|देखने से पहले|मैं (?:बाहर|विदेश) (?:हूं|में हूं)|चाबी (?:भेज|कूरियर)',
        'قبل (?:المعاينه|رؤيه|رويه|مشاهده)|بدون (?:معاينه|رؤيه|رويه)|انا (?:خارج البلد|في الخارج|مسافر)|سارسل لك المفاتيح',
      ),
    ],
    title: 'Wants a deposit before you can see the place',
    explanation:
      'Never pay for a rental you haven’t seen, from a landlord you haven’t met or checked.',
  },

  // ───────── Codes, passwords, account details ─────────
  {
    id: 'share-otp',
    kind: 'credentials',
    category: 'sim-swap-otp',
    weight: 0.78,
    all: [
      r(
        `\\b(?:share|send|tell|give|forward|read out|confirm|provide|dictate|enter)\\b${S}{0,25}\\b(?:otp|one[- ]time (?:password|code|pin)|verification code|security code|pin|cvv|cvc|password|passcode|login details|net ?banking|card details|card number)\\b|\\b(?:otp|code|pin) (?:bata|batao|bataiye|bata do|bhejo|bhejiye|share karo|de do)\\b`,
        '\\b(?:comparte|compartir|envia|enviame|reenviame|dime|dicta|dictame|pasame|mandame|dame|digame|indiqueme|proporcione) (?:el|tu|su|ese|los) (?:codigo|codigos|otp|pin|clave|contrasena|numero de verificacion)\\b',
        '\\b(?:donnez|envoyez|communiquez|transmettez|dictez|renvoyez|donne|envoie)[- ]?(?:moi|nous)? ?(?:le|votre|ce) (?:code|mot de passe|pin)\\b',
        '\\b(?:envie|passe|passa|me passa|informe|me diga|me envie|me manda|mande|manda|digite|repasse) (?:o|seu|sua|esse|este) (?:codigo|token|senha|pin)\\b',
        '\\b(?:nitumie|tuma|nipe|niambie|nitajie) (?:hiyo |ile )?(?:namba ya siri|nambari ya siri|pin|otp|code|msimbo|nambari ya uthibitisho|nywila|neno la siri)\\b',
        '(?:ओटीपी|कोड|पिन|पासवर्ड) (?:बताएं|बताइए|बताओ|बता दें|बता दीजिए|भेजें|भेजो|भेजिए|शेयर करें|दें|दीजिए)',
        '(?:ارسل|ارسلي|اعطني|اعطيني|شاركني|قل لي|اخبرني)(?: لي)? (?:الرمز|الكود|رمز التحقق|كلمه المرور|الرقم السري)|(?:الرمز|الكود|رمز التحقق) الذي (?:وصلك|استلمته|وصل اليك)',
        // "I sent a code to your number by mistake, send it to me": how chat accounts are stolen.
        `\\b(?:sent|texted)\\b${S}{0,40}\\bcode\\b${S}{0,40}\\b(?:by mistake|by accident|accidentally|to the wrong number)\\b|\\bcode\\b${S}{0,60}\\b(?:send|forward) it (?:back )?to me\\b`,
        `\\bcodigo\\b${S}{0,60}\\b(?:por error|por equivocacion|por engano)\\b|\\bcodigo\\b${S}{0,60}\\b(?:me lo (?:puedes |podrias )?(?:reenviar|enviar|pasar|mandar|dar)|reenviamelo|mandamelo|pasamelo|dimelo|me (?:passa|manda|envia|repassa)|pode me (?:passar|mandar|enviar|repassar))\\b`,
        `\\bcode\\b${S}{0,60}\\bpar erreur\\b|\\bcode\\b${S}{0,60}\\b(?:renvoie|renvoyez|transfere|transferez|envoie|envoyez)[- ]?(?:le[- ]?)?(?:moi|nous)\\b`,
        `\\b(?:code|namba|msimbo)\\b${S}{0,60}\\b(?:kimakosa|kwa makosa|kwa bahati mbaya)\\b|\\bnitumie (?:hiyo |ile )?(?:code|msimbo)\\b`,
        `(?:कोड|ओटीपी)${S}{0,60}(?:गलती से|गलत नंबर)|\\b(?:code|otp)\\b${S}{0,60}\\bgalti se\\b`,
        `(?:الرمز|الكود|رمز)${S}{0,60}(?:بالخطا|عن طريق الخطا|بالغلط)`,
      ),
    ],
    none: [
      r(
        `\\b(?:do not|don't|dont|never|not to|no one|nobody|will never|won't|should not|shouldn't)\\b${S}{0,25}\\b(?:share|send|tell|give|disclose|forward)|(?:is your|your) (?:otp|one[- ]time password|verification code) (?:is|for)\\b`,
        `\\b(?:no|nunca|jamas)\\b${S}{0,25}\\b(?:compart\\w*|reenvi\\w*|revel\\w*)|\\bnunca te (?:lo )?(?:pediremos|pedira|pediran|solicitaremos)\\b`,
        `\\bne\\b${S}{0,20}\\b(?:partag\\w*|communiqu\\w*|transmet\\w*|divulgu\\w*)|\\bnous ne vous (?:le )?demanderons jamais\\b`,
        `\\b(?:nao|nunca|jamais)\\b${S}{0,25}\\b(?:compartilh\\w*|repass\\w*|forneca|fornecer)|\\bnunca (?:pedimos|pediremos|solicitamos)\\b`,
        '\\b(?:usishiriki|usimpe|usimwambie|usitume|usimtumie|hatutakuomba)\\b',
        '(?:साझा|शेयर) न करें|(?:न|मत) (?:बताएं|बताइए|बताओ|बताना)|कभी नहीं (?:मांग|पूछ)|\\b(?:kisi ko|kisi se) (?:na|mat)\\b',
        'لا تشارك|لا تعطي|لا تخبر|لا ترسل|لن نطلب|لا تفصح',
      ),
    ],
    title: 'Asks for a code, PIN or password',
    explanation:
      'Banks, apps and officials never ask for your one-time code, PIN or password. Anyone who does is trying to get into your account.',
  },
  {
    id: 'kyc-block',
    kind: 'credentials',
    category: 'bank-kyc',
    weight: 0.6,
    all: [
      r(
        '\\b(?:kyc|know your customer|pan|aadhaar|aadhar|bvn|nin|account details|documents?|sim|details|taarifa)\\b',
        '\\b(?:datos|documentos|identificacion|informacion|dni|curp|rfc|nie|informations|coordonnees|donnees|justificatifs|identite|carte vitale|dados|cadastro|informacoes|cpf|cnpj|maelezo|kitambulisho|nyaraka|usajili)\\b',
        'केवाईसी|पैन|आधार|दस्तावेज|जानकारी|विवरण|सिम',
        'بياناتك|البيانات|معلوماتك|الهويه|الاقامه|وثائق|مستندات',
      ),
      r(
        '\\b(?:blocked|suspended|deactivated|closed|frozen|expire[ds]?|expiring|band ho jaye?ga|block ho jaye?ga)\\b',
        '\\b(?:bloquead[oa]|suspendid[oa]|desactivad[oa]|cancelad[oa]|cerrad[oa]|restringid[oa]|bloquee?|suspendue?|desactivee?|fermee?|restreinte?|suspens[oa]|desativad[oa]|encerrad[oa]|restrit[oa]|irregular|bloqueio|suspension|suspensao|fermeture)\\b',
        'fungwa|zuiwa|zuiliwa|simamishwa',
        'बंद हो जाएगा|बंद हो जायेगा|ब्लॉक|निलंबित|बंद कर दिया',
        'ايقاف|تعليق|حظر|اغلاق|تجميد|موقوف|معلق',
      ),
      r(
        '\\b(?:update|updated|complete|verify|re-?verify|link|submit|sasisha)\\b',
        '\\b(?:actualiza|actualice|actualizar|verifica|verifique|verificar|confirma|confirme|valida|valide|mettre a jour|mettez a jour|verifiez|verifier|confirmez|validez|actualisez|atualize|atualizar|atualizacao|regularize|confirme|verifique|thibitisha|hakiki|kamilisha)\\b',
        'अपडेट|सत्यापित|वेरिफाई|पूरा करें|लिंक करें',
        'تحديث|حدث|تاكيد|اكد|التحقق',
      ),
    ],
    title: 'Threatens to block your account unless you update details',
    explanation:
      'Banks and mobile operators don’t close accounts by text message. Check through the official app or branch.',
  },
  {
    id: 'click-to-verify',
    kind: 'link',
    category: 'phishing-link',
    weight: 0.35,
    all: [
      r(
        `\\b(?:click|tap|visit|open|follow|go to)\\b${S}{0,25}\\b(?:link|url|below|here)\\b${S}{0,40}\\b(?:verify|login|log in|sign in|update|unlock|reactivate|claim|confirm|secure|restore|avoid)\\b`,
        `\\b(?:haz clic|haga clic|pulsa|pulse|toca|ingresa|ingrese|entra|accede|visita|abre)\\b${S}{0,30}\\b(?:enlace|link|aqui|siguiente)\\b${S}{0,40}\\b(?:verificar|confirmar|actualizar|desbloquear|reactivar|iniciar sesion|reclamar|evitar)\\b`,
        `\\b(?:cliquez|cliquer|appuyez|rendez-vous|connectez-vous|visitez|ouvrez)\\b${S}{0,30}\\b(?:lien|ici|ci-dessous)\\b${S}{0,40}\\b(?:verifier|confirmer|mettre a jour|debloquer|reactiver|vous connecter|reclamer|eviter)\\b`,
        `\\b(?:clique|acesse|toque|entre|abra|visite)\\b${S}{0,30}\\b(?:link|aqui|abaixo)\\b${S}{0,40}\\b(?:verificar|confirmar|atualizar|desbloquear|reativar|entrar|resgatar|evitar|regularizar)\\b`,
        `\\b(?:bonyeza|bofya|fungua|tembelea|ingia)\\b${S}{0,30}\\b(?:kiungo|link|hapa|hapo chini)\\b${S}{0,50}\\b(?:thibitisha|sasisha|kuthibitisha|kusasisha|kurejesha|kudai|kuepuka)\\b`,
        `(?:लिंक|link) (?:पर )?(?:क्लिक|टैप) (?:करें|करके|कर)${S}{0,40}(?:अपडेट|सत्यापित|वेरिफाई|अनब्लॉक|लॉगिन|क्लेम|चालू)|\\blink (?:par |pe )?(?:click|tap) (?:karein|karen|kare|karo|karke)\\b`,
        `(?:اضغط|انقر|افتح|ادخل|قم بزياره)${S}{0,30}(?:الرابط|هنا|اللينك)${S}{0,50}(?:لتحديث|لتاكيد|للتحقق|لتفعيل|لاستعاده|لفك|لتجنب|للمطالبه|لاستلام)`,
      ),
    ],
    title: 'Asks you to sign in or verify through a link',
    explanation:
      'Links in messages can lead to copies of real websites built to steal your password.',
  },
  {
    id: 'remote-access',
    kind: 'credentials',
    category: 'tech-support',
    weight: 0.62,
    all: [
      r(
        '\\b(?:anydesk|any desk|teamviewer|team viewer|quicksupport|quick support|rustdesk|airdroid|screen ?shar(?:e|ing)|remote access|remote support|acceso remoto|acces a distance|prise en main a distance|acesso remoto)\\b',
        'एनीडेस्क|टीमव्यूअर|स्क्रीन शेयर',
        'اني ديسك|انى ديسك|تيم فيور|التحكم عن بعد',
      ),
    ],
    title: 'Wants to control your phone or computer remotely',
    explanation:
      'Remote-access apps let a stranger see your screen and move money from your accounts.',
  },
  {
    id: 'install-apk',
    kind: 'link',
    category: 'bank-kyc',
    weight: 0.5,
    all: [
      r(
        `\\b(?:install|download)\\b${S}{0,30}\\b(?:apk|app|application|file)\\b`,
        `\\b(?:instala|instalar|instale|descarga|descargar|baja|installez|installer|telechargez|telecharger|baixe|baixar|pakua|sakinisha)\\b${S}{0,30}\\b(?:apk|app|aplicacion|aplicativo|application|archivo|arquivo|fichier|programu|faili)\\b`,
        `(?:डाउनलोड|इंस्टॉल|इंस्टाल)${S}{0,30}(?:ऐप|एप|एपीके|apk|फाइल)|(?:ऐप|एप|apk) (?:डाउनलोड|इंस्टॉल|इंस्टाल)|\\bapp (?:download|install) (?:karo|karein|kare)\\b`,
        `(?:ثبت|تثبيت|حمل|تحميل|نزل|تنزيل)${S}{0,30}(?:تطبيق|التطبيق|ملف|apk)`,
      ),
      r(
        '\\b(?:kyc|update|bank|reward|points|refund|bill|verify|customer care|loan)\\b',
        '\\b(?:banco|actualizacion|actualizar|premio|puntos|reembolso|factura|verificar|atencion al cliente|prestamo|banque|mise a jour|recompense|remboursement|verifier|service client|pret|atualizacao|atualizar|pontos|fatura|atendimento|emprestimo|benki|sasisha|zawadi|marejesho|bili|thibitisha|huduma kwa wateja|mkopo|suporte|soporte|support)\\b',
        'बैंक|केवाईसी|अपडेट|इनाम|रिफंड|बिल|वेरिफाई|कस्टमर केयर|लोन',
        'البنك|بنك|تحديث|مكافاه|نقاط|استرداد|فاتوره|التحقق|خدمه العملاء|قرض|الدعم',
      ),
    ],
    title: 'Asks you to install an app from a message',
    explanation:
      'Apps sent by message can read your texts and one-time codes. Only install apps from the official store.',
  },

  // ───────── Pressure and secrecy ─────────
  {
    id: 'deadline',
    kind: 'pressure',
    weight: 0.25,
    all: [
      r(
        '\\b(?:within|in) (?:\\d{1,2}|twenty[- ]four|24|48) ?(?:hours?|hrs?|minutes?|mins?)\\b|\\b(?:today only|immediately|urgent(?:ly)?|asap|right now|act now|last (?:chance|warning|reminder|date)|final (?:notice|warning|reminder)|expires? (?:today|tonight)|before midnight|jaldi|turant|abhi)\\b',
        '\\b(?:urgente|inmediatamente|de inmediato|hoy mismo|ahora mismo|solo hoy|ultimo aviso|ultima oportunidad|antes de (?:la )?medianoche|en (?:las proximas )?(?:24|48) horas|tout de suite|immediatement|dernier (?:avis|rappel|delai)|derniere chance|avant minuit|dans les (?:24|48) heures|imediatamente|hoje mesmo|agora mesmo|ultimo aviso|ultima chance|antes da meia-noite|nas proximas (?:24|48) horas|so hoje|haraka|sasa hivi|leo hii|mara moja|onyo la mwisho|nafasi ya mwisho|ndani ya saa (?:24|48|ishirini na nne))\\b',
        'तुरंत|अभी|आज ही|अंतिम (?:चेतावनी|मौका)|आखिरी (?:चेतावनी|मौका)|(?:24|48) घंटे',
        'فورا|عاجل|الان|اليوم فقط|خلال (?:24|48) ساعه|اخر فرصه|تحذير اخير|انذار اخير|قبل منتصف الليل',
      ),
    ],
    title: 'Rushes you',
    explanation: 'Pressure to act fast is designed to stop you checking with anyone.',
  },
  {
    id: 'threat',
    kind: 'pressure',
    weight: 0.4,
    all: [
      r(
        `\\b(?:account|number|sim|card|electricity|power|connection|service|wallet|upi|mpesa|gas)\\b${S}{0,30}\\b(?:will be |shall be |is being |has been )?(?:blocked|suspended|disconnected|deactivated|cut off|terminated|closed|barred)\\b|\\b(?:legal action|arrest warrant|police case|fir (?:has been |is )?(?:registered|filed|lodged)|court (?:notice|summons)|case (?:registered|filed) against you|you will be arrested|penalty)\\b`,
        `\\b(?:cuenta|numero|linea|tarjeta|servicio|luz|electricidad|suministro|billetera)\\b${S}{0,30}\\b(?:bloquead[oa]|suspendid[oa]|cortad[oa]|desactivad[oa]|cancelad[oa]|cerrad[oa])\\b|\\b(?:accion(?:es)? legal(?:es)?|orden de (?:arresto|detencion)|denuncia penal|multa|seras? (?:arrestad[oa]|detenid[oa])|citacion judicial)\\b|\\b(?:denuncia|demanda|investigacion)\\b${S}{0,25}\\b(?:contra (?:usted|ti)|en su contra|en tu contra)\\b`,
        `\\b(?:compte|numero|ligne|carte|service|electricite|courant|abonnement)\\b${S}{0,30}\\b(?:bloquee?|suspendue?|coupee?|desactivee?|resilie|fermee?)\\b|\\b(?:poursuites (?:judiciaires|penales)|mandat d.arret|plainte (?:deposee|penale)|amende|vous serez arrete|convocation (?:judiciaire|au tribunal))\\b|\\b(?:plainte|enquete|proces)\\b${S}{0,25}\\bcontre vous\\b`,
        `\\b(?:conta|numero|linha|cartao|servico|luz|energia|fornecimento|carteira|pix)\\b${S}{0,30}\\b(?:bloquead[oa]|suspens[oa]|cortad[oa]|desativad[oa]|cancelad[oa]|encerrad[oa])\\b|\\b(?:acao judicial|processo judicial|mandado de prisao|multa|voce sera pres[oa]|intimacao)\\b|\\b(?:denuncia|queixa|processo|investigacao)\\b${S}{0,25}\\bcontra (?:voce|o senhor|a senhora)\\b`,
        `\\b(?:akaunti|namba|laini|simu|kadi|huduma|umeme|m-?pesa)\\b${S}{0,30}(?:itafungwa|imefungwa|itazuiwa|imezuiwa|itasimamishwa|imesimamishwa|itakatwa|utakatwa|itakatizwa)|\\b(?:hatua za kisheria|utakamatwa|faini|kesi dhidi yako|hati ya kukamatwa)\\b`,
        `(?:खाता|अकाउंट|नंबर|सिम|कार्ड|बिजली|कनेक्शन|सेवा)${S}{0,30}(?:बंद हो|ब्लॉक|निलंबित|काट दिया|कट जाएगा|काट दी)|कानूनी कार्रवाई|गिरफ्तार|एफआईआर|जुर्माना|वारंट|\\b(?:account|sim|number|connection)\\b${S}{0,30}\\b(?:band|block|kat) (?:ho )?(?:jayega|jaega|jayegi|jaegi|kar diya jayega)\\b|\\b(?:giraftar|kanooni karyawahi)\\b`,
        `(?:حسابك|الحساب|رقمك|الخط|بطاقتك|الخدمه|الكهرباء|العداد|محفظتك)${S}{0,30}(?:ايقاف|حظر|تعليق|قطع|اغلاق|تجميد|الغاء)|اجراءات قانونيه|مذكره (?:اعتقال|توقيف)|سيتم (?:القبض عليك|اعتقالك)|غرامه|دعوي قضائيه|(?:بلاغ|قضيه|شكوي) ضدك`,
      ),
    ],
    title: 'Threatens you with a penalty or cut-off',
    explanation:
      'Threats of arrest, fines or disconnection are used to scare people into paying quickly.',
  },
  {
    id: 'secrecy',
    kind: 'secrecy',
    weight: 0.5,
    all: [
      r(
        "\\b(?:don't|do not|dont|never) (?:tell|inform|share this with|let) (?:anyone|anybody|your (?:family|parents|husband|wife|bank|friends))\\b|\\bkeep (?:this|it) (?:secret|confidential|private|between us)\\b|\\b(?:stay|remain) on (?:the )?(?:call|line|video(?: call)?)\\b|\\b(?:cut|disconnect) the call\\b[^.!?।؟\\n]{0,20}\\b(?:arrest|action)|kisi ko (?:mat|na) (?:batana|bataye)|\\bcall (?:mat|na) (?:kaatna|kaato|katna)\\b",
        '\\bno (?:se lo |le )?(?:digas|cuentes|diga|cuente) (?:nada )?a (?:nadie|tu familia|tu banco)\\b|\\bmantenlo en secreto\\b|\\bno cuelgues\\b|\\bn.en parlez a personne\\b|\\bne dites rien a (?:personne|votre famille|votre banque)\\b|\\bgardez (?:le|cela|ca) secret\\b|\\bne raccrochez pas\\b|\\bnao (?:conte|fale) (?:a|para|com) ninguem\\b|\\bmantenha (?:em )?segredo\\b|\\bnao desligue\\b|\\busimwambie mtu\\b|\\busiwaambie\\b|\\b(?:iwe|weka) siri\\b|\\busikate simu\\b',
        'किसी (?:को|से) (?:मत|न) (?:बताना|बताएं|बताइए|बताओ|कहना|कहें)|गुप्त रखें|(?:फोन|कॉल) (?:मत|न) (?:काटें|काटिए|काटना)|कॉल पर बने रहें',
        'لا تخبر (?:احدا|اي احد|عائلتك)|لا تقل لاحد|ابق(?:ي)? علي الخط|لا تغلق الخط|هذا (?:الامر )?سري|احتفظ بالامر سرا',
      ),
    ],
    title: 'Tells you to keep it secret',
    explanation:
      'Scammers isolate you so no one can warn you. Real officials and employers never demand secrecy.',
  },

  // ───────── Authority and impersonation ─────────
  {
    id: 'digital-arrest',
    kind: 'authority',
    category: 'digital-arrest',
    weight: 0.92,
    all: [
      r(
        `\\bdigital(?:ly)? arrest\\b|\\b(?:video call|skype|whatsapp call)\\b${S}{0,60}\\b(?:arrest|custody|investigation|interrogation)\\b|\\b(?:arrest|custody)\\b${S}{0,60}\\b(?:video call|skype|online)\\b`,
        '\\b(?:arresto digital|detencion digital|arrestation (?:numerique|virtuelle)|prisao digital|prisao virtual)\\b',
        'डिजिटल (?:अरेस्ट|गिरफ्तारी|हिरासत)',
        'اعتقال (?:رقمي|الكتروني)',
      ),
    ],
    title: 'Claims you are under “digital arrest”',
    explanation:
      'There is no such thing as a digital arrest. Police never hold anyone on a video call or ask for money to settle a case.',
  },
  {
    id: 'agency-parcel',
    kind: 'authority',
    category: 'impersonation-authority',
    weight: 0.6,
    all: [
      r(
        '\\b(?:cbi|ed|enforcement directorate|ncb|narcotics|police|cyber (?:cell|crime|police)|customs|interpol|fbi|dea|irs|hmrc|income tax|trai|rbi|sebi|crime branch|immigration|efcc|dci|nbi)\\b',
        '\\b(?:policia|fiscalia|aduana|guardia civil|agencia tributaria|juzgado|ministerio publico|gendarmerie|douanes?|impots|tribunal|procureur|policia federal|receita federal|alfandega|delegacia|polisi|forodha|mahakama)\\b',
        'पुलिस|सीबीआई|कस्टम|साइबर (?:सेल|क्राइम)|प्रवर्तन निदेशालय|एनसीबी|क्राइम ब्रांच|आयकर',
        'الشرطه|الجمارك|النيابه|الانتربول|المباحث|مكافحه المخدرات|المحكمه',
      ),
      r(
        '\\b(?:parcel|package|courier|fedex|dhl|drugs?|narcotics|money laundering|aadhaar (?:misuse|linked)|illegal|case (?:against|registered)|your (?:number|sim|aadhaar|pan) (?:is|was|has been) (?:used|linked|involved))\\b',
        '\\b(?:paquete|drogas|narcoticos|lavado de dinero|ilegal|colis|drogue|stupefiants|blanchiment|illegal|encomenda|pacote|entorpecentes|lavagem de dinheiro|kifurushi|dawa za kulevya|utakatishaji wa fedha|haramu)\\b',
        'पार्सल|ड्रग्स|नशीले पदार्थ|मनी लॉन्ड्रिंग|अवैध|आपके आधार|केस दर्ज',
        'طرد|مخدرات|غسيل (?:اموال|الاموال)|غسل (?:اموال|الاموال)|غير قانوني|قضيه ضدك',
      ),
    ],
    title: 'Pretends to be police, customs or a government agency',
    explanation:
      'Agencies don’t call about seized parcels or ask you to pay to clear your name. Hang up and call the agency’s official number yourself.',
  },
  {
    id: 'utility-cutoff',
    kind: 'authority',
    category: 'utility-disconnection',
    weight: 0.7,
    all: [
      r(
        '\\b(?:electricity|electric|power|light|bijli|current|gas|water) (?:bill|connection|supply|board|office|officer)\\b',
        '\\b(?:luz|electricidad|servicio electrico|electricite|compteur|edf|senelec|energia|eletricidade|conta de luz|umeme|luku|tanesco|kplc|kenya power)\\b',
        'बिजली',
        'الكهرباء|العداد',
      ),
      r(
        '\\b(?:disconnect(?:ed|ion)?|cut|kat|band|will be (?:stopped|cut)|tonight|today at|(?:9|9:30|10|10:30) ?pm)\\b',
        '\\b(?:corte|cortara|sera cortad[oa]|suspension del servicio|esta noche|hoy a las|coupure|sera coupee?|ce soir|aujourd.hui a|cortad[oa]|sera cortad[oa]|hoje a noite|hoje as|kukatwa|utakatwa|itakatwa|kukatizwa|usiku wa leo|leo saa)\\b',
        'कट|काट दिया जाएगा|बंद कर दिया जाएगा|आज रात',
        'قطع|فصل|الليله|اليوم الساعه',
      ),
      r(
        `\\b(?:call|contact|whatsapp|update|pay)\\b${S}{0,40}\\d{6,}|\\bofficer\\b|\\bnot updated\\b|\\bpending\\b`,
        `\\b(?:llame|llama|contacte|comuniquese|marque|appelez|contactez|composez|ligue|contate|piga|wasiliana|pigia)\\b${S}{0,40}\\d{6,}|\\b(?:pendiente|vencid[oa]|atrasad[oa]|falta de pago|sin pagar|impayee?s?|en retard|pendente|em atraso|em aberto|deni|haijalipwa|imechelewa|malimbikizo)\\b`,
        `(?:कॉल|संपर्क|फोन|व्हाट्सएप)${S}{0,40}\\d{6,}|अधिकारी|अपडेट नहीं|बकाया|लंबित`,
        `(?:اتصل|تواصل|كلم)${S}{0,40}\\d{6,}|متاخره|غير مدفوعه|مستحقه|متاخرات`,
      ),
    ],
    title: 'Says your electricity will be cut tonight',
    explanation:
      'Power companies send notices through official bills and apps, not texts asking you to call a personal number.',
  },
  {
    id: 'tax-refund',
    kind: 'authority',
    category: 'tax-refund',
    weight: 0.55,
    all: [
      r(
        `\\b(?:tax|income tax|irs|hmrc|revenue|kra|firs|sars|gst)\\b${S}{0,30}\\b(?:refund|rebate|reimbursement|return (?:is )?(?:approved|pending))\\b`,
        '\\b(?:devolucion (?:de impuestos|fiscal|de hacienda|de la renta)|reembolso (?:de impuestos|fiscal)|remboursement (?:d.impots?|fiscal|des impots)|restitution (?:d.impots?|fiscale)|restituicao (?:do imposto|de imposto|do ir)|reembolso de imposto|devolucao de imposto|marejesho ya kodi|kurejeshewa kodi)\\b',
        'टैक्स रिफंड|आयकर (?:रिफंड|वापसी)|इनकम टैक्स रिफंड',
        'استرداد (?:الضريبه|الضرائب)|استرجاع ضريبي',
      ),
      r(
        '\\b(?:click|link|claim|verify|submit|account details|bank details|login)\\b',
        '\\b(?:haga clic|haz clic|pulse|enlace|reclamar|reclame|datos bancarios|cliquez|lien|reclamer|coordonnees bancaires|rib|clique|resgatar|dados bancarios|acesse|bonyeza|kiungo|dai|taarifa za benki)\\b',
        'लिंक|क्लिक|क्लेम|बैंक (?:विवरण|डिटेल)',
        'اضغط|الرابط|المطالبه|بيانات (?:البنك|بنكيه)',
      ),
    ],
    title: 'Offers a tax refund through a link',
    explanation: 'Tax refunds are handled through the official tax portal, not links in messages.',
  },
  {
    id: 'gov-scheme-fee',
    kind: 'authority',
    category: 'government-scheme',
    weight: 0.5,
    all: [
      r(
        '\\bpm (?:yojana|scheme|kisan|awas)\\b|\\b(?:government|govt|sarkari|yojana|scheme|subsidy|grant|relief fund|free laptop|free (?:scooty|ration|recharge))\\b',
        '\\b(?:subsidio|bono del gobierno|programa (?:del gobierno|social)|ayuda del gobierno|aide (?:de l.etat|du gouvernement)|subvention|prime (?:de l.etat|gouvernementale)|auxilio (?:emergencial|brasil|do governo)|bolsa familia|beneficio do governo|ruzuku|msaada wa serikali|mpango wa serikali)\\b',
        'योजना|सरकारी|सब्सिडी|अनुदान',
        'دعم حكومي|منحه (?:حكوميه|الحكومه)|برنامج حكومي|مساعده حكوميه|اعانه',
      ),
      r(
        '\\b(?:register|apply|claim|fee|charges|pay|link|form)\\b',
        '\\b(?:registrate|inscribete|solicita|reclama|paga|pago|enlace|formulario|inscrivez|postulez|reclamez|frais|payez|lien|cadastre|inscreva|solicite|resgate|taxa|pague|jisajili|omba|dai|ada|lipa|kiungo|fomu)\\b',
        'रजिस्टर|आवेदन|फीस|शुल्क|भुगतान|लिंक|फॉर्म|पंजीकरण',
        'سجل|قدم|طالب|رسوم|ادفع|الرابط|الاستماره|نموذج',
      ),
    ],
    title: 'Offers a government benefit for a fee or through a link',
    explanation:
      'Government schemes are free to apply for through official portals. Nobody needs to pay an agent.',
  },

  // ───────── Too good to be true ─────────
  {
    id: 'guaranteed-returns',
    kind: 'too-good',
    category: 'investment',
    weight: 0.72,
    all: [
      r(
        `\\b(?:guaranteed|assured|fixed|risk[- ]free|sure[- ]shot|100%) (?:returns?|profits?|income|gains?)\\b|\\bdouble (?:your|the) (?:money|investment|amount)\\b|\\b\\d{2,3} ?% (?:returns?|profits?|daily|weekly|monthly|interest)\\b|\\b(?:returns?|profits?) of \\d{2,3} ?%|\\b(?:trading|forex|ipo|stock) (?:tips|group|signals|mentor)\\b${S}{0,40}\\b(?:profit|returns|join)\\b|\\b(?:paisa|paise) double\\b|\\bguaranteed return\\b|\\bpakka munafa\\b`,
        '\\b(?:rendimientos? (?:garantizad[oa]s?|asegurad[oa]s?)|ganancias? (?:garantizadas?|aseguradas?)|duplica (?:tu|su) (?:dinero|inversion)|rendement (?:garanti|assure)|(?:profits?|gains?|benefices?) garantis|doublez (?:votre|vos) (?:argent|investissement|mise)|retorno (?:garantido|certo)|lucros? garantidos?|rendimento garantido|dobre (?:seu|o seu) (?:dinheiro|investimento)|faida (?:ya uhakika|iliyohakikishwa)|mapato ya uhakika|zidisha pesa (?:yako|zako)(?: mara mbili)?)\\b',
        '\\b\\d{1,3} ?% (?:(?:de |ya )?(?:rendimiento|ganancia|interes|rendement|profit|benefice|retorno|lucro|faida|riba) )?(?:diario|semanal|mensual|al dia|al mes|par jour|par semaine|par mois|ao dia|ao mes|por dia|por semana|por mes|kila (?:siku|wiki|mwezi))\\b',
        'गारंटीड (?:रिटर्न|मुनाफा)|पक्का (?:मुनाफा|रिटर्न)|निश्चित (?:रिटर्न|लाभ)|(?:पैसा|पैसे|रकम) डबल|दोगुना',
        'ارباح مضمونه|عائد مضمون|ربح مضمون|عوائد مضمونه|ضاعف (?:اموالك|استثمارك|اموالكم)',
        // "Invest 100 and get 1,000": a promised multiple is a promise no real investment makes.
        `\\b(?:invest|invierte|invierta|investissez|invista|investe|wekeza)\\b${S}{0,25}\\d[\\d.,]*${S}{0,40}\\b(?:get|receive|earn|make|recibe|reciba|gana|obten|recevez|gagnez|obtenez|receba|ganhe|lucre|pata|upate|pokea)\\b${S}{0,20}\\d`,
        `(?:निवेश करें|इन्वेस्ट करें|लगाएं|लगाकर)${S}{0,30}\\d${S}{0,40}(?:पाएं|कमाएं)|استثمر${S}{0,30}\\d${S}{0,40}(?:واحصل|واربح|تحصل|تربح)${S}{0,20}\\d`,
      ),
    ],
    title: 'Promises high or guaranteed returns',
    explanation:
      'Real investments can lose money. Guaranteed high returns are the signature of investment fraud.',
  },
  {
    id: 'prize',
    kind: 'too-good',
    category: 'lottery-prize',
    weight: 0.55,
    all: [
      r(
        `\\b(?:you(?:'ve| have)? won|you are (?:the |a )?(?:lucky )?winner|congratulations?${S}{0,40}(?:won|winner|prize|reward)|lucky draw|lottery|jackpot|claim your (?:prize|reward|gift|cashback)|kbc|aapne jeeta|inaam)\\b`,
        `\\b(?:has ganado|ganaste|eres (?:el )?ganador|ganador de|has sido seleccionad[oa]|reclama tu premio|sorteo|loteria|vous avez (?:gagne|ete selectionne)|vous etes (?:le |l.heureux )?gagnant|tirage au sort|loterie|reclamez votre (?:prix|lot|cadeau)|voce ganhou|voce foi (?:sorteado|selecionado)|ganhador|sorteio|resgate (?:o |seu )?(?:seu )?premio|umeshinda|mshindi|bahati nasibu|droo|dai zawadi yako)\\b|\\b(?:felicidades|enhorabuena|felicitations|parabens|hongera|pongezi)\\b${S}{0,50}\\b(?:gan\\w+|premio|gagn\\w+|prix|lot|cadeau|premio|sortead\\w+|umeshinda|zawadi|mshindi)\\b`,
        'आपने जीता|जीते हैं|जीत गए|इनाम|लॉटरी|लकी ड्रा|विजेता',
        'لقد ربحت|ربحت|فزت|انت الفائز|جائزه|جائزتك|السحب|اليانصيب|يانصيب',
      ),
    ],
    title: 'Says you won a prize you didn’t enter',
    explanation:
      'You can’t win a lottery or lucky draw you never entered. Prize scams end with a “fee” to claim it.',
  },
  {
    id: 'inheritance',
    kind: 'too-good',
    category: 'other',
    weight: 0.5,
    all: [
      r(
        '\\b(?:sole (?:beneficiary|heir)|next of kin|unclaimed (?:inheritance|funds?|estate)|inheritance (?:fund|claim|transfer)|beneficiary (?:of|to) (?:a|an|the|this) (?:fund|estate|deposit|inheritance|will))\\b',
        '\\b(?:unic[oa] (?:heredero|heredera|herdeir[oa])|herencia (?:no reclamada|sin reclamar)|beneficiari[oa] de (?:una |la )?(?:herencia|heranca|fortuna)|(?:l.)?unique (?:heritier|heritiere)|heritage (?:non reclame|en attente)|beneficiaire (?:d.un|du|de la) (?:heritage|fonds|succession|compte)|heranca (?:nao reclamada|milionaria)|mrithi (?:pekee|halali)|urithi wa)\\b',
        'एकमात्र (?:वारिस|उत्तराधिकारी)|विरासत की (?:रकम|राशि)',
        'الوريث الوحيد|ميراث (?:بقيمه|قدره)|تركه (?:بقيمه|قدرها)',
      ),
      r(
        '\\bmillions?\\b|\\bmillones\\b|\\bmilhoes\\b|\\bmilioni\\b|\\d[\\d.,]{4,}',
        'लाख|करोड़|مليون|ملايين',
      ),
    ],
    title: 'Says you are heir to a fortune',
    explanation:
      'Unexpected inheritances from strangers end with “fees” or taxes to release the money, which never arrives.',
  },
  {
    id: 'instant-loan',
    kind: 'too-good',
    category: 'loan-app',
    weight: 0.45,
    all: [
      r(
        `\\b(?:instant|pre[- ]?approved|guaranteed|without (?:documents|cibil|credit (?:check|score)|salary slip))\\b${S}{0,30}\\bloans?\\b|\\bloans?\\b${S}{0,30}\\b(?:approved|sanctioned|disbursed) (?:instantly|in minutes|without)|\\b(?:turant|instant) loan\\b`,
        '\\b(?:prestamo|credito) (?:inmediato|al instante|rapido|preaprobado|pre-aprobado|sin buro|sin aval|sin papeles|garantizado)\\b|\\b(?:pret|credit) (?:immediat|instantane|rapide|pre-approuve|sans justificatif|garanti)\\b|\\b(?:emprestimo|credito) (?:imediato|na hora|rapido|pre-aprovado|sem consulta|garantido)\\b|\\bmkopo (?:wa haraka|wa papo hapo|bila dhamana|umeidhinishwa)\\b',
        `(?:तुरंत|इंस्टेंट) (?:लोन|ऋण)|बिना (?:दस्तावेज|सिबिल|गारंटी) (?:के )?(?:लोन|ऋण)|प्री-?अप्रूव्ड लोन|(?:लोन|ऋण)${S}{0,20}(?:मंजूर|स्वीकृत|अप्रूव)`,
        'قرض (?:فوري|سريع|بدون ضمان|بدون كفيل|معتمد)|تمويل فوري',
      ),
    ],
    title: 'Offers an instant loan with no checks',
    explanation:
      'Unregistered loan apps often charge hidden fees and harass borrowers. Use lenders registered with your central bank.',
  },

  // ───────── People and relationships ─────────
  {
    id: 'family-new-number',
    kind: 'channel-switch',
    category: 'family-emergency',
    weight: 0.6,
    all: [
      r(
        `\\b(?:hi|hey|hello|hii)\\b${S}{0,15}\\b(?:mum|mom|mummy|mama|dad|daddy|papa|son|beta|grandma|grandpa|nani|dadi)\\b|\\b(?:this is|it's|its) (?:your )?(?:son|daughter|mum|mom|dad|beta|beti)\\b|\\b(?:beta|beti|mummy|papa|maa)\\b,? (?:mera|main|mai|ye|yeh)\\b`,
        '\\b(?:hola|oye) (?:mama|papa|abuela|abuelo|hij[oa])\\b|\\bsoy (?:yo,? )?(?:tu )?(?:hij[oa]|mama|papa)\\b|\\b(?:coucou|salut|bonjour) (?:maman|papa|mamie|papi)\\b|\\bc.est (?:moi|ton fils|ta fille)\\b|\\b(?:oi|ola) (?:mae|pai|vo|vovo|filh[oa])\\b|\\bsou eu,? (?:seu|sua) filh[oa]\\b|\\b(?:habari|mambo|jambo) (?:mama|baba|bibi|babu)\\b|\\b(?:mama|baba|bibi|babu),? (?:hii ni|ni mimi)\\b|\\bni mimi (?:mwanao|mtoto wako)\\b',
        '(?:मम्मी|पापा|मां|माँ|दादी|नानी|दादा|नाना|बेटा|बेटी)[,،]? (?:ये|यह|मैं)',
        '(?:مرحبا|اهلا|هلا) (?:ماما|بابا|امي|ابي)|انا (?:ابنك|ابنتك|بنتك)',
        // Or a sudden emergency: an accident, a hospital, an arrest.
        "\\b(?:i(?:'ve| have)? (?:had an accident|been arrested)|i(?:'m| am) (?:in (?:the )?hospital|at the police station)|tuve un accidente|estoy en el hospital|me (?:detuvieron|arrestaron)|j.ai eu un accident|je suis a l.hopital|j.ai ete arrete|sofri um acidente|estou no hospital|fui pres[oa]|nimepata ajali|niko hospitali|nimekamatwa|mwanangu)\\b",
        'एक्सीडेंट हो गया|दुर्घटना हो गई|अस्पताल में हूं|गिरफ्तार हो गया|تعرضت لحادث|انا في المستشفي|تم القبض علي',
      ),
      r(
        "\\b(?:new number|lost my phone|broke my phone|phone (?:is )?(?:broken|lost|stolen)|borrowed (?:a|my friend's) phone|urgent|need (?:money|help)|send (?:me )?money|naya number|phone (?:kho|toot|chori) (?:gaya|ho gaya))\\b",
        '\\b(?:numero nuevo|nuevo numero|perdi (?:mi )?(?:telefono|celular|movil)|se me (?:rompio|cayo) el (?:telefono|celular|movil)|necesito dinero|urgente|nouveau numero|j.ai perdu mon telephone|mon telephone (?:est )?casse|besoin d.argent|virement urgent|numero novo|novo numero|perdi (?:meu|o) (?:celular|telefone)|celular quebrou|preciso de (?:dinheiro|um pix)|namba (?:yangu )?mpya|nimepoteza simu|simu (?:yangu )?(?:imeibiwa|imeharibika|imepotea)|nahitaji pesa|nitumie pesa)\\b',
        'नया नंबर|(?:फोन|मोबाइल) (?:खो|टूट|चोरी)|पैसे चाहिए|पैसे भेज|तुरंत',
        'رقمي الجديد|رقم جديد|(?:ضاع|انكسر|سرق) (?:هاتفي|جوالي|تلفوني)|هاتفي (?:انكسر|ضاع|سرق)|احتاج (?:فلوس|مال|مبلغ)|عاجل|ضروري',
      ),
    ],
    title: 'Claims to be family on a new number',
    explanation:
      'Scammers pretend to be a relative with a new phone who urgently needs money. Call them on the number you already know.',
  },
  {
    id: 'romance-money',
    kind: 'too-good',
    category: 'romance',
    weight: 0.55,
    all: [
      r(
        `\\b(?:stuck|stranded|detained|held) (?:at|in) (?:the )?(?:airport|customs|hospital|border)\\b|\\b(?:need|send|lend) (?:me )?money (?:for|to) (?:(?:my|a|the) )?(?:ticket|flight|visa|customs|hospital|surgery|clearance|to come (?:and )?see you)\\b|\\b(?:soldier|army officer|peacekeeper|oil rig|offshore|un doctor|deployed)\\b${S}{0,60}\\b(?:money|funds|gift card|package)\\b`,
        `\\b(?:atrapad[oa]|retenid[oa]|bloquee?|pres[oa]) (?:en|a|no|na) (?:el |la |l.)?(?:aeropuerto|aduana|hospital|frontera|aeroport|douane|hopital|frontiere|aeroporto|alfandega|fronteira)\\b|\\b(?:dinero|argent|dinheiro) pour? (?:el |le |la |o |a )?(?:boleto|pasaje|vuelo|visa|billet|vol|passagem|voo|visto)\\b|\\b(?:soldado|militar|soldat|militaire|plataforma petrolera|plateforme petroliere)\\b${S}{0,60}\\b(?:dinero|fondos|argent|fonds|dinheiro|carte cadeau|tarjeta de regalo|paquete|colis)\\b|\\bnimekwama (?:uwanja wa ndege|forodha|hospitali|mpakani)\\b|\\bpesa (?:za|ya) (?:tiketi|nauli|visa)\\b`,
        '(?:एयरपोर्ट|कस्टम|अस्पताल) (?:में|पर) फंस|(?:टिकट|वीजा) के लिए पैसे',
        'عالق في (?:المطار|الجمارك|المستشفي)|(?:مال|فلوس|مبلغ) (?:للتذكره|لتذكره|للتاشيره|للجمارك)',
      ),
    ],
    title: 'Someone you met online needs money',
    explanation:
      'Never send money to someone you haven’t met in person, however real the relationship feels.',
  },
  {
    id: 'sextortion',
    kind: 'pressure',
    category: 'sextortion',
    weight: 0.85,
    all: [
      r(
        '\\b(?:video|videos|photos?|pictures?|pics|recording|screenshots?|fotos?|imagenes|grabacion|capturas|images|enregistrement|imagens|gravacao|picha|rekodi)\\b',
        'वीडियो|फोटो|तस्वीरें|रिकॉर्डिंग',
        'فيديو|صور|تسجيل|مقطع',
      ),
      r(
        `\\b(?:(?:share|send|post|upload|leak|forward|viral)\\b${S}{0,40}\\b(?:family|friends|contacts|followers|everyone|online|internet|social media))\\b|\\b(?:or|otherwise|else|unless)\\b${S}{0,40}\\b(?:i|we)(?:'ll| will)\\b${S}{0,20}\\b(?:share|send|post|upload|leak)\\b|\\b(?:viral kar dunga|bhej dunga|share kar dunga)\\b`,
        `\\b(?:compartire|enviare|publicare|subire|difundire|filtrare|enverrai|publierai|partagerai|diffuserai|vou (?:enviar|mandar|publicar|postar|vazar|compartilhar)|nita(?:zi|i|u|vi|li|ya)?(?:sambaza|tuma|weka|posti))\\w*\\b${S}{0,50}\\b(?:familia|amigos|contactos|seguidores|todos|internet|redes|famille|amis|contacts|abonnes|tout le monde|contatos|todo mundo|marafiki|mitandao|kila mtu|mtandaoni)\\b`,
        `(?:भेज दूंगा|भेज दूंगी|वायरल कर दूंगा|डाल दूंगा|शेयर कर दूंगा)|(?:परिवार|दोस्तों|रिश्तेदारों|सबको)${S}{0,30}(?:भेज|वायरल|शेयर)`,
        `(?:سانشر|سارسل|ساشارك|سافضحك)${S}{0,40}(?:عائلتك|اهلك|اصدقائك|جهات الاتصال|الجميع|الانترنت|مواقع التواصل)`,
      ),
    ],
    title: 'Threatens to share private photos or videos',
    explanation:
      'Don’t pay — paying usually leads to more demands. Stop replying, keep the evidence and report it.',
  },
  {
    id: 'voice-clone',
    kind: 'channel-switch',
    category: 'deepfake-voice',
    weight: 0.45,
    all: [
      r(
        `\\b(?:call|called|voice|voice note|audio)\\b${S}{0,50}\\b(?:son|daughter|grandson|granddaughter|mother|father|boss|ceo|manager|brother|sister)\\b`,
        `\\b(?:llamada|voz|audio|appel|voix|message vocal|ligacao|chamada)\\b${S}{0,50}\\b(?:hij[oa]|madre|padre|jefe|herman[oa]|fils|fille|mere|pere|patron|frere|soeur|filh[oa]|mae|pai|chefe|irma|irmao)\\b|\\bsauti ya (?:mwanangu|mama|baba|bosi|kaka|dada)\\b`,
        `(?:आवाज|वॉयस)${S}{0,40}(?:बेटा|बेटी|मां|पिता|बॉस|भाई|बहन)`,
        `(?:مكالمه|صوت|رساله صوتيه)${S}{0,40}(?:ابني|ابنتي|امي|ابي|مديري|اخي|اختي)`,
      ),
      r(
        '\\b(?:urgent|money|accident|arrest(?:ed)?|hospital|bail|kidnap\\w*|transfer|wire|urgente|dinero|accidente|detenid[oa]|fianza|secuestr\\w*|argent|arrete|hopital|caution|enlev\\w*|dinheiro|acidente|fianca|sequestr\\w*|pesa|ajali|amekamatwa|hospitali|dhamana|ametekwa)\\b',
        'तुरंत|पैसे|दुर्घटना|एक्सीडेंट|गिरफ्तार|अस्पताल|जमानत|अपहरण',
        'عاجل|فلوس|حادث|اعتقل|المستشفي|كفاله|خطف',
      ),
    ],
    title: 'An urgent call in a loved one’s voice',
    explanation:
      'Voices can now be copied with AI. Hang up and call back on a number you know, or ask a family code word.',
  },
  {
    id: 'move-to-chat',
    kind: 'channel-switch',
    weight: 0.25,
    all: [
      r(
        `\\b(?:contact|message|text|chat|ping|add|reach|dm|write to|write)\\b${S}{0,25}\\b(?:on|via|through|at) (?:whatsapp|telegram|signal|wechat|line|viber)\\b|\\bt\\.me/|\\bwa\\.me/`,
        `\\b(?:contactame|escribeme|escribenos|agregame|hablame|mensaje|contactez|ecrivez|ajoutez|me chama|chama|fale comigo|mande mensagem|entre em contato|me adiciona|wasiliana|niandikie|tuma ujumbe|niongeze)\\b${S}{0,25}\\b(?:por|en|al|a mi|a nuestro|via|sur|par|no|pelo|kupitia|kwa|kwenye) (?:whatsapp|wasap|wsp|telegram|signal|zap)\\b`,
        `(?:व्हाट्सएप|व्हाट्सऐप|टेलीग्राम) (?:पर|पे) (?:संपर्क|मैसेज|बात|करें)|व्हाट्सएप करें|\\bwhatsapp (?:par|pe) (?:msg|message|contact|baat)\\b`,
        `(?:تواصل|راسلني|راسلنا|اضفني)${S}{0,25}(?:عبر|علي|في) (?:واتساب|الواتساب|تيليجرام|تلغرام)`,
      ),
    ],
    title: 'Moves the conversation to a private chat app',
    explanation:
      'Scammers move you off official platforms to places with less protection and no record.',
  },
  {
    id: 'charity-urgent',
    kind: 'pressure',
    category: 'charity',
    weight: 0.35,
    all: [
      r(
        '\\b(?:donate|donation|contribute|help|dona|donar|donacion|contribuye|ayuda|donnez|faites un don|contribuez|aidez|doe|doar|doacao|contribua|ajude|changia|mchango|toa msaada)\\b',
        'दान|योगदान|मदद करें',
        'تبرع|ساهم|ساعدوا',
      ),
      r(
        '\\b(?:flood|earthquake|disaster|war|orphans?|cancer patient|surgery|relief|inundacion|terremoto|desastre|guerra|huerfanos|cirugia|damnificados|inondation|seisme|catastrophe|guerre|orphelins|sinistres|enchente|orfaos|cirurgia|desabrigados|mafuriko|tetemeko|maafa|vita|yatima|upasuaji)\\b',
        'बाढ|भूकंप|आपदा|युद्ध|अनाथ|कैंसर',
        'فيضان|زلزال|كارثه|حرب|ايتام|يتيم|سرطان',
      ),
      r(
        '\\b(?:upi|gpay|paytm|mpesa|account number|personal account|send (?:to|on)|wallet|numero de cuenta|cuenta personal|nequi|bizum|numero de compte|compte personnel|orange money|wave|mtn money|pix|chave pix|conta pessoal|m-pesa|tigo pesa|airtel money|namba ya akaunti|lipa namba)\\b',
        'यूपीआई|गूगल पे|फोनपे|पेटीएम|खाता संख्या|अकाउंट नंबर',
        'رقم الحساب|حساب شخصي|فودافون كاش|محفظه',
      ),
    ],
    title: 'Urgent donation to a personal account',
    explanation:
      'Give through registered charities’ official websites, never to personal accounts shared in messages.',
  },
  {
    id: 'virus-alert',
    kind: 'pressure',
    category: 'tech-support',
    weight: 0.5,
    all: [
      r(
        `\\b(?:your|this) (?:computer|pc|laptop|phone|device|system|windows|iphone)\\b${S}{0,30}\\b(?:is|has been|was) (?:infected|hacked|compromised|locked|blocked)\\b|\\b(?:virus|malware|trojan|spyware) (?:detected|found|alert)\\b`,
        `\\b(?:tu|su|este|votre|cet|seu|este) (?:computadora|ordenador|pc|telefono|celular|movil|dispositivo|equipo|ordinateur|appareil|smartphone|computador|aparelho)\\b${S}{0,30}\\b(?:esta|ha sido|fue|est|a ete|foi) (?:infectad[oa]|hackead[oa]|bloquead[oa]|comprometid[oa]|infecte|pirate|bloque|compromis)\\b|\\bvirus (?:detectado|encontrado|detecte)\\b|\\b(?:kompyuta|simu) yako\\b${S}{0,30}\\b(?:ina virusi|imedukuliwa|imeambukizwa)\\b|\\bvirusi (?:vimegunduliwa|imegunduliwa)\\b`,
        `(?:आपका|आपके) (?:कंप्यूटर|फोन|मोबाइल|डिवाइस)${S}{0,30}(?:वायरस|हैक|संक्रमित)|वायरस (?:पाया|मिला|डिटेक्ट)|\\b(?:computer|phone|mobile) hack ho gaya\\b`,
        `(?:جهازك|هاتفك|حاسوبك|كمبيوترك|جوالك)${S}{0,30}(?:مصاب|مخترق|تم اختراقه)|تم اكتشاف (?:فيروس|فايروس)`,
      ),
    ],
    title: 'Claims your device has a virus',
    explanation:
      'Real companies don’t message or call you about viruses. Close the page and don’t call the number shown.',
  },
  {
    id: 'delivery-problem',
    kind: 'category',
    category: 'delivery',
    weight: 0.4,
    all: [
      r(
        '\\b(?:parcel|package|shipment|delivery|courier|consignment|order|paquete|envio|pedido|encomienda|colis|livraison|commande|envoi|encomenda|pacote|remessa|kifurushi|mzigo)\\b',
        'पार्सल|पैकेज|कूरियर|डिलीवरी',
        'طرد|شحن|توصيل',
      ),
      r(
        "\\b(?:could not be delivered|couldn't be delivered|unable to deliver|failed (?:delivery|attempt)|on hold|held (?:at|by) customs|pending|incomplete (?:address|details)|address (?:is )?(?:incomplete|incorrect|invalid)|redeliver\\w*|reschedule|ruk(?:a|i) hu(?:a|i)|atka hua)\\b",
        '\\b(?:retenid[oa]|en espera|no (?:pudo ser entregad[oa]|se pudo entregar)|direccion incompleta|sera devuelt[oa]|en attente|n.a pas pu etre livre|adresse incomplete|retenue?|sera renvoyee?|bloquee? en douane|retid[oa]|aguardando|nao (?:foi|pode ser) entregue|endereco incompleto|sera devolvid[oa]|haikufika|haukufika|anwani (?:si sahihi|haijakamilika|isiyo kamili)|kitarudishwa|itarudishwa|(?:programa|reprograma|agenda) (?:una )?(?:nueva )?entrega|pendiente de pago|aguardando pagamento|en attente de paiement|reagende (?:a )?entrega|reprogrammez (?:la )?livraison)\\b|zuiliwa',
        'रुका हुआ|रोका गया|डिलीवर नहीं|पता अधूरा|वापस भेज|होल्ड पर',
        'محتجز|معلق|تعذر (?:التوصيل|تسليم)|لم يتم (?:التوصيل|تسليم)|العنوان غير (?:مكتمل|صحيح)|سيعاد|في انتظار (?:التسليم|الدفع)|بانتظار (?:التسليم|الدفع)',
      ),
    ],
    title: 'Says a delivery failed or is on hold',
    explanation:
      'Fake delivery messages lead to payment pages. Check deliveries in the courier’s official app or website.',
  },
];

/** Combinations that are far more telling together than apart. */
export const SHIELD_COMBOS: Array<{
  id: string;
  requires: string[];
  weight: number;
  category?: ScamCategory;
  title: string;
  explanation: string;
}> = [
  {
    id: 'combo-authority-secrecy',
    requires: ['agency-parcel', 'secrecy'],
    weight: 0.85,
    category: 'digital-arrest',
    title: 'Official-sounding threat plus secrecy',
    explanation:
      'This matches the “digital arrest” pattern: a fake officer, a scary accusation and orders to tell no one.',
  },
  {
    id: 'combo-credentials-link',
    requires: ['click-to-verify', 'threat'],
    weight: 0.6,
    category: 'phishing-link',
    title: 'A threat plus a link to fix it',
    explanation: 'Scare first, link second is the most common phishing recipe.',
  },
  {
    id: 'combo-delivery-link',
    requires: ['delivery-problem', 'link'],
    weight: 0.5,
    category: 'delivery',
    title: 'A delivery problem with a link to sort it out',
    explanation:
      'Couriers rarely text a link to pay or fix your address. Check the parcel in the courier’s official app or website instead.',
  },
  {
    id: 'combo-job-chat',
    requires: ['earn-per-day', 'move-to-chat'],
    weight: 0.55,
    category: 'job',
    title: 'Easy money offered over a chat app',
    explanation:
      'Unsolicited job offers with daily pay over WhatsApp or Telegram are almost always task scams.',
  },
];
