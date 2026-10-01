/**
 * The emails Waypoint sends, in every supported language. Each one says plainly why it was
 * sent, what the link does (and does not do), and what happens if it is ignored — and none
 * ever asks for a password, a code or a payment.
 */
import type { Locale } from '@waypoint/core';

interface Mail {
  subject: string;
  body: string;
  button: string;
  note: string;
}

export interface EmailCopy {
  greeting: string;
  greetingNoName: string;
  /** Who sent an invitation, when their account has no name. */
  someone: string;
  verify: Mail;
  reset: Mail;
  /** Someone tried to create an account with an address that already has one. */
  exists: Mail;
  invite: Mail;
  /** An invitation to join the platform's own staff (sent from the console). */
  staffInvite: Mail;
  /** The roles a staff invitation can carry, as they read in a sentence ("as {role}"). */
  roles: { admin: string; staff: string };
  linkFallback: string;
  footer: string;
}

export const EMAIL_COPY: Record<Locale, EmailCopy> = {
  en: {
    greeting: 'Hi {name},',
    greetingNoName: 'Hi,',
    someone: 'Someone',
    verify: {
      subject: 'Confirm your email address',
      body: "Please confirm that this is your email address for Waypoint. Once it's confirmed, you can sign in with it and answer invitations to an organisation's team.",
      button: 'Confirm my email address',
      note: "The link works for 24 hours and only confirms your address — it doesn't sign you in. If you didn't create a Waypoint account, ignore this email: an account that is never confirmed is deleted after 7 days.",
    },
    reset: {
      subject: 'Reset your Waypoint password',
      body: 'Someone asked to reset the password for your Waypoint account. If it was you, choose a new password with the button below.',
      button: 'Choose a new password',
      note: "The link works for one hour. If you didn't ask for this, ignore this email: your password stays the same.",
    },
    exists: {
      subject: 'You already have a Waypoint account',
      body: "Someone tried to create a Waypoint account with this email address, but it already has one. If it was you, sign in with your password — or choose a new one from the sign-in page if you've forgotten it.",
      button: 'Sign in to Waypoint',
      note: "If it wasn't you, you don't need to do anything: nothing has changed, and nobody can get into your account without your password.",
    },
    invite: {
      subject: '{inviter} invited you to {organisation} on Waypoint',
      body: "{inviter} invited you to help run {organisation} on Waypoint, a free companion for life's big changes.",
      button: 'See the invitation',
      note: "To answer, sign in or create an account with this email address and confirm it. The invitation expires in 7 days. If you weren't expecting it, you can ignore this email.",
    },
    staffInvite: {
      subject: "{inviter} invited you to join Waypoint's staff",
      body: '{inviter} invited you to join the people who run this Waypoint, as {role}.',
      button: 'See the invitation',
      note: "To answer, sign in or create an account with this email address and confirm it. The invitation expires in 7 days. If you weren't expecting it, you can ignore this email.",
    },
    roles: { admin: 'an admin', staff: 'a member of staff' },
    linkFallback: "If the button doesn't work, copy this link into your browser:",
    footer:
      'Waypoint · free help with work, money, safety and hard days. We never ask for passwords, codes or payments by email.',
  },
  hi: {
    greeting: 'नमस्ते {name},',
    greetingNoName: 'नमस्ते,',
    someone: 'किसी',
    verify: {
      subject: 'अपने ईमेल पते की पुष्टि करें',
      body: 'कृपया पुष्टि करें कि Waypoint के लिए यह आपका ईमेल पता है। पुष्टि होने के बाद आप इससे साइन इन कर सकते हैं और किसी संगठन की टीम के आमंत्रणों का जवाब दे सकते हैं।',
      button: 'मेरे ईमेल पते की पुष्टि करें',
      note: 'यह लिंक 24 घंटे तक काम करता है और केवल आपके पते की पुष्टि करता है — इससे आप साइन इन नहीं होते। अगर आपने Waypoint खाता नहीं बनाया, तो इस ईमेल को अनदेखा करें: जिस खाते की कभी पुष्टि नहीं होती, वह 7 दिनों बाद हटा दिया जाता है।',
    },
    reset: {
      subject: 'अपना Waypoint पासवर्ड रीसेट करें',
      body: 'किसी ने आपके Waypoint खाते का पासवर्ड रीसेट करने को कहा है। अगर वह आप थे, तो नीचे दिए बटन से नया पासवर्ड चुनें।',
      button: 'नया पासवर्ड चुनें',
      note: 'यह लिंक एक घंटे तक काम करता है। अगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें: आपका पासवर्ड वही रहेगा।',
    },
    exists: {
      subject: 'आपका Waypoint खाता पहले से है',
      body: 'किसी ने इस ईमेल पते से Waypoint खाता बनाने की कोशिश की, लेकिन इस पते से खाता पहले से मौजूद है। अगर वह आप थे, तो अपने पासवर्ड से साइन इन करें — या भूल गए हों तो साइन-इन पेज से नया पासवर्ड चुनें।',
      button: 'Waypoint में साइन इन करें',
      note: 'अगर वह आप नहीं थे, तो आपको कुछ करने की ज़रूरत नहीं है: कुछ नहीं बदला है, और आपके पासवर्ड के बिना कोई आपके खाते में नहीं जा सकता।',
    },
    invite: {
      subject: '{inviter} ने आपको Waypoint पर {organisation} में आमंत्रित किया है',
      body: '{inviter} ने आपको Waypoint पर {organisation} चलाने में मदद के लिए आमंत्रित किया है — जीवन के बड़े बदलावों के लिए एक मुफ़्त साथी।',
      button: 'आमंत्रण देखें',
      note: 'जवाब देने के लिए, इसी ईमेल पते से साइन इन करें या खाता बनाएँ और पते की पुष्टि करें। आमंत्रण 7 दिनों में समाप्त हो जाएगा। अगर आप इसकी उम्मीद नहीं कर रहे थे, तो इस ईमेल को अनदेखा कर सकते हैं।',
    },
    staffInvite: {
      subject: '{inviter} ने आपको Waypoint के स्टाफ़ में शामिल होने का न्योता दिया है',
      body: '{inviter} ने आपको इस Waypoint को चलाने वाले लोगों में {role} के रूप में शामिल होने का न्योता दिया है।',
      button: 'न्योता देखें',
      note: 'जवाब देने के लिए इसी ईमेल पते से साइन इन करें या खाता बनाएँ और उसकी पुष्टि करें। न्योता 7 दिनों में समाप्त हो जाता है। अगर आपको इसकी उम्मीद नहीं थी, तो इस ईमेल को अनदेखा कर सकते हैं।',
    },
    roles: { admin: 'एडमिन', staff: 'स्टाफ़ सदस्य' },
    linkFallback: 'अगर बटन काम न करे, तो यह लिंक अपने ब्राउज़र में कॉपी करें:',
    footer:
      'Waypoint · काम, पैसे, सुरक्षा और मुश्किल दिनों में मुफ़्त मदद। हम ईमेल से कभी पासवर्ड, कोड या भुगतान नहीं माँगते।',
  },
  es: {
    greeting: 'Hola, {name}:',
    greetingNoName: 'Hola:',
    someone: 'Alguien',
    verify: {
      subject: 'Confirma tu dirección de correo',
      body: 'Confirma que esta es tu dirección de correo para Waypoint. Una vez confirmada, podrás iniciar sesión con ella y responder a invitaciones al equipo de una organización.',
      button: 'Confirmar mi dirección de correo',
      note: 'El enlace funciona durante 24 horas y solo confirma tu dirección: no inicia tu sesión. Si no creaste una cuenta en Waypoint, ignora este correo: las cuentas que nunca se confirman se eliminan a los 7 días.',
    },
    reset: {
      subject: 'Restablece tu contraseña de Waypoint',
      body: 'Alguien pidió restablecer la contraseña de tu cuenta de Waypoint. Si fuiste tú, elige una nueva contraseña con el botón de abajo.',
      button: 'Elegir una nueva contraseña',
      note: 'El enlace funciona durante una hora. Si no lo pediste tú, ignora este correo: tu contraseña seguirá igual.',
    },
    exists: {
      subject: 'Ya tienes una cuenta en Waypoint',
      body: 'Alguien intentó crear una cuenta de Waypoint con esta dirección de correo, pero ya tiene una. Si fuiste tú, inicia sesión con tu contraseña o, si la olvidaste, elige una nueva desde la página de inicio de sesión.',
      button: 'Iniciar sesión en Waypoint',
      note: 'Si no fuiste tú, no tienes que hacer nada: no ha cambiado nada y nadie puede entrar en tu cuenta sin tu contraseña.',
    },
    invite: {
      subject: '{inviter} te invitó a {organisation} en Waypoint',
      body: '{inviter} te invitó a ayudar a gestionar {organisation} en Waypoint, un acompañante gratuito para los grandes cambios de la vida.',
      button: 'Ver la invitación',
      note: 'Para responder, inicia sesión o crea una cuenta con esta dirección de correo y confírmala. La invitación caduca en 7 días. Si no la esperabas, puedes ignorar este correo.',
    },
    staffInvite: {
      subject: '{inviter} le invitó a unirse al equipo de Waypoint',
      body: '{inviter} le invitó a unirse a las personas que gestionan este Waypoint, como {role}.',
      button: 'Ver la invitación',
      note: 'Para responder, inicie sesión o cree una cuenta con esta dirección de correo y confírmela. La invitación caduca en 7 días. Si no la esperaba, puede ignorar este correo.',
    },
    roles: { admin: 'administrador', staff: 'miembro del equipo' },
    linkFallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    footer:
      'Waypoint · ayuda gratuita con trabajo, dinero, seguridad y días difíciles. Nunca pedimos contraseñas, códigos ni pagos por correo.',
  },
  fr: {
    greeting: 'Bonjour {name},',
    greetingNoName: 'Bonjour,',
    someone: 'Quelqu’un',
    verify: {
      subject: 'Confirmez votre adresse e-mail',
      body: "Merci de confirmer que cette adresse e-mail est bien la vôtre pour Waypoint. Une fois confirmée, vous pourrez vous connecter avec elle et répondre aux invitations à rejoindre l'équipe d'une organisation.",
      button: 'Confirmer mon adresse e-mail',
      note: "Le lien est valable 24 heures et confirme seulement votre adresse : il ne vous connecte pas. Si vous n'avez pas créé de compte Waypoint, ignorez cet e-mail : un compte jamais confirmé est supprimé au bout de 7 jours.",
    },
    reset: {
      subject: 'Réinitialisez votre mot de passe Waypoint',
      body: "Quelqu'un a demandé à réinitialiser le mot de passe de votre compte Waypoint. Si c'était vous, choisissez un nouveau mot de passe avec le bouton ci-dessous.",
      button: 'Choisir un nouveau mot de passe',
      note: "Le lien est valable une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste le même.",
    },
    exists: {
      subject: 'Vous avez déjà un compte Waypoint',
      body: "Quelqu'un a essayé de créer un compte Waypoint avec cette adresse e-mail, mais elle en a déjà un. Si c'était vous, connectez-vous avec votre mot de passe — ou choisissez-en un nouveau depuis la page de connexion si vous l'avez oublié.",
      button: 'Me connecter à Waypoint',
      note: "Si ce n'était pas vous, vous n'avez rien à faire : rien n'a changé, et personne ne peut accéder à votre compte sans votre mot de passe.",
    },
    invite: {
      subject: '{inviter} vous invite à rejoindre {organisation} sur Waypoint',
      body: '{inviter} vous invite à aider à gérer {organisation} sur Waypoint, un compagnon gratuit pour les grands changements de la vie.',
      button: "Voir l'invitation",
      note: "Pour répondre, connectez-vous ou créez un compte avec cette adresse e-mail, puis confirmez-la. L'invitation expire dans 7 jours. Si vous ne l'attendiez pas, vous pouvez ignorer cet e-mail.",
    },
    staffInvite: {
      subject: '{inviter} vous invite à rejoindre l’équipe de Waypoint',
      body: '{inviter} vous invite à rejoindre les personnes qui gèrent ce Waypoint, en tant que {role}.',
      button: 'Voir l’invitation',
      note: 'Pour répondre, connectez-vous ou créez un compte avec cette adresse e-mail et confirmez-la. L’invitation expire dans 7 jours. Si vous ne l’attendiez pas, vous pouvez ignorer cet e-mail.',
    },
    roles: { admin: 'administrateur', staff: 'membre de l’équipe' },
    linkFallback: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    footer:
      "Waypoint · aide gratuite pour le travail, l'argent, la sécurité et les jours difficiles. Nous ne demandons jamais de mot de passe, de code ni de paiement par e-mail.",
  },
  pt: {
    greeting: 'Olá, {name},',
    greetingNoName: 'Olá,',
    someone: 'Alguém',
    verify: {
      subject: 'Confirme seu endereço de e-mail',
      body: 'Confirme que este é o seu endereço de e-mail no Waypoint. Depois de confirmado, você pode entrar com ele e responder a convites para a equipe de uma organização.',
      button: 'Confirmar meu e-mail',
      note: 'O link vale por 24 horas e só confirma seu endereço — ele não faz você entrar na conta. Se você não criou uma conta no Waypoint, ignore este e-mail: contas que nunca são confirmadas são apagadas após 7 dias.',
    },
    reset: {
      subject: 'Redefina sua senha do Waypoint',
      body: 'Alguém pediu para redefinir a senha da sua conta no Waypoint. Se foi você, escolha uma nova senha no botão abaixo.',
      button: 'Escolher uma nova senha',
      note: 'O link vale por uma hora. Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.',
    },
    exists: {
      subject: 'Você já tem uma conta no Waypoint',
      body: 'Alguém tentou criar uma conta no Waypoint com este endereço de e-mail, mas ele já tem uma. Se foi você, entre com sua senha — ou escolha uma nova na página de entrada, se tiver esquecido.',
      button: 'Entrar no Waypoint',
      note: 'Se não foi você, não precisa fazer nada: nada mudou, e ninguém consegue entrar na sua conta sem a sua senha.',
    },
    invite: {
      subject: '{inviter} convidou você para {organisation} no Waypoint',
      body: '{inviter} convidou você para ajudar a gerenciar {organisation} no Waypoint, um companheiro gratuito para as grandes mudanças da vida.',
      button: 'Ver o convite',
      note: 'Para responder, entre ou crie uma conta com este endereço de e-mail e confirme-o. O convite expira em 7 dias. Se você não esperava por ele, pode ignorar este e-mail.',
    },
    staffInvite: {
      subject: '{inviter} convidou-o para a equipa do Waypoint',
      body: '{inviter} convidou-o para se juntar às pessoas que gerem este Waypoint, como {role}.',
      button: 'Ver o convite',
      note: 'Para responder, inicie sessão ou crie uma conta com este endereço de e-mail e confirme-o. O convite expira em 7 dias. Se não o esperava, pode ignorar este e-mail.',
    },
    roles: { admin: 'administrador', staff: 'membro da equipa' },
    linkFallback: 'Se o botão não funcionar, copie este link no seu navegador:',
    footer:
      'Waypoint · ajuda grátis com trabalho, dinheiro, segurança e dias difíceis. Nunca pedimos senhas, códigos ou pagamentos por e-mail.',
  },
  ar: {
    greeting: 'مرحبًا {name}،',
    greetingNoName: 'مرحبًا،',
    someone: 'أحد الزملاء',
    verify: {
      subject: 'أكّد عنوان بريدك الإلكتروني',
      body: 'يرجى تأكيد أن هذا هو عنوان بريدك الإلكتروني في Waypoint. بعد تأكيده، يمكنك تسجيل الدخول به والرد على دعوات الانضمام إلى فريق مؤسسة.',
      button: 'تأكيد عنوان بريدي',
      note: 'يعمل الرابط لمدة 24 ساعة ويؤكد عنوانك فقط، ولا يسجّل دخولك. إن لم تنشئ حسابًا في Waypoint، فتجاهل هذه الرسالة: يُحذف الحساب الذي لا يُؤكَّد أبدًا بعد 7 أيام.',
    },
    reset: {
      subject: 'أعد تعيين كلمة مرور Waypoint',
      body: 'طلب أحدهم إعادة تعيين كلمة مرور حسابك في Waypoint. إن كنت أنت، فاختر كلمة مرور جديدة من الزر أدناه.',
      button: 'اختيار كلمة مرور جديدة',
      note: 'يعمل الرابط لمدة ساعة واحدة. إن لم تطلب ذلك، فتجاهل هذه الرسالة: تبقى كلمة مرورك كما هي.',
    },
    exists: {
      subject: 'لديك حساب في Waypoint بالفعل',
      body: 'حاول أحدهم إنشاء حساب في Waypoint بعنوان البريد هذا، لكن لديه حساب بالفعل. إن كنت أنت، فسجّل الدخول بكلمة مرورك، أو اختر كلمة مرور جديدة من صفحة تسجيل الدخول إن كنت قد نسيتها.',
      button: 'تسجيل الدخول إلى Waypoint',
      note: 'إن لم تكن أنت، فلا داعي لفعل أي شيء: لم يتغير شيء، ولا يمكن لأحد الدخول إلى حسابك دون كلمة مرورك.',
    },
    invite: {
      subject: 'دعاك {inviter} إلى {organisation} على Waypoint',
      body: 'دعاك {inviter} للمساعدة في إدارة {organisation} على Waypoint، الرفيق المجاني لتغيّرات الحياة الكبيرة.',
      button: 'عرض الدعوة',
      note: 'للرد، سجّل الدخول أو أنشئ حسابًا بعنوان البريد هذا ثم أكّده. تنتهي صلاحية الدعوة بعد 7 أيام. إن لم تكن تتوقعها، فيمكنك تجاهل هذه الرسالة.',
    },
    staffInvite: {
      subject: 'دعاك {inviter} للانضمام إلى فريق Waypoint',
      body: 'دعاك {inviter} للانضمام إلى من يديرون Waypoint هذا، بصفة {role}.',
      button: 'اطّلع على الدعوة',
      note: 'للرد، سجّل الدخول أو أنشئ حسابًا بعنوان البريد هذا وأكّده. تنتهي الدعوة خلال 7 أيام. إن لم تكن تتوقعها فيمكنك تجاهل هذه الرسالة.',
    },
    roles: { admin: 'مسؤول', staff: 'عضو في الفريق' },
    linkFallback: 'إن لم يعمل الزر، فانسخ هذا الرابط في متصفحك:',
    footer:
      'Waypoint · مساعدة مجانية في العمل والمال والأمان والأيام الصعبة. لا نطلب أبدًا كلمات مرور أو رموزًا أو مدفوعات عبر البريد الإلكتروني.',
  },
  sw: {
    greeting: 'Habari {name},',
    greetingNoName: 'Habari,',
    someone: 'Mtu',
    verify: {
      subject: 'Thibitisha anwani yako ya barua pepe',
      body: 'Tafadhali thibitisha kwamba hii ndiyo anwani yako ya barua pepe kwenye Waypoint. Ikishathibitishwa, unaweza kuingia nayo na kujibu mialiko ya kujiunga na timu ya shirika.',
      button: 'Thibitisha barua pepe yangu',
      note: 'Kiungo hufanya kazi kwa saa 24 na kinathibitisha anwani yako tu — hakikuingizi kwenye akaunti. Kama hukufungua akaunti ya Waypoint, puuza barua pepe hii: akaunti ambayo haithibitishwi kamwe hufutwa baada ya siku 7.',
    },
    reset: {
      subject: 'Weka upya nenosiri lako la Waypoint',
      body: 'Mtu ameomba kuweka upya nenosiri la akaunti yako ya Waypoint. Kama ni wewe, chagua nenosiri jipya kwa kitufe kilicho hapa chini.',
      button: 'Chagua nenosiri jipya',
      note: 'Kiungo hufanya kazi kwa saa moja. Kama hukuomba hili, puuza barua pepe hii: nenosiri lako litabaki lilivyo.',
    },
    exists: {
      subject: 'Tayari una akaunti ya Waypoint',
      body: 'Mtu amejaribu kufungua akaunti ya Waypoint kwa anwani hii ya barua pepe, lakini tayari ina akaunti. Kama ni wewe, ingia kwa nenosiri lako — au chagua jipya kwenye ukurasa wa kuingia kama umelisahau.',
      button: 'Ingia kwenye Waypoint',
      note: 'Kama si wewe, huhitaji kufanya chochote: hakuna kilichobadilika, na hakuna anayeweza kuingia kwenye akaunti yako bila nenosiri lako.',
    },
    invite: {
      subject: '{inviter} amekualika kwenye {organisation} kwenye Waypoint',
      body: '{inviter} amekualika usaidie kuendesha {organisation} kwenye Waypoint, mwenzi wa bure kwa mabadiliko makubwa ya maisha.',
      button: 'Tazama mwaliko',
      note: 'Ili kujibu, ingia au fungua akaunti kwa anwani hii ya barua pepe na uithibitishe. Mwaliko utaisha baada ya siku 7. Kama hukuutarajia, unaweza kupuuza barua pepe hii.',
    },
    staffInvite: {
      subject: '{inviter} amekualika ujiunge na wafanyakazi wa Waypoint',
      body: '{inviter} amekualika ujiunge na watu wanaoendesha Waypoint hii, kama {role}.',
      button: 'Tazama mwaliko',
      note: 'Ili kujibu, ingia au fungua akaunti kwa anwani hii ya barua pepe na uithibitishe. Mwaliko unaisha baada ya siku 7. Ikiwa hukuutarajia, unaweza kupuuza barua pepe hii.',
    },
    roles: { admin: 'msimamizi', staff: 'mfanyakazi' },
    linkFallback: 'Kama kitufe hakifanyi kazi, nakili kiungo hiki kwenye kivinjari chako:',
    footer:
      'Waypoint · msaada wa bure kuhusu kazi, pesa, usalama na siku ngumu. Hatuombi kamwe nenosiri, namba za siri au malipo kwa barua pepe.',
  },
};
