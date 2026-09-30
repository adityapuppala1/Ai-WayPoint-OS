/**
 * What Waypoint says by SMS, WhatsApp and USSD, in every supported language. Written for
 * basic phones: short, plain punctuation (so Latin-script languages stay in the cheaper SMS
 * alphabet), and commands in capitals. Keywords are understood in every language (see
 * keywords.ts); START and STOP stay in English because carriers act on them.
 */
import type { Locale } from '../types';

export interface ChannelCopy {
  welcome: string;
  menu: string;
  helpIntro: string;
  emergency: string;
  lineText: string;
  helpOutro: string;
  helpNoCountry: string;
  crisisOutro: string;
  checkEmpty: string;
  verdict: { low: string; unclear: string; high: string; 'very-high': string };
  lowNote: string;
  signs: string;
  todo: string;
  report: string;
  stopped: string;
  started: string;
  languagePick: string;
  languageSet: string;
  countrySet: string;
  countryUnknown: string;
  aiOffer: string;
  aiOn: string;
  aiOff: string;
  aiPrefix: string;
  guided: string;
  unavailable: string;
  slowDown: string;
  /** A sign-in code by SMS: one short message, even in Hindi or Arabic. */
  otp: string;
  ussd: { menu: [string, string, string]; typeMessage: string; invalid: string };
}

const LANGUAGE_LIST =
  '1 English, 2 हिन्दी, 3 Español, 4 Français, 5 Português, 6 العربية, 7 Kiswahili';

export const CHANNEL_COPY: Record<Locale, ChannelCopy> = {
  en: {
    welcome:
      'Waypoint: free, private help with work, money, scams and hard days. Text HELP for help lines, CHECK + a message to check for scams, or ask me anything. LANG changes language, STOP ends texts.',
    menu: 'HELP: help lines. CHECK + a message: check for scams. Or ask me a question. LANG: language. COUNTRY: your country. STOP: no more texts.',
    helpIntro: 'Help lines for {country}:',
    emergency: 'Emergency: call {number}.',
    lineText: '{name}: text {keyword} to {number}',
    helpOutro: "You can also tell me how you feel. I'm here any time.",
    helpNoCountry:
      'Which country are you in? Text COUNTRY and its code, e.g. COUNTRY KE, for local numbers. In danger now? Call your local emergency number.',
    crisisOutro: 'Text HELP any time for these numbers.',
    checkEmpty: 'Send CHECK followed by the message, or just forward me the message.',
    verdict: {
      low: 'No common scam signs found.',
      unclear: 'Some warning signs: be careful.',
      high: 'High risk: this looks like a scam.',
      'very-high': 'Very high risk: this is very likely a scam.',
    },
    lowNote:
      'Still, never share codes or passwords, and check with the company using a number you trust.',
    signs: 'Signs: {signs}.',
    todo: 'What to do: {advice}',
    report: 'Report it: {channel}',
    stopped: 'OK, no more texts from Waypoint. Text START to come back.',
    started: 'Welcome back to Waypoint. Text MENU to see what I can do.',
    languagePick: `Text LANG and a number: ${LANGUAGE_LIST}`,
    languageSet: "OK, I'll reply in English.",
    countrySet: 'OK: {country}. Help lines will be for this country.',
    countryUnknown:
      "I don't know that country code. Text COUNTRY and 2 letters, e.g. COUNTRY KE or COUNTRY IN.",
    aiOffer:
      'Want fuller answers? Our AI assistant can reply. It gets your message with numbers and emails removed (not names, so leave them out). Text AI YES to allow it.',
    aiOn: 'AI answers are on. They are marked AI. Text AI NO to stop them.',
    aiOff: 'AI answers are off.',
    aiPrefix: 'AI: ',
    guided:
      'I can help with: HELP (help lines) and CHECK (scams). For a job plan, a money check and more, visit {site}.',
    unavailable:
      "I can't answer that right now. Text HELP for help lines or CHECK to check a message.",
    slowDown:
      "That's a lot of messages. Please wait an hour and try again. In danger? Call your local emergency number.",
    otp: 'Your Waypoint code is {code}. It expires in 5 minutes. Never share it: Waypoint will never ask you for it.',
    ussd: {
      menu: ['1 Get help now', '2 Check a message', '3 Language'],
      typeMessage: 'Type or paste the message:',
      invalid: 'Please choose a number from the list.',
    },
  },
  hi: {
    welcome:
      'Waypoint: काम, पैसे, धोखे और मुश्किल दिनों में मुफ़्त, निजी मदद। हेल्पलाइन के लिए मदद लिखें, धोखे की जाँच के लिए जाँच + संदेश भेजें, या कुछ भी पूछें। भाषा बदलने के लिए LANG, संदेश बंद करने के लिए STOP।',
    menu: 'हेल्पलाइन: मदद लिखें। धोखे की जाँच: जाँच + संदेश। या सवाल पूछें। भाषा: LANG। देश: COUNTRY। बंद: STOP।',
    helpIntro: '{country} की हेल्पलाइन:',
    emergency: 'आपातकाल: {number} पर कॉल करें।',
    lineText: '{name}: {number} पर {keyword} लिखकर भेजें',
    helpOutro: 'आप मुझे यह भी बता सकते हैं कि आप कैसा महसूस कर रहे हैं। मैं हर समय यहाँ हूँ।',
    helpNoCountry:
      'आप किस देश में हैं? स्थानीय नंबरों के लिए COUNTRY और देश का कोड लिखें, जैसे COUNTRY IN। अभी ख़तरे में हैं? अपने स्थानीय आपातकालीन नंबर पर कॉल करें।',
    crisisOutro: 'ये नंबर कभी भी पाने के लिए मदद लिखें।',
    checkEmpty: 'जाँच के बाद संदेश लिखकर भेजें, या संदेश सीधे मुझे फ़ॉरवर्ड करें।',
    verdict: {
      low: 'धोखे के आम संकेत नहीं मिले।',
      unclear: 'कुछ चेतावनी संकेत हैं: सावधान रहें।',
      high: 'जोखिम ज़्यादा: यह धोखा लगता है।',
      'very-high': 'जोखिम बहुत ज़्यादा: यह लगभग निश्चित रूप से धोखा है।',
    },
    lowNote: 'फिर भी, कोड या पासवर्ड कभी साझा न करें, और भरोसेमंद नंबर से कंपनी से पुष्टि करें।',
    signs: 'संकेत: {signs}।',
    todo: 'क्या करें: {advice}',
    report: 'शिकायत करें: {channel}',
    stopped: 'ठीक है, अब Waypoint से संदेश नहीं आएँगे। वापस आने के लिए START लिखें।',
    started: 'Waypoint में फिर से स्वागत है। मैं क्या कर सकता हूँ, यह देखने के लिए MENU लिखें।',
    languagePick: `LANG और एक नंबर लिखें: ${LANGUAGE_LIST}`,
    languageSet: 'ठीक है, मैं हिन्दी में जवाब दूँगा।',
    countrySet: 'ठीक है: {country}। हेल्पलाइन इसी देश की होंगी।',
    countryUnknown: 'मैं यह देश कोड नहीं पहचानता। COUNTRY और 2 अक्षर लिखें, जैसे COUNTRY IN।',
    aiOffer:
      'और पूरे जवाब चाहिए? हमारा AI सहायक जवाब दे सकता है। उसे आपका संदेश नंबर और ईमेल हटाकर मिलता है (नाम नहीं हटते, इसलिए नाम न लिखें)। अनुमति देने के लिए AI YES लिखें।',
    aiOn: 'AI जवाब चालू हैं। उन पर AI लिखा होगा। बंद करने के लिए AI NO लिखें।',
    aiOff: 'AI जवाब बंद हैं।',
    aiPrefix: 'AI: ',
    guided:
      'मैं इनमें मदद कर सकता हूँ: मदद (हेल्पलाइन) और जाँच (धोखा)। नौकरी की योजना, पैसे की जाँच और बहुत कुछ के लिए {site} पर जाएँ।',
    unavailable: 'मैं अभी इसका जवाब नहीं दे सकता। हेल्पलाइन के लिए मदद लिखें, या संदेश की जाँच के लिए जाँच।',
    slowDown:
      'बहुत सारे संदेश आ गए। कृपया एक घंटा रुककर फिर कोशिश करें। ख़तरे में हैं? अपने स्थानीय आपातकालीन नंबर पर कॉल करें।',
    otp: 'Waypoint कोड: {code}। 5 मिनट तक मान्य। इसे किसी को न बताएँ।',
    ussd: {
      menu: ['1 अभी मदद पाएँ', '2 संदेश जाँचें', '3 भाषा'],
      typeMessage: 'संदेश लिखें या चिपकाएँ:',
      invalid: 'कृपया सूची में से एक नंबर चुनें।',
    },
  },
  es: {
    welcome:
      'Waypoint: ayuda gratis y privada con trabajo, dinero, estafas y días difíciles. Escribe AYUDA para líneas de ayuda, REVISAR + un mensaje para ver si es estafa, o pregúntame lo que quieras. LANG cambia el idioma y STOP detiene los mensajes.',
    menu: 'AYUDA: líneas de ayuda. REVISAR + mensaje: ver si es estafa. O hazme una pregunta. LANG: idioma. COUNTRY: tu país. STOP: no más mensajes.',
    helpIntro: 'Líneas de ayuda ({country}):',
    emergency: 'Emergencias: llama al {number}.',
    lineText: '{name}: envía {keyword} al {number}',
    helpOutro: 'También puedes contarme cómo te sientes. Estoy aquí a cualquier hora.',
    helpNoCountry:
      '¿En qué país estás? Escribe COUNTRY y su código, p. ej. COUNTRY MX, para ver números locales. ¿Corres peligro ahora? Llama al número de emergencias local.',
    crisisOutro: 'Escribe AYUDA cuando quieras para ver estos números.',
    checkEmpty: 'Escribe REVISAR seguido del mensaje, o reenvíame el mensaje.',
    verdict: {
      low: 'No encontré señales comunes de estafa.',
      unclear: 'Hay algunas señales de alerta: ten cuidado.',
      high: 'Riesgo alto: parece una estafa.',
      'very-high': 'Riesgo muy alto: es muy probablemente una estafa.',
    },
    lowNote:
      'Aun así, nunca compartas códigos ni contraseñas, y confirma con la empresa usando un número de confianza.',
    signs: 'Señales: {signs}.',
    todo: 'Qué hacer: {advice}',
    report: 'Denúncialo: {channel}',
    stopped: 'De acuerdo, no recibirás más mensajes de Waypoint. Escribe START para volver.',
    started: 'Hola de nuevo. Escribe MENU para ver lo que puedo hacer.',
    languagePick: `Escribe LANG y un número: ${LANGUAGE_LIST}`,
    languageSet: 'De acuerdo, te responderé en español.',
    countrySet: 'De acuerdo: {country}. Las líneas de ayuda serán de ese país.',
    countryUnknown:
      'No reconozco ese código de país. Escribe COUNTRY y 2 letras, p. ej. COUNTRY MX o COUNTRY ES.',
    aiOffer:
      '¿Quieres respuestas más completas? Nuestro asistente de IA puede responder. Recibe tu mensaje sin números ni correos (los nombres no se quitan: no los escribas). Escribe IA SI para permitirlo.',
    aiOn: 'Las respuestas de IA están activadas y van marcadas como IA. Escribe IA NO para desactivarlas.',
    aiOff: 'Las respuestas de IA están desactivadas.',
    aiPrefix: 'IA: ',
    guided:
      'Puedo ayudarte con: AYUDA (líneas de ayuda) y REVISAR (estafas). Para un plan de trabajo, revisar tu dinero y más, visita {site}.',
    unavailable:
      'Ahora no puedo responder a eso. Escribe AYUDA para líneas de ayuda o REVISAR para revisar un mensaje.',
    slowDown:
      'Son muchos mensajes seguidos. Espera una hora y vuelve a intentarlo. ¿Corres peligro? Llama al número de emergencias local.',
    otp: 'Tu código Waypoint: {code}. Vence en 5 min. No lo compartas.',
    ussd: {
      menu: ['1 Ayuda ahora', '2 Revisar un mensaje', '3 Idioma'],
      typeMessage: 'Escribe o pega el mensaje:',
      invalid: 'Elige un número de la lista.',
    },
  },
  fr: {
    welcome:
      "Waypoint : aide gratuite et confidentielle pour le travail, l'argent, les arnaques et les jours difficiles. Écrivez AIDE pour les lignes d'écoute, VERIFIER + un message pour détecter une arnaque, ou posez-moi une question. LANG change la langue, STOP arrête les messages.",
    menu: "AIDE : lignes d'écoute. VERIFIER + message : détecter une arnaque. Ou posez une question. LANG : langue. COUNTRY : votre pays. STOP : plus de messages.",
    helpIntro: "Lignes d'aide ({country}) :",
    emergency: 'Urgence : appelez le {number}.',
    lineText: '{name} : envoyez {keyword} au {number}',
    helpOutro: 'Vous pouvez aussi me dire comment vous vous sentez. Je suis là à toute heure.',
    helpNoCountry:
      "Dans quel pays êtes-vous ? Écrivez COUNTRY et son code, par ex. COUNTRY FR, pour avoir les numéros locaux. En danger maintenant ? Appelez le numéro d'urgence local.",
    crisisOutro: 'Écrivez AIDE à tout moment pour retrouver ces numéros.',
    checkEmpty: 'Écrivez VERIFIER suivi du message, ou transférez-moi simplement le message.',
    verdict: {
      low: "Aucun signe d'arnaque courant.",
      unclear: "Quelques signaux d'alerte : restez prudent.",
      high: 'Risque élevé : cela ressemble à une arnaque.',
      'very-high': "Risque très élevé : c'est très probablement une arnaque.",
    },
    lowNote:
      "Malgré tout, ne partagez jamais de code ni de mot de passe, et vérifiez auprès de l'entreprise avec un numéro de confiance.",
    signs: 'Signes : {signs}.',
    todo: 'Que faire : {advice}',
    report: 'Signalez-le : {channel}',
    stopped:
      "C'est noté, vous ne recevrez plus de messages de Waypoint. Écrivez START pour revenir.",
    started: 'Bon retour sur Waypoint. Écrivez MENU pour voir ce que je peux faire.',
    languagePick: `Écrivez LANG et un numéro : ${LANGUAGE_LIST}`,
    languageSet: "D'accord, je vous répondrai en français.",
    countrySet: "D'accord : {country}. Les lignes d'aide seront celles de ce pays.",
    countryUnknown:
      'Je ne connais pas ce code pays. Écrivez COUNTRY et 2 lettres, par ex. COUNTRY FR ou COUNTRY MA.',
    aiOffer:
      "Envie de réponses plus complètes ? Notre assistant IA peut répondre. Il reçoit votre message sans numéros ni e-mails (les noms restent : ne les écrivez pas). Écrivez IA OUI pour l'autoriser.",
    aiOn: 'Les réponses IA sont activées et signalées IA. Écrivez IA NON pour les arrêter.',
    aiOff: 'Les réponses IA sont désactivées.',
    aiPrefix: 'IA : ',
    guided:
      "Je peux vous aider avec : AIDE (lignes d'écoute) et VERIFIER (arnaques). Pour un plan emploi, un point sur votre argent et plus, allez sur {site}.",
    unavailable:
      "Je ne peux pas répondre à cela pour l'instant. Écrivez AIDE pour les lignes d'écoute ou VERIFIER pour vérifier un message.",
    slowDown:
      "Cela fait beaucoup de messages. Patientez une heure puis réessayez. En danger ? Appelez le numéro d'urgence local.",
    otp: 'Votre code Waypoint : {code}. Il expire dans 5 minutes. Ne le partagez avec personne.',
    ussd: {
      menu: ['1 Aide immédiate', '2 Vérifier un message', '3 Langue'],
      typeMessage: 'Tapez ou collez le message :',
      invalid: 'Choisissez un numéro de la liste.',
    },
  },
  pt: {
    welcome:
      'Waypoint: ajuda grátis e privada com trabalho, dinheiro, golpes e dias difíceis. Escreva AJUDA para linhas de apoio, VERIFICAR + uma mensagem para checar golpes, ou me pergunte o que quiser. LANG muda o idioma e STOP para as mensagens.',
    menu: 'AJUDA: linhas de apoio. VERIFICAR + mensagem: checar golpe. Ou faça uma pergunta. LANG: idioma. COUNTRY: seu país. STOP: parar mensagens.',
    helpIntro: 'Linhas de apoio ({country}):',
    emergency: 'Emergência: ligue {number}.',
    lineText: '{name}: envie {keyword} para {number}',
    helpOutro: 'Você também pode me contar como está se sentindo. Estou aqui a qualquer hora.',
    helpNoCountry:
      'Em que país você está? Escreva COUNTRY e o código, por ex. COUNTRY BR, para ver números locais. Em perigo agora? Ligue para o número de emergência local.',
    crisisOutro: 'Escreva AJUDA a qualquer momento para ver esses números.',
    checkEmpty: 'Escreva VERIFICAR seguido da mensagem, ou só encaminhe a mensagem para mim.',
    verdict: {
      low: 'Não encontrei sinais comuns de golpe.',
      unclear: 'Alguns sinais de alerta: tenha cuidado.',
      high: 'Risco alto: parece golpe.',
      'very-high': 'Risco muito alto: é muito provavelmente golpe.',
    },
    lowNote:
      'Mesmo assim, nunca compartilhe códigos ou senhas, e confirme com a empresa por um número de confiança.',
    signs: 'Sinais: {signs}.',
    todo: 'O que fazer: {advice}',
    report: 'Denuncie: {channel}',
    stopped:
      'Tudo bem, você não vai mais receber mensagens do Waypoint. Escreva START para voltar.',
    started: 'Que bom ter você de volta. Escreva MENU para ver o que posso fazer.',
    languagePick: `Escreva LANG e um número: ${LANGUAGE_LIST}`,
    languageSet: 'Certo, vou responder em português.',
    countrySet: 'Certo: {country}. As linhas de apoio serão desse país.',
    countryUnknown:
      'Não conheço esse código de país. Escreva COUNTRY e 2 letras, por ex. COUNTRY BR ou COUNTRY PT.',
    aiOffer:
      'Quer respostas mais completas? Nosso assistente de IA pode responder. Ele recebe sua mensagem sem números nem e-mails (nomes não são removidos: não os escreva). Escreva IA SIM para permitir.',
    aiOn: 'As respostas de IA estão ligadas e vêm marcadas como IA. Escreva IA NAO para desligar.',
    aiOff: 'As respostas de IA estão desligadas.',
    aiPrefix: 'IA: ',
    guided:
      'Posso ajudar com: AJUDA (linhas de apoio) e VERIFICAR (golpes). Para um plano de trabalho, checar seu dinheiro e mais, acesse {site}.',
    unavailable:
      'Não consigo responder isso agora. Escreva AJUDA para linhas de apoio ou VERIFICAR para checar uma mensagem.',
    slowDown:
      'São muitas mensagens seguidas. Espere uma hora e tente de novo. Em perigo? Ligue para o número de emergência local.',
    otp: 'Seu código Waypoint: {code}. Vale 5 min. Não compartilhe.',
    ussd: {
      menu: ['1 Ajuda agora', '2 Verificar mensagem', '3 Idioma'],
      typeMessage: 'Digite ou cole a mensagem:',
      invalid: 'Escolha um número da lista.',
    },
  },
  ar: {
    welcome:
      'Waypoint: مساعدة مجانية وخاصة في العمل والمال والاحتيال والأيام الصعبة. اكتب مساعدة لأرقام الدعم، أو تحقق + رسالة لفحص الاحتيال، أو اسألني أي شيء. LANG لتغيير اللغة، وSTOP لإيقاف الرسائل.',
    menu: 'مساعدة: أرقام الدعم. تحقق + رسالة: فحص الاحتيال. أو اطرح سؤالًا. LANG: اللغة. COUNTRY: بلدك. STOP: إيقاف الرسائل.',
    helpIntro: 'أرقام الدعم ({country}):',
    emergency: 'الطوارئ: اتصل بالرقم {number}.',
    lineText: '{name}: أرسل {keyword} إلى {number}',
    helpOutro: 'يمكنك أيضًا أن تخبرني بما تشعر به. أنا هنا في أي وقت.',
    helpNoCountry:
      'في أي بلد أنت؟ اكتب COUNTRY ورمز البلد، مثل COUNTRY EG، لتحصل على الأرقام المحلية. هل أنت في خطر الآن؟ اتصل برقم الطوارئ المحلي.',
    crisisOutro: 'اكتب مساعدة في أي وقت لتحصل على هذه الأرقام.',
    checkEmpty: 'اكتب تحقق ثم الرسالة، أو أعد توجيه الرسالة إليّ.',
    verdict: {
      low: 'لم أجد علامات احتيال شائعة.',
      unclear: 'هناك بعض علامات التحذير: كن حذرًا.',
      high: 'خطر مرتفع: تبدو هذه عملية احتيال.',
      'very-high': 'خطر مرتفع جدًا: هذه على الأرجح عملية احتيال.',
    },
    lowNote: 'ومع ذلك، لا تشارك الرموز أو كلمات المرور أبدًا، وتأكد من الشركة عبر رقم تثق به.',
    signs: 'العلامات: {signs}.',
    todo: 'ماذا تفعل: {advice}',
    report: 'أبلغ عنها: {channel}',
    stopped: 'حسنًا، لن تصلك رسائل أخرى من Waypoint. اكتب START للعودة.',
    started: 'مرحبًا بعودتك إلى Waypoint. اكتب MENU لترى ما يمكنني فعله.',
    languagePick: `اكتب LANG ورقمًا: ${LANGUAGE_LIST}`,
    languageSet: 'حسنًا، سأرد بالعربية.',
    countrySet: 'حسنًا: {country}. ستكون أرقام الدعم لهذا البلد.',
    countryUnknown: 'لا أعرف رمز البلد هذا. اكتب COUNTRY وحرفين، مثل COUNTRY EG أو COUNTRY SA.',
    aiOffer:
      'هل تريد إجابات أكمل؟ يمكن لمساعدنا بالذكاء الاصطناعي أن يرد. يصله نص رسالتك بعد حذف الأرقام وعناوين البريد الإلكتروني (لا تُحذف الأسماء، فلا تكتبها). اكتب AI نعم للسماح بذلك.',
    aiOn: 'إجابات الذكاء الاصطناعي مفعّلة وتظهر معها كلمة AI. اكتب AI لا لإيقافها.',
    aiOff: 'إجابات الذكاء الاصطناعي متوقفة.',
    aiPrefix: 'AI: ',
    guided:
      'يمكنني المساعدة في: مساعدة (أرقام الدعم) وتحقق (الاحتيال). لخطة عمل وفحص أموالك والمزيد، زر {site}.',
    unavailable: 'لا أستطيع الإجابة عن ذلك الآن. اكتب مساعدة لأرقام الدعم أو تحقق لفحص رسالة.',
    slowDown:
      'هذه رسائل كثيرة. انتظر ساعة ثم حاول مرة أخرى. هل أنت في خطر؟ اتصل برقم الطوارئ المحلي.',
    otp: 'رمز Waypoint: {code}. صالح لمدة 5 دقائق. لا تشاركه مع أحد.',
    ussd: {
      menu: ['1 مساعدة الآن', '2 فحص رسالة', '3 اللغة'],
      typeMessage: 'اكتب الرسالة أو الصقها:',
      invalid: 'اختر رقمًا من القائمة.',
    },
  },
  sw: {
    welcome:
      'Waypoint: msaada wa bure na wa faragha kuhusu kazi, pesa, utapeli na siku ngumu. Tuma MSAADA kupata namba za msaada, ANGALIA + ujumbe kukagua utapeli, au niulize chochote. LANG hubadilisha lugha, STOP husimamisha ujumbe.',
    menu: 'MSAADA: namba za msaada. ANGALIA + ujumbe: kagua utapeli. Au uliza swali. LANG: lugha. COUNTRY: nchi yako. STOP: sitisha ujumbe.',
    helpIntro: 'Namba za msaada ({country}):',
    emergency: 'Dharura: piga {number}.',
    lineText: '{name}: tuma {keyword} kwa {number}',
    helpOutro: 'Unaweza pia kuniambia unavyojisikia. Niko hapa wakati wowote.',
    helpNoCountry:
      'Uko nchi gani? Tuma COUNTRY na msimbo wa nchi, mfano COUNTRY KE, upate namba za karibu. Uko hatarini sasa? Piga namba ya dharura ya eneo lako.',
    crisisOutro: 'Tuma MSAADA wakati wowote upate namba hizi.',
    checkEmpty: 'Tuma ANGALIA ikifuatiwa na ujumbe, au nitumie ujumbe huo moja kwa moja.',
    verdict: {
      low: 'Sikupata dalili za kawaida za utapeli.',
      unclear: 'Kuna dalili za tahadhari: kuwa makini.',
      high: 'Hatari kubwa: huu unaonekana kuwa utapeli.',
      'very-high': 'Hatari kubwa sana: huu ni utapeli karibu kwa hakika.',
    },
    lowNote:
      'Hata hivyo, usishiriki kamwe namba za siri au nenosiri, na thibitisha na kampuni kupitia namba unayoiamini.',
    signs: 'Dalili: {signs}.',
    todo: 'Cha kufanya: {advice}',
    report: 'Ripoti: {channel}',
    stopped: 'Sawa, hutapokea ujumbe zaidi kutoka Waypoint. Tuma START kurudi.',
    started: 'Karibu tena Waypoint. Tuma MENU kuona ninachoweza kufanya.',
    languagePick: `Tuma LANG na namba: ${LANGUAGE_LIST}`,
    languageSet: 'Sawa, nitajibu kwa Kiswahili.',
    countrySet: 'Sawa: {country}. Namba za msaada zitakuwa za nchi hiyo.',
    countryUnknown:
      'Sijui msimbo huo wa nchi. Tuma COUNTRY na herufi 2, mfano COUNTRY KE au COUNTRY TZ.',
    aiOffer:
      'Unataka majibu kamili zaidi? Msaidizi wetu wa AI anaweza kujibu. Anapokea ujumbe wako bila namba wala barua pepe (majina hayaondolewi, kwa hivyo usiyaandike). Tuma AI NDIO kuruhusu.',
    aiOn: 'Majibu ya AI yamewashwa na yanaonyeshwa kama AI. Tuma AI HAPANA kuyazima.',
    aiOff: 'Majibu ya AI yamezimwa.',
    aiPrefix: 'AI: ',
    guided:
      'Ninaweza kusaidia na: MSAADA (namba za msaada) na ANGALIA (utapeli). Kwa mpango wa kazi, hali ya pesa na zaidi, tembelea {site}.',
    unavailable:
      'Siwezi kujibu hilo sasa. Tuma MSAADA kupata namba za msaada au ANGALIA kukagua ujumbe.',
    slowDown:
      'Hizo ni jumbe nyingi. Tafadhali subiri saa moja kisha ujaribu tena. Uko hatarini? Piga namba ya dharura ya eneo lako.',
    otp: 'Nambari ya uthibitisho ya Waypoint: {code}. Itaisha baada ya dakika 5. Usimpe mtu yeyote.',
    ussd: {
      menu: ['1 Pata msaada sasa', '2 Kagua ujumbe', '3 Lugha'],
      typeMessage: 'Andika au bandika ujumbe:',
      invalid: 'Tafadhali chagua namba kwenye orodha.',
    },
  },
};
