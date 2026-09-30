/**
 * Crisis lexicon — deterministic patterns that run BEFORE any AI model sees a message.
 *
 * Design rules:
 * - Recall first: missing someone in danger is far worse than showing support to someone
 *   who didn't need it. False positives get a gentle, low-key response (tier 1).
 * - Patterns run on folded text (lower-case, Latin diacritics removed, Arabic normalised).
 * - First-person statements drive tiers; third-person statements set `aboutOther`.
 * - Translations of patterns beyond English need native-speaker and clinical review
 *   (tracked in docs/SAFETY.md). They are deliberately conservative.
 *
 * Tiers: 1 distress · 2 self-harm / suicidal thoughts / abuse · 3 imminent danger or medical emergency.
 */
import { foldPattern } from '../text/normalize';
import type { CrisisCategory, CrisisTier } from '../types';

export const CRISIS_RULES_VERSION = '2026.09.1';

export interface CrisisRule {
  id: string;
  lang: string;
  category: CrisisCategory;
  tier: CrisisTier;
  re: RegExp;
  /** The statement is about someone else (friend, child, partner). */
  other?: boolean;
  /** Matches a plan, means or timeline cue. Escalates ideation to tier 3 when both appear. */
  escalator?: boolean;
  /** The pattern itself contains a negation ("don't want to live"), so negation must not cancel it. */
  noNeg?: boolean;
}

// Patterns are folded like the text they run on (see foldText), so they keep natural spelling.
const L = (src: string) => new RegExp(`\\b(?:${foldPattern(src)})\\b`, 'u'); // Latin-script patterns
const U = (src: string) => new RegExp(`(?:${foldPattern(src)})`, 'u'); // other scripts: substring match

const RELATION_EN =
  '(?:my|our) (?:best )?(?:friend|son|daughter|kid|child|teen|mom|mum|mother|dad|father|brother|sister|wife|husband|partner|boyfriend|girlfriend|colleague|coworker|student|roommate|cousin|nephew|niece|grandson|granddaughter)';

export const CRISIS_RULES: CrisisRule[] = [
  // ─────────────── English: suicidal ideation ───────────────
  {
    id: 'en.kill-self',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      '(?:kill|killing|hang|hanging|shoot|shooting|drown|poison|off|end|ending) (?:my ?self|meself)',
    ),
  },
  {
    id: 'en.want-die',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:i|i'm|im|i am)\\b[^.!?\\n]{0,25}\\b(?:want|wanna|wish|would like|need|going|gonna|ready|planning|plan|trying|deserve) to (?:die|be dead|not exist|not be alive|disappear forever)",
    ),
  },
  {
    id: 'en.want-die-short',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L('(?:want|wanna) (?:to )?die'),
  },
  {
    id: 'en.end-life',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L('(?:end|ending|take|taking) (?:it all|my (?:own )?life|everything now|my life now)'),
  },
  {
    id: 'en.suicidal-self',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:i'm|im|i am|feeling|feel|i feel|been) (?:so |very |really |kind of |a bit )?suicidal|suicidal (?:thoughts|feelings|ideation)|thoughts? (?:of|about) (?:suicide|killing myself|ending (?:it|my life))|commit(?:ting)? suicide",
    ),
  },
  {
    id: 'en.better-off',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:better off|be better) (?:dead|without me|if i (?:was|were|wasn't|weren't) (?:gone|dead|here|around|alive))",
    ),
  },
  {
    id: 'en.rather-dead',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L("(?:i'd|i would|id) rather (?:be dead|die|not exist|not be alive|not wake up)"),
  },
  {
    id: 'en.no-reason-live',
    noNeg: true,
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      'no (?:reason|point|purpose) (?:to|in) (?:live|living|go on|going on|being alive|be alive|keep going)',
    ),
  },
  {
    id: 'en.dont-want-live',
    noNeg: true,
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:don't|dont|do not|no longer) want to (?:live|be alive|exist|wake up|be here)(?: anymore)?",
    ),
  },
  {
    id: 'en.wish-dead',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "wish (?:i|i'd) (?:was|were|had been) (?:dead|never born|gone)|wish i could (?:disappear|die|stop existing)",
    ),
  },
  {
    id: 'en.never-wake',
    noNeg: true,
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:go to )?sleep and (?:never|not) wake up|so (?:that )?i (?:never|don't|do not|won't|will not) wake up|never wake up again",
    ),
  },
  {
    id: 'en.take-all',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 2,
    re: L(
      "(?:going to|gonna|will|i'll|want to|wanna|about to|plan to|planning to|i'm going to|im going to|ready to) (?:take|swallow|down) (?:them all|all of them|all (?:of )?(?:my |the |these |those )?(?:pills|tablets|meds|medication|medicine|sleeping pills|painkillers)|(?:the|a|my) whole (?:bottle|pack|packet|strip|box)(?: of (?:pills|tablets|meds))?)",
    ),
  },
  {
    id: 'en.end-it',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      '(?:want|wanna|going|gonna|ready|planning|plan|decided|need|have) to end it(?: all)?(?! with)|(?:pills|tablets|rope|gun|poison|pesticide|blade) to end it',
    ),
  },
  {
    id: 'en.not-here',
    noNeg: true,
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "won't be (?:here|around|alive) (?:anymore|tomorrow|much longer)|not be (?:here|around) tomorrow",
    ),
  },
  {
    id: 'en.past-attempt',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:i|i've|i have) (?:tried|attempted) (?:to kill myself|suicide|to end my life|to end it)",
    ),
  },
  {
    id: 'en.suicide-mention',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 1,
    re: L('suicide|suicidal'),
  },
  // English: plan / means / timeline (escalators) and direct imminent statements
  {
    id: 'en.took-pills',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      "(?:i've|i have|i just|i) (?:taken|took|swallowed) (?:\\d+|all(?: (?:my|the|of my))?|a (?:lot|bunch|handful|whole bottle|whole pack|whole strip) of|too many|loads of|my whole|double|triple) ?(?:pills|tablets|meds|medication|medicine|sleeping pills|painkillers|paracetamol|tylenol|dose)",
    ),
  },
  {
    id: 'en.took-poison',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      "(?:i've|i have|i just|i) (?:drank|drunk|swallowed|took|taken|ate|had) (?:some |the |a bottle of |a cup of |a glass of )?(?:bleach|poison|rat poison|pesticide|insecticide|weed ?killer|kerosene|antifreeze)",
    ),
  },
  {
    id: 'en.at-edge',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      "(?:i'm|im|i am) (?:standing |sitting )?(?:on|at) (?:the )?(?:edge|bridge|roof|rooftop|ledge|railway|train tracks|tracks|cliff)",
    ),
  },
  {
    id: 'en.note',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      'suicide note|goodbye (?:note|letter)|wrote (?:a|my) (?:last )?(?:note|letter) to (?:my family|everyone)|this is (?:my )?goodbye|goodbye forever',
    ),
  },
  {
    id: 'en.about-to',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      "(?:going to|gonna|about to|will|i'll|im going to|i'm going to) (?:jump off|jump from|hang myself|shoot myself|overdose|slit my|cut my wrists|drink (?:the )?(?:poison|bleach|pesticide))",
    ),
  },
  {
    id: 'en.have-plan',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 2,
    escalator: true,
    re: L(
      '(?:have|made|got|with) a plan|(?:bought|got|have|found) (?:a |the )?(?:rope|noose|gun|pistol|pills|poison|pesticide|blade|razor)|gave away my (?:things|stuff|belongings)',
    ),
  },
  {
    id: 'en.timeline',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L(
      'tonight|right now|this (?:evening|weekend)|in (?:an|one|a few) hours?|today is the day|tonight is the night|before (?:morning|tomorrow)',
    ),
  },
  {
    id: 'en.means',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L('pills|overdose|rope|noose|hang|gun|jump|bridge|pesticide|bleach|blade|wrists|train'),
  },

  // English: self-harm
  {
    id: 'en.self-harm',
    lang: 'en',
    category: 'self-harm',
    tier: 2,
    re: L(
      '(?:cut|cutting|burn|burning|hurt|hurting|harm|harming|scratch|scratching|punish|punishing|starve|starving) (?:my ?self|myself)(?! (?:by accident|accidentally|(?:while|when) (?:cooking|shaving|chopping|playing|working|ironing|making|cleaning|gardening|running|fixing)|cooking|shaving|chopping|playing|at work|in the kitchen|on the (?:stove|oven|iron|knife|glass)))',
    ),
  },
  {
    id: 'en.self-harm-noun',
    lang: 'en',
    category: 'self-harm',
    tier: 2,
    re: L(
      "(?:i|i've|i have|been|started|stop|urge to|urges to) [^.!?\\n]{0,20}self[- ]?harm(?:ing)?|self[- ]?harm(?:ing)? again",
    ),
  },
  {
    id: 'en.self-harm-mention',
    lang: 'en',
    category: 'self-harm',
    tier: 1,
    re: L('self[- ]?harm(?:ing)?'),
  },
  {
    id: 'en.bleeding',
    lang: 'en',
    category: 'medical-emergency',
    tier: 3,
    re: L(
      "(?:bleeding (?:a lot|badly|heavily|everywhere)|won't stop bleeding|can't stop (?:the )?bleeding|cut too deep|deep cut)",
    ),
  },

  // English: abuse & violence
  {
    id: 'en.abuse',
    lang: 'en',
    category: 'abuse',
    tier: 2,
    re: L(
      '(?:he|she|they|my (?:husband|wife|partner|boyfriend|girlfriend|father|dad|mother|mom|mum|brother|uncle|stepfather|stepdad|boss|landlord|employer|in-laws?)) (?:hits|beats|hurts|chokes|strangles|kicks|slaps|punches|rapes|abuses|threatens|locks) me(?! (?:at|in|to|by|up|out|with (?:a|his|her|their) (?:question|message|text|call|joke)))',
    ),
  },
  {
    id: 'en.threat-kill',
    lang: 'en',
    category: 'violence-risk',
    tier: 2,
    re: L(
      "(?:going to|gonna|will|wants to|want to|threatened to|threatens to|said (?:he|she|they)(?:'d| would| will)) kill me",
    ),
  },
  {
    id: 'en.fear-life',
    lang: 'en',
    category: 'violence-risk',
    tier: 2,
    re: L(
      '(?:scared|afraid|fear|terrified) (?:for|of losing) my (?:life|safety)|not safe at home|afraid to go home',
    ),
  },
  {
    id: 'en.assault',
    lang: 'en',
    category: 'abuse',
    tier: 2,
    re: L(
      '(?:was|got|been|being) (?:raped|sexually assaulted|trafficked|molested)|forced me to have sex',
    ),
  },
  {
    id: 'en.imminent-danger',
    lang: 'en',
    category: 'violence-risk',
    tier: 3,
    re: L(
      "(?:he|she|they)(?:'s|'re| is| are) (?:outside|at the door|breaking in|coming (?:for|to get) me|in the house)|(?:has|with) a (?:gun|knife|weapon) (?:and|right now|here)",
    ),
  },
  {
    id: 'en.harm-others',
    lang: 'en',
    category: 'violence-risk',
    tier: 1,
    re: L(
      "(?:i|i'm|im) (?:going to|gonna|want to|will) (?:kill|hurt|stab|shoot) (?:him|her|them|my (?:boss|husband|wife|father|dad|mother|brother|neighbour|neighbor))",
    ),
  },

  // English: medical emergency
  {
    id: 'en.medical',
    lang: 'en',
    category: 'medical-emergency',
    tier: 3,
    re: L(
      "chest pain|pain in my chest|heart attack|(?:can't|cannot|can not|cant) breathe|can't breath|struggling to breathe|not breathing|stopped breathing|is choking|unconscious|won't wake up|having a (?:stroke|seizure)|face is drooping|slurred speech|overdosed|overdosing|swallowed (?:poison|bleach|pesticide)|throat is (?:closing|swelling)|anaphyla(?:xis|ctic)",
    ),
  },

  // English: distress
  {
    id: 'en.distress',
    lang: 'en',
    category: 'distress',
    tier: 1,
    re: L(
      "hopeless|helpless|worthless|(?:no one|nobody) cares|(?:so|all|completely|totally) alone|can't cope|cannot cope|can't take (?:it|this|any of this) any ?more|can't do this any ?more|can't go on|falling apart|breaking down|panic attacks?|overwhelmed|empty inside|numb inside|hate my life|life is pointless|nothing matters|i'm a burden|a burden to (?:everyone|my family)|give up on (?:life|everything)|exhausted (?:with|of) life|crying all (?:day|night)",
    ),
  },

  // English: about someone else
  {
    id: 'en.other-ideation',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: L(
      `${RELATION_EN} (?:wants to|is going to|is gonna|keeps talking about|talks about|is thinking about|tried to|attempted to|threatened to|said (?:he|she|they) (?:wants?|want) to) (?:die|kill (?:himself|herself|themselves)|end (?:his|her|their) life|suicide|commit suicide|hurt (?:himself|herself|themselves))`,
    ),
  },
  {
    id: 'en.other-pronoun',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: L(
      "(?:he|she|they) (?:wants|want|is going|are going|plans|plan) to (?:die|kill (?:himself|herself|themselves)|end (?:his|her|their) life)|(?:he|she|they)(?:'s|'re| is| are) suicidal",
    ),
  },
  {
    id: 'en.other-worried',
    lang: 'en',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: L(
      "(?:worried|scared|afraid|concerned)(?: (?:about|that|for))? (?:my|a|our) [^.!?\\n]{0,30}(?:suicid|kill (?:himself|herself|themselves)|hurt (?:himself|herself|themselves)|self[- ]?harm)|how (?:do i|can i|to) help (?:someone|a friend|my \\w+) (?:who is|who's|that is|thinking about) (?:suicidal|suicide)",
    ),
  },
  {
    id: 'en.other-imminent',
    lang: 'en',
    category: 'suicidal-plan',
    tier: 3,
    other: true,
    re: L(
      `${RELATION_EN} (?:has taken|took|swallowed|is on the (?:roof|bridge|edge)|has a (?:gun|rope|knife)|won't wake up|is unconscious)`,
    ),
  },

  // ─────────────── Hindi (Devanagari) ───────────────
  {
    id: 'hi.want-die',
    noNeg: true,
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 2,
    re: U(
      'मरना चाहत|मर जाना चाहत|मर जाऊं|मर जाऊँ|जीना नहीं चाहत|जीने की (?:कोई )?(?:वजह|इच्छा) नहीं|जीने का (?:कोई )?मतलब नहीं',
    ),
  },
  {
    id: 'hi.suicide',
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 2,
    re: U(
      'आत्महत्या कर|खुदकुशी कर|ख़ुदकुशी कर|खुद को मार|ख़ुद को मार|अपनी जान ले|जान दे दूं|जान दे दूँ|ज़िंदगी खत्म|जिंदगी खत्म|ज़िन्दगी ख़त्म|सब खत्म कर दूं|सब ख़त्म कर दूँ',
    ),
  },
  {
    id: 'hi.suicide-mention',
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 1,
    re: U('आत्महत्या|खुदकुशी|ख़ुदकुशी'),
  },
  {
    id: 'hi.self-harm',
    lang: 'hi',
    category: 'self-harm',
    tier: 2,
    re: U('खुद को चोट|ख़ुद को चोट|खुद को नुकसान|ख़ुद को नुक़सान|हाथ काट'),
  },
  {
    id: 'hi.plan',
    lang: 'hi',
    category: 'suicidal-plan',
    tier: 3,
    re: U(
      'गोलियां खा ली|गोलियाँ खा ली|ज़हर खा लिया|जहर खा लिया|कीटनाशक पी|फांसी लगा|फाँसी लगा|छत से कूद|पुल से कूद',
    ),
  },
  {
    id: 'hi.timeline',
    lang: 'hi',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: U('आज रात|अभी|फांसी|फाँसी|जहर|ज़हर|गोलियां|गोलियाँ|कीटनाशक'),
  },
  {
    id: 'hi.abuse',
    lang: 'hi',
    category: 'abuse',
    tier: 2,
    re: U('मुझे मारता है|मुझे मारती है|मुझे पीटता|मुझे पीटती|जान से मारने की धमकी'),
  },
  {
    id: 'hi.medical',
    lang: 'hi',
    category: 'medical-emergency',
    tier: 3,
    re: U('सीने में दर्द|छाती में दर्द|सांस नहीं ले|साँस नहीं ले|सांस नहीं आ|साँस नहीं आ|बेहोश हो'),
  },
  {
    id: 'hi.distress',
    lang: 'hi',
    category: 'distress',
    tier: 1,
    re: U(
      'बहुत अकेला|बहुत अकेली|कोई उम्मीद नहीं|टूट गया हूं|टूट गई हूं|टूट गया हूँ|टूट गयी हूँ|घबराहट|बर्दाश्त नहीं होता|सहन नहीं होता',
    ),
  },
  {
    id: 'hi.other',
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: U(
      '(?:दोस्त|बेटा|बेटी|भाई|बहन|पति|पत्नी|माँ|मां|पापा|पिता)[^।.!?]{0,25}(?:आत्महत्या|मरना चाहत|खुद को मार)',
    ),
  },

  // ─────────────── Hinglish (Hindi in Latin script) ───────────────
  {
    id: 'hil.want-die',
    noNeg: true,
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      'marna chah(?:ta|ti|te)|mar jaa?na chah(?:ta|ti)|mar jau|mar jaun|jeena nahi chah(?:ta|ti)|jina nahi chah(?:ta|ti)|jeene ka koi (?:matlab|fayda|faida|wajah) nahi',
    ),
  },
  {
    id: 'hil.suicide',
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      'khud ?kushi kar|aatmahatya kar|atmahatya kar|khud ko maar|apni jaan le|zindagi khatam kar|zindagi khatm kar|sab khatam kar (?:du|dun|dunga|dungi|doon)',
    ),
  },
  {
    id: 'hil.suicide-mention',
    lang: 'hi',
    category: 'suicidal-ideation',
    tier: 1,
    re: L('khud ?kushi|aatmahatya|atmahatya'),
  },
  {
    id: 'hil.plan',
    lang: 'hi',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      '(?:neend ki )?goliyan kha li|zeh?e?r kha liya|pesticide pi liya|fa+ns?i laga|phaa?ns?i laga|chhat se kood|pul se kood',
    ),
  },
  {
    id: 'hil.timeline',
    lang: 'hi',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L('aaj raat|abhi|goliyan|zeher|zehar|phaansi|fansi|phansi'),
  },
  {
    id: 'hil.self-harm',
    lang: 'hi',
    category: 'self-harm',
    tier: 2,
    re: L('khud ko (?:chot|nuksan|nuksaan|takleef) (?:pahuncha|pohcha|pahucha|de)|haath kaat'),
  },
  {
    id: 'hil.abuse',
    lang: 'hi',
    category: 'abuse',
    tier: 2,
    re: L('mujhe (?:maarta|marta|peet ?ta|pit ?ta|maarti|marti) hai|jaan se maarne ki dhamki'),
  },
  {
    id: 'hil.distress',
    lang: 'hi',
    category: 'distress',
    tier: 1,
    re: L(
      'bahut akel(?:a|i)|koi (?:umeed|ummeed) nahi|(?:tut|toot) (?:gaya|gayi|gai) hu|ghabrahat|bardaasht nahi',
    ),
  },

  // ─────────────── Spanish ───────────────
  {
    id: 'es.want-die',
    noNeg: true,
    lang: 'es',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      '(?:quiero|quisiera|deseo|necesito) morir(?:me)?|me quiero morir|me gustaria morir|no quiero (?:vivir|seguir viviendo|estar viv[oa]|despertar)(?: mas)?|(?:sin|no hay|no tengo|no le encuentro) (?:razon|motivo|sentido) (?:para|de) vivir',
    ),
  },
  {
    id: 'es.kill-self',
    lang: 'es',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      '(?:quiero|voy a|pienso|pensando en|quisiera) (?:suicidarme|matarme|quitarme la vida)|(?:me )?(?:quiero|voy a) suicidar|suicidarme|matarme|quitarme la vida|acabar con (?:mi vida|todo)|pensamientos suicidas|me siento suicida|estarian mejor sin mi|ojala (?:estuviera|me muriera)',
    ),
  },
  {
    id: 'es.mention',
    lang: 'es',
    category: 'suicidal-ideation',
    tier: 1,
    re: L('suicidio|suicida'),
  },
  {
    id: 'es.plan',
    lang: 'es',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      '(?:tome|me tome|trague) (?:todas las|muchas|un monton de|demasiadas) (?:pastillas|pildoras)|me voy a (?:tirar|lanzar|colgar)|carta de despedida|estoy en (?:el puente|la azotea|el borde)',
    ),
  },
  {
    id: 'es.escalator',
    lang: 'es',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L('esta noche|ahora mismo|hoy mismo|pastillas|cuerda|pistola|veneno|puente'),
  },
  {
    id: 'es.self-harm',
    lang: 'es',
    category: 'self-harm',
    tier: 2,
    re: L(
      '(?:hacerme|me hago|me hice|quiero hacerme) dano|cortarme|me corto|me corte los|autolesion(?:es|arme)?',
    ),
  },
  {
    id: 'es.abuse',
    lang: 'es',
    category: 'abuse',
    tier: 2,
    re: L(
      'me (?:pega|golpea|maltrata|amenaza|viola)|(?:me va a|quiere|amenazo con|dice que va a) matarme|tengo miedo de (?:el|mi (?:pareja|esposo|marido|novio))',
    ),
  },
  {
    id: 'es.medical',
    lang: 'es',
    category: 'medical-emergency',
    tier: 3,
    re: L(
      'dolor (?:en el|de) pecho|no puedo respirar|no respira|inconsciente|convulsion(?:es|ando)?|sobredosis|envenenad[oa]|un infarto',
    ),
  },
  {
    id: 'es.distress',
    lang: 'es',
    category: 'distress',
    tier: 1,
    re: L(
      'sin esperanza|no puedo mas|no aguanto mas|(?:estoy|me siento) (?:muy |tan )?(?:sol[oa])|ataque de (?:panico|ansiedad)|me siento vaci[oa]|soy una carga',
    ),
  },
  {
    id: 'es.other',
    lang: 'es',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: L(
      'mi (?:amig[oa]|hij[oa]|herman[oa]|madre|padre|mama|papa|pareja|espos[oa]|novi[oa]) (?:quiere|va a|dice que quiere|intento) (?:morir|matarse|suicidarse|quitarse la vida)',
    ),
  },

  // ─────────────── French ───────────────
  {
    id: 'fr.want-die',
    noNeg: true,
    lang: 'fr',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      "(?:je veux|j'ai envie de|je voudrais|envie de) mourir|je ne veux plus vivre|je veux en finir|(?:aucune|pas de|plus de) raison de vivre|(?:seraient|serait) mieux sans moi",
    ),
  },
  {
    id: 'fr.kill-self',
    lang: 'fr',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      'me suicider|me tuer|mettre fin a (?:mes jours|ma vie)|pensees suicidaires|idees suicidaires|je suis suicidaire',
    ),
  },
  {
    id: 'fr.mention',
    lang: 'fr',
    category: 'suicidal-ideation',
    tier: 1,
    re: L('suicide|suicidaire'),
  },
  {
    id: 'fr.plan',
    lang: 'fr',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      "(?:j'ai pris|j'ai avale) (?:tous mes|toute la boite de|beaucoup de|trop de) (?:medicaments|cachets|comprimes)|lettre d'adieu|je vais sauter|je suis sur le pont",
    ),
  },
  {
    id: 'fr.escalator',
    lang: 'fr',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L('ce soir|maintenant|cette nuit|medicaments|corde|pistolet|pont'),
  },
  {
    id: 'fr.self-harm',
    lang: 'fr',
    category: 'self-harm',
    tier: 2,
    re: L(
      'me faire du mal|me scarifier|je me scarifie|je me coupe|me couper les veines|automutilation',
    ),
  },
  {
    id: 'fr.abuse',
    lang: 'fr',
    category: 'abuse',
    tier: 2,
    re: L(
      "il me (?:frappe|bat|menace|viole)|(?:va|veut) me tuer|j'ai peur de (?:lui|mon mari|mon compagnon|mon conjoint)",
    ),
  },
  {
    id: 'fr.medical',
    lang: 'fr',
    category: 'medical-emergency',
    tier: 3,
    re: L(
      "douleur (?:a la|dans la) poitrine|(?:je ne peux pas|je n'arrive pas a|n'arrive pas a) respirer|ne respire plus|inconscient|overdose|surdose|convulsions?|crise cardiaque",
    ),
  },
  {
    id: 'fr.distress',
    lang: 'fr',
    category: 'distress',
    tier: 1,
    re: L(
      "sans espoir|je n'en peux plus|je suis (?:tout |toute )?seule?|crise d'angoisse|attaque de panique|je suis un fardeau|je me sens vide",
    ),
  },
  {
    id: 'fr.other',
    lang: 'fr',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: L(
      '(?:mon|ma) (?:ami|amie|fils|fille|frere|soeur|mere|pere|mari|femme|copain|copine) (?:veut|va) (?:mourir|se suicider|se tuer)',
    ),
  },

  // ─────────────── Portuguese ───────────────
  {
    id: 'pt.want-die',
    noNeg: true,
    lang: 'pt',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      '(?:quero|queria|preciso) morrer|nao quero (?:mais )?viver|(?:sem|nao tenho) (?:motivo|razao) (?:para|pra) viver|estariam melhor sem mim',
    ),
  },
  {
    id: 'pt.kill-self',
    lang: 'pt',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      'me matar|me suicidar|tirar (?:a )?minha (?:propria )?vida|acabar com (?:a )?minha vida|pensamentos suicidas|estou suicida',
    ),
  },
  {
    id: 'pt.mention',
    lang: 'pt',
    category: 'suicidal-ideation',
    tier: 1,
    re: L('suicidio|suicida'),
  },
  {
    id: 'pt.plan',
    lang: 'pt',
    category: 'suicidal-plan',
    tier: 3,
    re: L(
      'tomei (?:todos os|varios|muitos|a cartela de) (?:remedios|comprimidos)|vou (?:pular|me jogar|me enforcar)|carta de despedida|estou na (?:ponte|beira)',
    ),
  },
  {
    id: 'pt.escalator',
    lang: 'pt',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L('hoje a noite|agora mesmo|remedios|corda|arma|veneno|ponte'),
  },
  {
    id: 'pt.self-harm',
    lang: 'pt',
    category: 'self-harm',
    tier: 2,
    re: L('me machucar|me cortar|me corto|me cortei|automutila(?:cao|r)'),
  },
  {
    id: 'pt.abuse',
    lang: 'pt',
    category: 'abuse',
    tier: 2,
    re: L(
      '(?:ele|ela|meu marido|meu namorado) me (?:bate|agride|ameaca|estuprou)|vai me matar|tenho medo (?:dele|do meu marido|do meu namorado)',
    ),
  },
  {
    id: 'pt.medical',
    lang: 'pt',
    category: 'medical-emergency',
    tier: 3,
    re: L(
      'dor no peito|nao consigo respirar|nao esta respirando|desmaiad[oa]|inconsciente|overdose|convuls(?:ao|oes|ionando)|envenenad[oa]|infarto',
    ),
  },
  {
    id: 'pt.distress',
    lang: 'pt',
    category: 'distress',
    tier: 1,
    re: L(
      'sem esperanca|nao aguento mais|estou (?:muito |tao )?sozinh[oa]|crise de (?:panico|ansiedade)|sou um peso|me sinto vazi[oa]',
    ),
  },
  {
    id: 'pt.other',
    lang: 'pt',
    category: 'suicidal-ideation',
    tier: 2,
    other: true,
    re: L(
      '(?:meu|minha) (?:amig[oa]|filh[oa]|irma[o]?|mae|pai|marido|esposa|namorad[oa]) (?:quer|vai|tentou) (?:morrer|se matar|se suicidar)',
    ),
  },

  // ─────────────── Arabic (normalised: bare alef, ه for ة, ي for ى) ───────────────
  {
    id: 'ar.want-die',
    noNeg: true,
    lang: 'ar',
    category: 'suicidal-ideation',
    tier: 2,
    re: U('اريد ان اموت|اريد الموت|لا اريد ان اعيش|لا اريد العيش|لا اريد الحياه|ليس لدي سبب للعيش'),
  },
  {
    id: 'ar.kill-self',
    lang: 'ar',
    category: 'suicidal-ideation',
    tier: 2,
    re: U('اقتل نفسي|انهي حياتي|سانتحر|اريد الانتحار|افكر في الانتحار|افكار انتحاريه'),
  },
  {
    id: 'ar.mention',
    lang: 'ar',
    category: 'suicidal-ideation',
    tier: 1,
    re: U('انتحار|الانتحار'),
  },
  {
    id: 'ar.escalator',
    lang: 'ar',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: U('الليله|الان|حبوب|سم|حبل|مسدس'),
  },
  {
    id: 'ar.self-harm',
    lang: 'ar',
    category: 'self-harm',
    tier: 2,
    re: U('اؤذي نفسي|اجرح نفسي|ايذاء النفس'),
  },
  {
    id: 'ar.abuse',
    lang: 'ar',
    category: 'abuse',
    tier: 2,
    re: U('يضربني|تضربني|سيقتلني|يريد قتلي|يهددني بالقتل'),
  },
  {
    id: 'ar.medical',
    lang: 'ar',
    category: 'medical-emergency',
    tier: 3,
    re: U('الم في الصدر|لا استطيع التنفس|لا يتنفس|فاقد الوعي|جرعه زائده'),
  },
  {
    id: 'ar.distress',
    lang: 'ar',
    category: 'distress',
    tier: 1,
    re: U('وحيد جدا|وحيده جدا|لا امل|نوبه هلع|لا اتحمل|فقدت الامل'),
  },

  // ─────────────── Swahili ───────────────
  {
    id: 'sw.want-die',
    noNeg: true,
    lang: 'sw',
    category: 'suicidal-ideation',
    tier: 2,
    re: L(
      '(?:ni)?nataka kufa|ninataka kufa|natamani kufa|sitaki (?:tena )?kuishi|maisha (?:yangu )?hayana maana|kumaliza maisha yangu|nijiue|nitajiua|nataka kujiua|kujiua',
    ),
  },
  {
    id: 'sw.escalator',
    lang: 'sw',
    category: 'suicidal-plan',
    tier: 1,
    escalator: true,
    re: L('usiku huu|leo usiku|sasa hivi|vidonge|sumu|kamba'),
  },
  {
    id: 'sw.plan',
    lang: 'sw',
    category: 'suicidal-plan',
    tier: 3,
    re: L('nimekunywa (?:vidonge|sumu)|nimemeza (?:vidonge|sumu)'),
  },
  {
    id: 'sw.self-harm',
    lang: 'sw',
    category: 'self-harm',
    tier: 2,
    re: L('kujidhuru|kujikata|kujiumiza|najikata'),
  },
  {
    id: 'sw.abuse',
    lang: 'sw',
    category: 'abuse',
    tier: 2,
    re: L('ananipiga|atamniua|ataniua|ananitishia kuniua'),
  },
  {
    id: 'sw.medical',
    lang: 'sw',
    category: 'medical-emergency',
    tier: 3,
    re: L('maumivu ya kifua|siwezi kupumua|hapumui|amezimia'),
  },
  {
    id: 'sw.distress',
    lang: 'sw',
    category: 'distress',
    tier: 1,
    re: L('sina matumaini|niko peke yangu|nimechoka na maisha|nimekata tamaa'),
  },
];

/**
 * Negation cues directly before an ideation phrase ("I would never kill myself",
 * "I'm not suicidal"). Negated ideation is treated as distress (tier 1), never ignored.
 */
export const NEGATION_BEFORE =
  /\b(?:never|not|no|don't|dont|do not|wouldn't|would not|won't|will not|am not|i'm not|im not|isn't|nunca|jamais|nao|nunca|sitawahi|kamwe|kabhi nahi|nahi)\b[^.!?\n]{0,18}$/u;

/** Figurative uses that must never trigger a crisis response. Checked on the matched window. */
/** Words that carry the intent inside a match; negation just before one of these cancels it. */
export const TRIGGER_WORDS =
  /\b(?:want|wanna|wish|would like|need|going|gonna|ready|planning|plan|trying|deserve|kill|killing|end|ending|hurt|hurting|cut|cutting|harm|harming|die|dying|suicid\w*|take my life)\b/gu;

export const NEGATION_NEAR =
  /\b(?:never|not|don't|dont|do not|wouldn't|would not|won't|will not|no longer|am not|i'm not|im not|nunca|jamais|nao)\b/u;

export const IDIOMS =
  /\b(?:killing me(?! (?:softly)?\b(?:inside)?)|kill (?:myself|me) laughing|dying (?:to|for)|to die for|dead (?:tired|battery|line|lines|end)|deadline|killer|kill (?:time|it|the (?:lights|engine|process))|killed it|would kill for|over my dead body|died laughing|drop dead gorgeous|bored to death|scared to death)\b/u;
