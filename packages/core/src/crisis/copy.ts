/**
 * Crisis-response copy. Warm, direct, short sentences, no clinical jargon, no promises we
 * can't keep (we never claim a service is confidential or always answers). English is the
 * source; other languages are reviewed translations-in-progress (see docs/SAFETY.md).
 *
 * Placeholders: {name} = support service name, {emergency} = local emergency number.
 */
import type { Locale } from '../types';

export interface CrisisCopy {
  distress: { headline: string; message: string };
  ideation: { headline: string; message: string; messageNoService: string };
  imminent: { headline: string; message: string; messageNoNumber: string };
  other: { headline: string; message: string; messageNoService: string };
  abuse: { headline: string; message: string; messageNoService: string };
  medical: { headline: string; message: string; messageNoNumber: string };
  actions: {
    emergency: string;
    call: string;
    text: string;
    chat: string;
    directory: string;
    trustedContact: string;
    grounding: string;
    circle: string;
    stay: string;
    talkNow: string;
  };
}

export const CRISIS_COPY: Record<Locale, CrisisCopy> = {
  en: {
    distress: {
      headline: 'That sounds really heavy.',
      message:
        "You don't have to work through this alone. We can slow down together, or you can talk to a person right now.",
    },
    ideation: {
      headline: 'Thank you for telling me.',
      message:
        "It sounds like you might be thinking about hurting yourself or ending your life. You deserve support from a real person right now, and it's okay to reach out. {name} is there for exactly this.",
      messageNoService:
        'It sounds like you might be thinking about hurting yourself or ending your life. You deserve support from a real person right now. The directory below lists free helplines in your country.',
    },
    imminent: {
      headline: 'Your safety matters most right now.',
      message:
        "If you're in danger or have already hurt yourself, call {emergency} now. If you can, move away from anything you could use to hurt yourself, and tell someone nearby that you need them.",
      messageNoNumber:
        "If you're in danger or have already hurt yourself, call your local emergency number now. If you can, move away from anything you could use to hurt yourself, and tell someone nearby that you need them.",
    },
    other: {
      headline: "It's good that you're looking out for them.",
      message:
        "If they're in immediate danger, call {emergency}. You can also contact {name} yourself — they can help you work out how to support them. If you can, stay with them, ask them directly how they're feeling, and listen without judging.",
      messageNoService:
        "If they're in immediate danger, call your local emergency number. If you can, stay with them, ask them directly how they're feeling, and listen without judging. The directory below lists helplines that can guide you.",
    },
    abuse: {
      headline: 'You deserve to be safe.',
      message:
        "If you're in danger right now, call {emergency}. {name} can help you think through next steps safely. If someone checks your phone, use Quick exit to leave Waypoint fast.",
      messageNoService:
        "If you're in danger right now, call your local emergency number. If someone checks your phone, use Quick exit to leave Waypoint fast.",
    },
    medical: {
      headline: 'This could be a medical emergency.',
      message:
        "Call {emergency} now. Waypoint can't check symptoms, and getting help quickly matters.",
      messageNoNumber:
        "Call your local emergency number now. Waypoint can't check symptoms, and getting help quickly matters.",
    },
    actions: {
      emergency: 'Call {emergency}',
      call: 'Call {name}',
      text: 'Text {name}',
      chat: 'Chat with {name}',
      directory: 'Find a helpline near you',
      trustedContact: 'Message someone you trust',
      grounding: 'Try a 2-minute grounding exercise',
      circle: 'Talk to your circle',
      stay: 'Keep talking here',
      talkNow: 'Talk to someone now',
    },
  },
  hi: {
    distress: {
      headline: 'यह सच में बहुत भारी लग रहा है।',
      message:
        'आपको यह सब अकेले नहीं झेलना है। हम साथ में थोड़ा रुक सकते हैं, या आप अभी किसी इंसान से बात कर सकते हैं।',
    },
    ideation: {
      headline: 'मुझे बताने के लिए शुक्रिया।',
      message:
        'लगता है आप खुद को नुकसान पहुँचाने या अपनी जान लेने के बारे में सोच रहे हैं। आपको अभी किसी असली इंसान से मदद पाने का हक़ है, और मदद माँगना ठीक है। {name} इसी के लिए है।',
      messageNoService:
        'लगता है आप खुद को नुकसान पहुँचाने या अपनी जान लेने के बारे में सोच रहे हैं। आपको अभी किसी असली इंसान से मदद पाने का हक़ है। नीचे आपके देश की मुफ़्त हेल्पलाइनें हैं।',
    },
    imminent: {
      headline: 'अभी सबसे ज़रूरी आपकी सुरक्षा है।',
      message:
        'अगर आप खतरे में हैं या खुद को चोट पहुँचा चुके हैं, तो अभी {emergency} पर कॉल करें। हो सके तो उन चीज़ों से दूर हो जाएँ जिनसे आप खुद को चोट पहुँचा सकते हैं, और पास के किसी व्यक्ति को बताएँ कि आपको उनकी ज़रूरत है।',
      messageNoNumber:
        'अगर आप खतरे में हैं या खुद को चोट पहुँचा चुके हैं, तो अभी अपने स्थानीय आपातकालीन नंबर पर कॉल करें। हो सके तो उन चीज़ों से दूर हो जाएँ जिनसे आप खुद को चोट पहुँचा सकते हैं, और पास के किसी व्यक्ति को बताएँ।',
    },
    other: {
      headline: 'अच्छा है कि आप उनका ध्यान रख रहे हैं।',
      message:
        'अगर वे तुरंत खतरे में हैं, तो {emergency} पर कॉल करें। आप खुद भी {name} से संपर्क कर सकते हैं — वे बताएँगे कि उनकी मदद कैसे करें। हो सके तो उनके साथ रहें, सीधे पूछें कि वे कैसा महसूस कर रहे हैं, और बिना जज किए सुनें।',
      messageNoService:
        'अगर वे तुरंत खतरे में हैं, तो अपने स्थानीय आपातकालीन नंबर पर कॉल करें। हो सके तो उनके साथ रहें, सीधे पूछें कि वे कैसा महसूस कर रहे हैं, और बिना जज किए सुनें।',
    },
    abuse: {
      headline: 'आपको सुरक्षित रहने का हक़ है।',
      message:
        'अगर आप अभी खतरे में हैं, तो {emergency} पर कॉल करें। {name} सुरक्षित तरीके से अगला कदम सोचने में मदद कर सकता है। अगर कोई आपका फ़ोन देखता है, तो जल्दी निकलने के लिए "Quick exit" दबाएँ।',
      messageNoService:
        'अगर आप अभी खतरे में हैं, तो अपने स्थानीय आपातकालीन नंबर पर कॉल करें। अगर कोई आपका फ़ोन देखता है, तो जल्दी निकलने के लिए "Quick exit" दबाएँ।',
    },
    medical: {
      headline: 'यह मेडिकल इमरजेंसी हो सकती है।',
      message:
        'अभी {emergency} पर कॉल करें। Waypoint लक्षणों की जाँच नहीं कर सकता, और जल्दी मदद मिलना ज़रूरी है।',
      messageNoNumber:
        'अभी अपने स्थानीय आपातकालीन नंबर पर कॉल करें। Waypoint लक्षणों की जाँच नहीं कर सकता, और जल्दी मदद मिलना ज़रूरी है।',
    },
    actions: {
      emergency: '{emergency} पर कॉल करें',
      call: '{name} को कॉल करें',
      text: '{name} को मैसेज करें',
      chat: '{name} से चैट करें',
      directory: 'अपने पास की हेल्पलाइन खोजें',
      trustedContact: 'किसी भरोसेमंद व्यक्ति को मैसेज करें',
      grounding: '2 मिनट की शांत करने वाली एक्सरसाइज़ करें',
      circle: 'अपने सर्कल से बात करें',
      stay: 'यहीं बात करते रहें',
      talkNow: 'अभी किसी से बात करें',
    },
  },
  es: {
    distress: {
      headline: 'Eso suena muy pesado.',
      message:
        'No tienes que pasar por esto solo o sola. Podemos ir más despacio juntos, o puedes hablar con una persona ahora mismo.',
    },
    ideation: {
      headline: 'Gracias por contármelo.',
      message:
        'Parece que podrías estar pensando en hacerte daño o en quitarte la vida. Mereces el apoyo de una persona real ahora mismo, y está bien pedir ayuda. {name} está para esto.',
      messageNoService:
        'Parece que podrías estar pensando en hacerte daño o en quitarte la vida. Mereces el apoyo de una persona real ahora mismo. Abajo hay un directorio con líneas de ayuda gratuitas en tu país.',
    },
    imminent: {
      headline: 'Lo más importante ahora es tu seguridad.',
      message:
        'Si estás en peligro o ya te has hecho daño, llama al {emergency} ahora. Si puedes, aléjate de cualquier cosa con la que puedas hacerte daño y dile a alguien cercano que lo necesitas.',
      messageNoNumber:
        'Si estás en peligro o ya te has hecho daño, llama ahora al número de emergencias local. Si puedes, aléjate de cualquier cosa con la que puedas hacerte daño y dile a alguien cercano que lo necesitas.',
    },
    other: {
      headline: 'Qué bueno que estés pendiente de esa persona.',
      message:
        'Si está en peligro inmediato, llama al {emergency}. También puedes contactar tú a {name}: te pueden orientar sobre cómo apoyarla. Si puedes, quédate con ella, pregúntale directamente cómo se siente y escucha sin juzgar.',
      messageNoService:
        'Si está en peligro inmediato, llama al número de emergencias local. Si puedes, quédate con ella, pregúntale directamente cómo se siente y escucha sin juzgar.',
    },
    abuse: {
      headline: 'Mereces estar a salvo.',
      message:
        'Si estás en peligro ahora, llama al {emergency}. {name} puede ayudarte a pensar los próximos pasos de forma segura. Si alguien revisa tu teléfono, usa "Salida rápida" para salir de Waypoint.',
      messageNoService:
        'Si estás en peligro ahora, llama al número de emergencias local. Si alguien revisa tu teléfono, usa "Salida rápida" para salir de Waypoint.',
    },
    medical: {
      headline: 'Esto podría ser una emergencia médica.',
      message:
        'Llama al {emergency} ahora. Waypoint no puede evaluar síntomas, y recibir ayuda rápido importa.',
      messageNoNumber:
        'Llama ahora al número de emergencias local. Waypoint no puede evaluar síntomas, y recibir ayuda rápido importa.',
    },
    actions: {
      emergency: 'Llamar al {emergency}',
      call: 'Llamar a {name}',
      text: 'Escribir a {name}',
      chat: 'Chatear con {name}',
      directory: 'Buscar una línea de ayuda cerca',
      trustedContact: 'Escribir a alguien de confianza',
      grounding: 'Hacer un ejercicio de calma de 2 minutos',
      circle: 'Hablar con tu círculo',
      stay: 'Seguir hablando aquí',
      talkNow: 'Hablar con alguien ahora',
    },
  },
  fr: {
    distress: {
      headline: 'Ça a l’air vraiment lourd.',
      message:
        'Vous n’avez pas à traverser cela seul. On peut ralentir ensemble, ou vous pouvez parler à une personne tout de suite.',
    },
    ideation: {
      headline: 'Merci de me l’avoir dit.',
      message:
        'On dirait que vous pensez peut-être à vous faire du mal ou à mettre fin à vos jours. Vous méritez le soutien d’une vraie personne maintenant, et c’est normal de demander de l’aide. {name} est là pour ça.',
      messageNoService:
        'On dirait que vous pensez peut-être à vous faire du mal ou à mettre fin à vos jours. Vous méritez le soutien d’une vraie personne maintenant. L’annuaire ci-dessous liste des lignes d’écoute gratuites dans votre pays.',
    },
    imminent: {
      headline: 'Votre sécurité passe avant tout.',
      message:
        'Si vous êtes en danger ou si vous vous êtes déjà fait du mal, appelez le {emergency} maintenant. Si vous le pouvez, éloignez-vous de ce qui pourrait vous blesser et dites à quelqu’un près de vous que vous avez besoin de lui.',
      messageNoNumber:
        'Si vous êtes en danger ou si vous vous êtes déjà fait du mal, appelez maintenant le numéro d’urgence local. Si vous le pouvez, éloignez-vous de ce qui pourrait vous blesser et prévenez quelqu’un près de vous.',
    },
    other: {
      headline: 'C’est bien de veiller sur cette personne.',
      message:
        'Si elle est en danger immédiat, appelez le {emergency}. Vous pouvez aussi contacter {name} vous-même pour savoir comment l’aider. Si possible, restez avec elle, demandez-lui directement comment elle va et écoutez sans juger.',
      messageNoService:
        'Si elle est en danger immédiat, appelez le numéro d’urgence local. Si possible, restez avec elle, demandez-lui directement comment elle va et écoutez sans juger.',
    },
    abuse: {
      headline: 'Vous méritez d’être en sécurité.',
      message:
        'Si vous êtes en danger maintenant, appelez le {emergency}. {name} peut vous aider à préparer la suite en sécurité. Si quelqu’un regarde votre téléphone, utilisez « Sortie rapide » pour quitter Waypoint.',
      messageNoService:
        'Si vous êtes en danger maintenant, appelez le numéro d’urgence local. Si quelqu’un regarde votre téléphone, utilisez « Sortie rapide » pour quitter Waypoint.',
    },
    medical: {
      headline: 'Cela pourrait être une urgence médicale.',
      message:
        'Appelez le {emergency} maintenant. Waypoint ne peut pas évaluer les symptômes, et obtenir de l’aide vite est important.',
      messageNoNumber:
        'Appelez maintenant le numéro d’urgence local. Waypoint ne peut pas évaluer les symptômes, et obtenir de l’aide vite est important.',
    },
    actions: {
      emergency: 'Appeler le {emergency}',
      call: 'Appeler {name}',
      text: 'Envoyer un SMS à {name}',
      chat: 'Discuter avec {name}',
      directory: 'Trouver une ligne d’écoute',
      trustedContact: 'Écrire à une personne de confiance',
      grounding: 'Faire un exercice de calme de 2 minutes',
      circle: 'Parler à votre cercle',
      stay: 'Continuer à parler ici',
      talkNow: 'Parler à quelqu’un maintenant',
    },
  },
  pt: {
    distress: {
      headline: 'Isso parece muito pesado.',
      message:
        'Você não precisa passar por isso sozinho. Podemos ir com calma juntos, ou você pode falar com uma pessoa agora mesmo.',
    },
    ideation: {
      headline: 'Obrigado por me contar.',
      message:
        'Parece que você pode estar pensando em se machucar ou em tirar a própria vida. Você merece o apoio de uma pessoa de verdade agora, e está tudo bem pedir ajuda. {name} existe para isso.',
      messageNoService:
        'Parece que você pode estar pensando em se machucar ou em tirar a própria vida. Você merece o apoio de uma pessoa de verdade agora. Abaixo há um diretório de linhas de apoio gratuitas no seu país.',
    },
    imminent: {
      headline: 'Sua segurança é o mais importante agora.',
      message:
        'Se você está em perigo ou já se machucou, ligue para o {emergency} agora. Se puder, afaste-se de qualquer coisa que possa usar para se machucar e avise alguém por perto que você precisa de ajuda.',
      messageNoNumber:
        'Se você está em perigo ou já se machucou, ligue agora para o número de emergência local. Se puder, afaste-se de qualquer coisa que possa usar para se machucar e avise alguém por perto.',
    },
    other: {
      headline: 'Que bom que você está cuidando dessa pessoa.',
      message:
        'Se ela estiver em perigo imediato, ligue para o {emergency}. Você também pode falar com {name} para saber como apoiá-la. Se puder, fique com ela, pergunte diretamente como ela está e escute sem julgar.',
      messageNoService:
        'Se ela estiver em perigo imediato, ligue para o número de emergência local. Se puder, fique com ela, pergunte diretamente como ela está e escute sem julgar.',
    },
    abuse: {
      headline: 'Você merece estar em segurança.',
      message:
        'Se você está em perigo agora, ligue para o {emergency}. {name} pode ajudar você a pensar nos próximos passos com segurança. Se alguém olha seu celular, use "Saída rápida" para sair do Waypoint.',
      messageNoService:
        'Se você está em perigo agora, ligue para o número de emergência local. Se alguém olha seu celular, use "Saída rápida" para sair do Waypoint.',
    },
    medical: {
      headline: 'Isto pode ser uma emergência médica.',
      message:
        'Ligue para o {emergency} agora. O Waypoint não pode avaliar sintomas, e conseguir ajuda rápido é importante.',
      messageNoNumber:
        'Ligue agora para o número de emergência local. O Waypoint não pode avaliar sintomas, e conseguir ajuda rápido é importante.',
    },
    actions: {
      emergency: 'Ligar para {emergency}',
      call: 'Ligar para {name}',
      text: 'Mandar mensagem para {name}',
      chat: 'Conversar com {name}',
      directory: 'Encontrar uma linha de apoio',
      trustedContact: 'Mandar mensagem para alguém de confiança',
      grounding: 'Fazer um exercício de calma de 2 minutos',
      circle: 'Falar com seu círculo',
      stay: 'Continuar conversando aqui',
      talkNow: 'Falar com alguém agora',
    },
  },
  ar: {
    distress: {
      headline: 'يبدو هذا ثقيلًا جدًا.',
      message: 'لست مضطرًا لمواجهة هذا وحدك. يمكننا أن نتمهل معًا، أو يمكنك التحدث إلى شخص الآن.',
    },
    ideation: {
      headline: 'شكرًا لأنك أخبرتني.',
      message:
        'يبدو أنك قد تفكر في إيذاء نفسك أو إنهاء حياتك. تستحق دعمًا من شخص حقيقي الآن، ولا بأس في طلب المساعدة. {name} موجود من أجل هذا تمامًا.',
      messageNoService:
        'يبدو أنك قد تفكر في إيذاء نفسك أو إنهاء حياتك. تستحق دعمًا من شخص حقيقي الآن. يوجد أدناه دليل لخطوط المساعدة المجانية في بلدك.',
    },
    imminent: {
      headline: 'سلامتك هي الأهم الآن.',
      message:
        'إذا كنت في خطر أو آذيت نفسك بالفعل، اتصل بالرقم {emergency} الآن. إن استطعت، ابتعد عن أي شيء قد تؤذي به نفسك، وأخبر شخصًا قريبًا منك أنك تحتاجه.',
      messageNoNumber:
        'إذا كنت في خطر أو آذيت نفسك بالفعل، اتصل برقم الطوارئ المحلي الآن. إن استطعت، ابتعد عن أي شيء قد تؤذي به نفسك، وأخبر شخصًا قريبًا منك.',
    },
    other: {
      headline: 'من الجيد أنك تهتم بهذا الشخص.',
      message:
        'إذا كان في خطر مباشر، اتصل بالرقم {emergency}. يمكنك أيضًا التواصل مع {name} بنفسك لمعرفة كيف تدعمه. إن استطعت، ابقَ معه، واسأله مباشرة عن شعوره، واستمع دون أن تحكم عليه.',
      messageNoService:
        'إذا كان في خطر مباشر، اتصل برقم الطوارئ المحلي. إن استطعت، ابقَ معه، واسأله مباشرة عن شعوره، واستمع دون أن تحكم عليه.',
    },
    abuse: {
      headline: 'من حقك أن تكون بأمان.',
      message:
        'إذا كنت في خطر الآن، اتصل بالرقم {emergency}. يمكن لـ {name} مساعدتك في التفكير في الخطوات التالية بأمان. إذا كان أحد يتفقد هاتفك، استخدم "خروج سريع" لمغادرة Waypoint.',
      messageNoService:
        'إذا كنت في خطر الآن، اتصل برقم الطوارئ المحلي. إذا كان أحد يتفقد هاتفك، استخدم "خروج سريع" لمغادرة Waypoint.',
    },
    medical: {
      headline: 'قد تكون هذه حالة طبية طارئة.',
      message:
        'اتصل بالرقم {emergency} الآن. لا يستطيع Waypoint تقييم الأعراض، والحصول على المساعدة بسرعة مهم.',
      messageNoNumber:
        'اتصل برقم الطوارئ المحلي الآن. لا يستطيع Waypoint تقييم الأعراض، والحصول على المساعدة بسرعة مهم.',
    },
    actions: {
      emergency: 'اتصل بالرقم {emergency}',
      call: 'اتصل بـ {name}',
      text: 'راسل {name}',
      chat: 'تحدث مع {name}',
      directory: 'ابحث عن خط مساعدة قريب',
      trustedContact: 'راسل شخصًا تثق به',
      grounding: 'جرّب تمرين تهدئة لمدة دقيقتين',
      circle: 'تحدث إلى مجموعتك',
      stay: 'تابع الحديث هنا',
      talkNow: 'تحدث إلى شخص الآن',
    },
  },
  sw: {
    distress: {
      headline: 'Hilo linaonekana kuwa zito sana.',
      message:
        'Huhitaji kupitia hili peke yako. Tunaweza kwenda polepole pamoja, au unaweza kuzungumza na mtu sasa hivi.',
    },
    ideation: {
      headline: 'Asante kwa kuniambia.',
      message:
        'Inaonekana huenda unafikiria kujidhuru au kujiua. Unastahili msaada kutoka kwa mtu halisi sasa hivi, na ni sawa kuomba msaada. {name} wapo kwa ajili ya hili.',
      messageNoService:
        'Inaonekana huenda unafikiria kujidhuru au kujiua. Unastahili msaada kutoka kwa mtu halisi sasa hivi. Orodha iliyo hapa chini ina nambari za msaada za bure katika nchi yako.',
    },
    imminent: {
      headline: 'Usalama wako ndio muhimu zaidi sasa.',
      message:
        'Ikiwa uko hatarini au tayari umejidhuru, piga {emergency} sasa. Ikiwezekana, jiweke mbali na kitu chochote unachoweza kutumia kujidhuru, na mwambie mtu aliye karibu kwamba unamhitaji.',
      messageNoNumber:
        'Ikiwa uko hatarini au tayari umejidhuru, piga nambari ya dharura ya eneo lako sasa. Ikiwezekana, jiweke mbali na kitu chochote unachoweza kutumia kujidhuru, na mwambie mtu aliye karibu.',
    },
    other: {
      headline: 'Ni vizuri kwamba unamjali.',
      message:
        'Ikiwa yuko hatarini sasa hivi, piga {emergency}. Unaweza pia kuwasiliana na {name} mwenyewe ili kujua jinsi ya kumsaidia. Ikiwezekana, kaa naye, muulize moja kwa moja anavyojisikia, na usikilize bila kuhukumu.',
      messageNoService:
        'Ikiwa yuko hatarini sasa hivi, piga nambari ya dharura ya eneo lako. Ikiwezekana, kaa naye, muulize moja kwa moja anavyojisikia, na usikilize bila kuhukumu.',
    },
    abuse: {
      headline: 'Unastahili kuwa salama.',
      message:
        'Ikiwa uko hatarini sasa, piga {emergency}. {name} wanaweza kukusaidia kupanga hatua zinazofuata kwa usalama. Ikiwa mtu anakagua simu yako, tumia "Toka haraka" kuondoka Waypoint.',
      messageNoService:
        'Ikiwa uko hatarini sasa, piga nambari ya dharura ya eneo lako. Ikiwa mtu anakagua simu yako, tumia "Toka haraka" kuondoka Waypoint.',
    },
    medical: {
      headline: 'Hii inaweza kuwa dharura ya kiafya.',
      message:
        'Piga {emergency} sasa. Waypoint haiwezi kutathmini dalili, na kupata msaada haraka ni muhimu.',
      messageNoNumber:
        'Piga nambari ya dharura ya eneo lako sasa. Waypoint haiwezi kutathmini dalili, na kupata msaada haraka ni muhimu.',
    },
    actions: {
      emergency: 'Piga {emergency}',
      call: 'Piga simu {name}',
      text: 'Tuma ujumbe kwa {name}',
      chat: 'Ongea na {name}',
      directory: 'Tafuta nambari ya msaada',
      trustedContact: 'Tuma ujumbe kwa mtu unayemwamini',
      grounding: 'Jaribu zoezi la utulivu la dakika 2',
      circle: 'Ongea na kikundi chako',
      stay: 'Endelea kuzungumza hapa',
      talkNow: 'Ongea na mtu sasa',
    },
  },
};

export function fill(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}
