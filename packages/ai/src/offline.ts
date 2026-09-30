/**
 * Guided mode: what Ask says when no AI model is available (none configured, budget used up,
 * or the person has not allowed external AI and no local model runs). It is honest about the
 * mode, still checks scams with the rules engine, and points to the right module.
 */
import { checkMessage, foldText, LOCALES, type Locale, type RiskLevel } from '@waypoint/core';
import type { CallerContext } from './features';
import { judgeBarredByCrisis, judgeReads, runJudge } from './judge';
import { type GuidedIntent, INTENT_CHOICE, readIntent } from './judge-checks';

const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** The same list the judge chooses from, so the two can never drift apart. */
type Intent = GuidedIntent;

interface Copy {
  intro: string;
  menu: string[];
  scam: string;
  verdict: Record<RiskLevel, string>;
  signs: string;
  work: string;
  money: string;
  feelings: string;
  civic: string;
  links: {
    plan: string;
    checklist: string;
    money: string;
    civic: string;
    support: string;
    shield: string;
  };
}

const COPY: Record<string, Copy> = {
  en: {
    intro: 'I’m in guided mode right now, so my answers are simpler. Here’s where I can help:',
    menu: [
      'Shield: check a message for scams',
      'Path: plan your next job',
      'Money: see how long your money lasts',
      'Get help now: helplines and emergency numbers',
    ],
    scam: 'I checked it with Shield’s rules: {verdict}.',
    verdict: {
      low: 'no common scam signs found',
      unclear: 'some warning signs — be careful',
      high: 'high risk — this looks like a scam',
      'very-high': 'very high risk — this is very likely a scam',
    },
    signs: 'What I noticed:',
    work: 'Let’s make a plan. In Path you can pick a role, see which skills you already have, and get a week-by-week plan with free courses.',
    money:
      'Money can show how long your savings last and what to do first. It takes about two minutes.',
    feelings:
      'That sounds hard. You don’t have to handle it alone. If you’d like to talk to a person, the “Get help now” page lists free helplines in your country.',
    civic:
      'Services has step-by-step checklists for big life events, like losing a job, moving country or having a baby.',
    links: {
      plan: 'Make a plan',
      checklist: 'Job-loss checklist',
      money: 'Check your money runway',
      civic: 'Life-event checklists',
      support: 'Get help now',
      shield: 'Open Scam Shield',
    },
  },
  hi: {
    intro: 'अभी मैं सरल मोड में हूँ, इसलिए मेरे जवाब छोटे होंगे। मैं यहाँ मदद कर सकता हूँ:',
    menu: [
      'शील्ड: किसी संदेश में धोखे की जाँच',
      'राह: अगली नौकरी की योजना',
      'पैसा: पैसे कितने समय चलेंगे',
      'अभी मदद पाएँ: हेल्पलाइन और आपातकालीन नंबर',
    ],
    scam: 'मैंने शील्ड के नियमों से जाँचा: {verdict}।',
    verdict: {
      low: 'धोखे के आम संकेत नहीं मिले',
      unclear: 'कुछ चेतावनी संकेत हैं — सावधान रहें',
      high: 'जोखिम ज़्यादा है — यह धोखा लगता है',
      'very-high': 'जोखिम बहुत ज़्यादा है — यह लगभग निश्चित रूप से धोखा है',
    },
    signs: 'मैंने यह देखा:',
    work: 'आइए योजना बनाएँ। राह में आप कोई भूमिका चुन सकते हैं, देख सकते हैं कि कौन-से कौशल आपके पास पहले से हैं, और मुफ़्त कोर्स के साथ हफ़्ते-दर-हफ़्ते योजना पा सकते हैं।',
    money: '“पैसा” बताता है कि आपकी बचत कितने समय चलेगी और पहले क्या करना चाहिए। इसमें लगभग दो मिनट लगते हैं।',
    feelings:
      'यह मुश्किल लगता है। आपको अकेले इसका सामना नहीं करना है। अगर आप किसी व्यक्ति से बात करना चाहें, तो “अभी मदद पाएँ” पेज पर आपके देश की मुफ़्त हेल्पलाइन हैं।',
    civic:
      'सेवाएँ में जीवन की बड़ी घटनाओं के लिए कदम-दर-कदम सूचियाँ हैं, जैसे नौकरी जाना, दूसरे देश जाना या बच्चे का जन्म।',
    links: {
      plan: 'योजना बनाएँ',
      checklist: 'नौकरी जाने पर चेकलिस्ट',
      money: 'पैसे कितने दिन चलेंगे, देखें',
      civic: 'जीवन की घटनाओं की चेकलिस्ट',
      support: 'अभी मदद पाएँ',
      shield: 'स्कैम शील्ड खोलें',
    },
  },
  es: {
    intro:
      'Ahora estoy en modo guiado, así que mis respuestas son más sencillas. Puedo ayudarte con esto:',
    menu: [
      'Escudo: revisar si un mensaje es una estafa',
      'Camino: planear tu próximo empleo',
      'Dinero: ver cuánto te dura el dinero',
      'Pedir ayuda ahora: líneas de apoyo y emergencias',
    ],
    scam: 'Lo revisé con las reglas del Escudo: {verdict}.',
    verdict: {
      low: 'no encontré señales comunes de estafa',
      unclear: 'hay algunas señales de alerta: ten cuidado',
      high: 'riesgo alto: parece una estafa',
      'very-high': 'riesgo muy alto: casi seguro es una estafa',
    },
    signs: 'Lo que noté:',
    work: 'Hagamos un plan. En Camino puedes elegir un puesto, ver qué habilidades ya tienes y recibir un plan semana a semana con cursos gratuitos.',
    money:
      'Dinero te muestra cuánto te duran los ahorros y qué hacer primero. Toma unos dos minutos.',
    feelings:
      'Suena difícil. No tienes que enfrentarlo solo. Si quieres hablar con una persona, la página «Pedir ayuda ahora» tiene líneas de ayuda gratuitas en tu país.',
    civic:
      'Servicios tiene listas paso a paso para grandes momentos de la vida, como perder el empleo, mudarte de país o tener un bebé.',
    links: {
      plan: 'Hacer un plan',
      checklist: 'Lista para quien perdió el empleo',
      money: 'Ver cuánto te dura el dinero',
      civic: 'Listas para momentos de la vida',
      support: 'Pedir ayuda ahora',
      shield: 'Abrir el Escudo antiestafas',
    },
  },
  fr: {
    intro:
      'Je suis en mode guidé pour le moment, mes réponses sont donc plus simples. Je peux vous aider ici :',
    menu: [
      'Bouclier : vérifier si un message est une arnaque',
      'Parcours : préparer votre prochain emploi',
      'Argent : voir combien de temps durera votre argent',
      'Obtenir de l’aide : lignes d’écoute et urgences',
    ],
    scam: 'Je l’ai vérifié avec les règles du Bouclier : {verdict}.',
    verdict: {
      low: 'aucun signe d’arnaque courant',
      unclear: 'quelques signaux d’alerte : soyez prudent',
      high: 'risque élevé : cela ressemble à une arnaque',
      'very-high': 'risque très élevé : c’est très probablement une arnaque',
    },
    signs: 'Ce que j’ai remarqué :',
    work: 'Faisons un plan. Dans Parcours, vous pouvez choisir un métier, voir les compétences que vous avez déjà et obtenir un plan semaine par semaine avec des cours gratuits.',
    money:
      'La rubrique Argent vous montre combien de temps vos économies peuvent durer et par quoi commencer. Cela prend environ deux minutes.',
    feelings:
      'Cela semble difficile. Vous n’avez pas à affronter cela seul. Si vous voulez parler à quelqu’un, la page « Obtenir de l’aide » indique des lignes d’écoute gratuites dans votre pays.',
    civic:
      'Services propose des listes étape par étape pour les grands moments de la vie : perte d’emploi, départ à l’étranger, naissance d’un enfant…',
    links: {
      plan: 'Faire un plan',
      checklist: 'Liste après une perte d’emploi',
      money: 'Voir combien de temps durera votre argent',
      civic: 'Listes pour les grands moments de la vie',
      support: 'Obtenir de l’aide maintenant',
      shield: 'Ouvrir le Bouclier anti-arnaque',
    },
  },
  pt: {
    intro:
      'No momento estou no modo guiado, então minhas respostas são mais simples. Posso ajudar com isto:',
    menu: [
      'Escudo: verificar se uma mensagem é golpe',
      'Caminho: planejar seu próximo trabalho',
      'Dinheiro: ver quanto tempo seu dinheiro dura',
      'Pedir ajuda agora: linhas de apoio e emergência',
    ],
    scam: 'Verifiquei com as regras do Escudo: {verdict}.',
    verdict: {
      low: 'não encontrei sinais comuns de golpe',
      unclear: 'há alguns sinais de alerta — tenha cuidado',
      high: 'risco alto — parece golpe',
      'very-high': 'risco muito alto — é quase certamente golpe',
    },
    signs: 'O que eu notei:',
    work: 'Vamos fazer um plano. No Caminho você escolhe uma profissão, vê quais habilidades já tem e recebe um plano semana a semana com cursos gratuitos.',
    money:
      'A seção Dinheiro mostra quanto tempo suas economias duram e o que fazer primeiro. Leva cerca de dois minutos.',
    feelings:
      'Parece difícil. Você não precisa enfrentar isso sozinho. Se quiser falar com uma pessoa, a página “Pedir ajuda agora” tem linhas de apoio gratuitas no seu país.',
    civic:
      'Em Serviços há listas passo a passo para grandes momentos da vida, como perder o emprego, mudar de país ou ter um bebê.',
    links: {
      plan: 'Fazer um plano',
      checklist: 'Lista para quem perdeu o emprego',
      money: 'Ver quanto tempo o dinheiro dura',
      civic: 'Listas para momentos da vida',
      support: 'Pedir ajuda agora',
      shield: 'Abrir o Escudo contra golpes',
    },
  },
  ar: {
    intro: 'أنا الآن في الوضع الموجَّه، لذلك ستكون إجاباتي أبسط. يمكنني مساعدتك في:',
    menu: [
      'الدرع: فحص رسالة للتأكد من أنها ليست احتيالًا',
      'المسار: التخطيط لعملك القادم',
      'المال: معرفة كم سيكفيك مالك',
      'احصل على المساعدة الآن: خطوط الدعم والطوارئ',
    ],
    scam: 'فحصتُها بقواعد الدرع: {verdict}.',
    verdict: {
      low: 'لم أجد علامات احتيال شائعة',
      unclear: 'هناك بعض علامات التحذير — كن حذرًا',
      high: 'الخطر مرتفع — يبدو أنه احتيال',
      'very-high': 'الخطر مرتفع جدًا — هذا احتيال على الأرجح',
    },
    signs: 'ما لاحظته:',
    work: 'لنضع خطة. في المسار يمكنك اختيار وظيفة، ومعرفة المهارات التي لديك بالفعل، والحصول على خطة أسبوعية مع دورات مجانية.',
    money: 'يوضح قسم المال كم ستكفيك مدخراتك وما الذي تفعله أولًا. يستغرق ذلك نحو دقيقتين.',
    feelings:
      'يبدو هذا صعبًا. لستَ مضطرًا لمواجهته وحدك. إذا أردت التحدث إلى شخص، ففي صفحة «احصل على المساعدة الآن» خطوط دعم مجانية في بلدك.',
    civic:
      'في الخدمات قوائم خطوة بخطوة للأحداث الكبيرة في الحياة، مثل فقدان العمل أو الانتقال إلى بلد آخر أو ولادة طفل.',
    links: {
      plan: 'ضع خطة',
      checklist: 'قائمة خطوات بعد فقدان العمل',
      money: 'اعرف كم سيكفيك مالك',
      civic: 'قوائم لأحداث الحياة',
      support: 'احصل على المساعدة الآن',
      shield: 'افتح درع الاحتيال',
    },
  },
  sw: {
    intro:
      'Kwa sasa niko katika hali ya mwongozo, kwa hiyo majibu yangu ni mafupi zaidi. Ninaweza kusaidia hapa:',
    menu: [
      'Ngao: kukagua kama ujumbe ni ulaghai',
      'Njia: kupanga kazi yako inayofuata',
      'Pesa: kuona akiba yako itadumu kwa muda gani',
      'Pata msaada sasa: nambari za msaada na za dharura',
    ],
    scam: 'Nimeukagua kwa kanuni za Ngao: {verdict}.',
    verdict: {
      low: 'sikupata dalili za kawaida za ulaghai',
      unclear: 'kuna dalili kadhaa za tahadhari — kuwa mwangalifu',
      high: 'hatari ni kubwa — inaonekana kuwa ulaghai',
      'very-high': 'hatari ni kubwa sana — karibu hakika ni ulaghai',
    },
    signs: 'Nilichoona:',
    work: 'Tupange mpango. Katika Njia unaweza kuchagua kazi, kuona ujuzi ulio nao tayari, na kupata mpango wa wiki kwa wiki pamoja na kozi za bure.',
    money:
      'Sehemu ya Pesa inaonyesha akiba yako itadumu kwa muda gani na nini cha kufanya kwanza. Inachukua kama dakika mbili.',
    feelings:
      'Hilo linaonekana gumu. Si lazima ukabiliane nalo peke yako. Ukitaka kuzungumza na mtu, ukurasa wa “Pata msaada sasa” una nambari za msaada za bure katika nchi yako.',
    civic:
      'Huduma ina orodha za hatua kwa hatua kwa matukio makubwa maishani, kama kupoteza kazi, kuhamia nchi nyingine au kupata mtoto.',
    links: {
      plan: 'Tengeneza mpango',
      checklist: 'Orodha ya hatua baada ya kupoteza kazi',
      money: 'Angalia pesa zako zitadumu muda gani',
      civic: 'Orodha za matukio ya maisha',
      support: 'Pata msaada sasa',
      shield: 'Fungua Ngao ya Ulaghai',
    },
  },
};

/** Folded keywords (no accents) across Waypoint's languages. */
const KEYWORDS: Record<Exclude<Intent, 'general' | 'feelings'>, string[]> = {
  scam: [
    'scam',
    'fraud',
    'fake',
    'legit',
    'is this real',
    'otp',
    'phishing',
    'estafa',
    'fraude',
    'enganar',
    'arnaque',
    'escroquerie',
    'golpe',
    'falso',
    'dhoka',
    'धोखा',
    'ठगी',
    'ulaghai',
    'utapeli',
    'احتيال',
    'نصب',
  ],
  work: [
    'job',
    'work',
    'career',
    'hired',
    'interview',
    'cv',
    'resume',
    'skill',
    'empleo',
    'trabajo',
    'emploi',
    'travail',
    'emprego',
    'trabalho',
    'naukri',
    'नौकरी',
    'काम',
    'kazi',
    'ajira',
    'عمل',
    'وظيفة',
  ],
  money: [
    'money',
    'debt',
    'loan',
    'rent',
    'bill',
    'savings',
    'budget',
    'dinero',
    'deuda',
    'argent',
    'dette',
    'dinheiro',
    'divida',
    'paisa',
    'पैसा',
    'कर्ज',
    'pesa',
    'deni',
    'مال',
    'دين',
  ],
  civic: [
    'passport',
    'visa',
    'benefit',
    'pension',
    'certificate',
    'register',
    'government',
    'tramite',
    'demarche',
    'beneficio',
    'पेंशन',
    'योजना',
    'serikali',
    'حكومة',
  ],
};

const URLISH =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|in|co|ke|ng|br|info|xyz|top|link|click)\b)/i;

/** The keyword path: no AI, every language, always available. */
export function detectIntent(text: string, crisisTier: number, country?: string | null): Intent {
  if (crisisTier >= 1) return 'feelings';
  const f = foldText(text);
  if (URLISH.test(text) || KEYWORDS.scam.some((k) => f.includes(foldText(k)))) return 'scam';
  // A pasted scam rarely says "scam": if the rules engine is confident, answer as Shield would.
  const risk = checkMessage({ text, country: country ?? undefined }).level;
  if (risk === 'high' || risk === 'very-high') return 'scam';
  for (const intent of ['work', 'money', 'civic'] as const) {
    if (KEYWORDS[intent].some((k) => f.includes(foldText(k)))) return intent;
  }
  return 'general';
}

/** Shorter than this a message is a greeting, not a question: the menu is the right answer. */
const JUDGE_MIN_WORDS = 3;

/**
 * What a message in guided mode is about. The keywords decide, exactly as before; only when
 * they find nothing ("general") is the judge asked to pick among the same intents, with
 * "general" as its none-of-these, and only a pick that is well ahead is used (INTENT_JUDGE).
 *
 * Guided mode works without any AI and still does: with no judge, no consent, a language
 * that is not switched on, a spent budget or a failure, this is the keyword path and nothing
 * else. Someone in distress (crisis tier 1 or more) is answered by the rules before this
 * point, so the judge is never asked about them.
 */
export async function guidedIntent(
  ctx: CallerContext & { locale: string; signal?: AbortSignal },
  text: string,
  opts: { crisisTier: number; country?: string | null },
): Promise<Intent> {
  const byKeywords = detectIntent(text, opts.crisisTier, opts.country);
  if (byKeywords !== 'general') return byKeywords;
  const message = text.trim().slice(0, 1500);
  if (message.split(/\s+/).length < JUDGE_MIN_WORDS) return 'general';
  if (judgeBarredByCrisis(message) || !judgeReads(message, ctx.locale)) return 'general';
  const out = await runJudge(
    {
      db: ctx.db,
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      allowExternal: ctx.allowExternal,
      locale: ctx.locale,
      feature: 'judge-intent',
      signal: ctx.signal,
    },
    { message },
    INTENT_CHOICE,
  );
  return out.ok ? (readIntent(out.answers) ?? 'general') : 'general';
}

const MENU_LINKS = ['/shield', '/path', '/money', '/support'];
const link = (label: string, href: string) => `[${label}](${href})`;

/**
 * A guided-mode reply for one message (Markdown, with in-app links). `intent` is what
 * `guidedIntent` found, when the caller asked it; otherwise the keywords decide here.
 */
export function offlineReply(
  text: string,
  opts: { locale: string; country?: string | null; crisisTier?: number; intent?: Intent },
): string {
  const c = COPY[opts.locale] ?? COPY.en!;
  const intent = opts.intent ?? detectIntent(text, opts.crisisTier ?? 0, opts.country);
  switch (intent) {
    case 'scam': {
      const r = checkMessage({
        text,
        country: opts.country ?? undefined,
        locale: isLocale(opts.locale) ? opts.locale : 'en',
      });
      const lines = [c.scam.replace('{verdict}', c.verdict[r.level])];
      // Warning signs and advice come back already translated by the Shield engine.
      const signs = r.signals.slice(0, 3).map((s) => `- ${s.title}`);
      if (signs.length) lines.push(c.signs, ...signs);
      lines.push('', ...r.advice.slice(0, 2));
      lines.push('', link(c.links.shield, '/shield'));
      return lines.join('\n');
    }
    case 'work':
      return [
        c.work,
        '',
        `- ${link(c.links.plan, '/path/new')}`,
        `- ${link(c.links.checklist, '/civic/job-loss')}`,
      ].join('\n');
    case 'money':
      return [c.money, '', link(c.links.money, '/money')].join('\n');
    case 'civic':
      return [c.civic, '', link(c.links.civic, '/civic')].join('\n');
    case 'feelings':
      return [c.feelings, '', link(c.links.support, '/support')].join('\n');
    default:
      return [c.intro, ...c.menu.map((m, i) => `- ${link(m, MENU_LINKS[i] ?? '/')}`)].join('\n');
  }
}
