import type { ShieldText } from './index';

/** Français, vouvoiement (comme le reste de l’application). */
export const fr: ShieldText = {
  signals: {
    'pay-to-work': {
      title: 'Vous demande de payer avant de pouvoir travailler',
      explanation:
        'Un vrai employeur vous paie. Il ne vous fait jamais payer pour vous embaucher, vous former ou vous donner un emploi.',
    },
    'task-earnings': {
      title: 'Vous paie pour de simples tâches en ligne',
      explanation:
        'Les « jobs de tâches » payés pour des likes, des notes ou des avis finissent généralement par vous demander de « recharger » de l’argent que vous ne récupérez jamais.',
    },
    'earn-per-day': {
      title: 'Promet de l’argent facile chaque jour',
      explanation:
        'Des gains quotidiens garantis pour peu de travail sont l’un des appâts les plus courants des arnaques à l’emploi.',
    },
    'fee-to-receive': {
      title: 'Demande des frais pour débloquer de l’argent ou un colis',
      explanation:
        'Devoir payer de petits frais pour recevoir un colis, un gain, un prêt ou un remboursement est une arnaque classique à l’avance de frais.',
    },
    'gift-cards': {
      title: 'Veut être payé en cartes cadeaux',
      explanation:
        'Aucune vraie entreprise, administration fiscale ou police ne demande à être payée en cartes cadeaux.',
    },
    'crypto-payment': {
      title: 'Vous demande d’envoyer des cryptomonnaies',
      explanation:
        'Les paiements en crypto sont difficiles à tracer ou à annuler, c’est pourquoi les escrocs les préfèrent.',
    },
    'pin-to-receive': {
      title:
        'Vous demande de scanner un code ou de saisir votre code PIN pour recevoir de l’argent',
      explanation:
        'Vous n’avez jamais besoin de scanner un QR code ni de saisir votre PIN pour recevoir de l’argent — seulement pour en envoyer.',
    },
    overpayment: {
      title: 'Dit vous avoir trop payé et veut récupérer une partie',
      explanation:
        'Le premier paiement est souvent rejeté ou n’a jamais existé, et le « remboursement » que vous envoyez est perdu.',
    },
    'rental-deposit': {
      title: 'Veut un dépôt avant que vous puissiez visiter le logement',
      explanation:
        'Ne payez jamais un logement que vous n’avez pas vu, à un propriétaire que vous n’avez ni rencontré ni vérifié.',
    },
    'share-otp': {
      title: 'Demande un code, un PIN ou un mot de passe',
      explanation:
        'Les banques, les applis et les administrations ne demandent jamais votre code à usage unique, votre PIN ou votre mot de passe. Quiconque le fait essaie d’accéder à votre compte.',
    },
    'kyc-block': {
      title: 'Menace de bloquer votre compte si vous ne mettez pas vos informations à jour',
      explanation:
        'Les banques et les opérateurs mobiles ne ferment pas de comptes par SMS. Vérifiez dans l’appli officielle ou en agence.',
    },
    'click-to-verify': {
      title: 'Vous demande de vous connecter ou de vérifier via un lien',
      explanation:
        'Les liens reçus par message peuvent mener à des copies de vrais sites conçues pour voler votre mot de passe.',
    },
    'remote-access': {
      title: 'Veut prendre le contrôle de votre téléphone ou ordinateur à distance',
      explanation:
        'Les applis d’accès à distance permettent à un inconnu de voir votre écran et de retirer de l’argent de vos comptes.',
    },
    'install-apk': {
      title: 'Vous demande d’installer une appli reçue par message',
      explanation:
        'Les applis envoyées par message peuvent lire vos SMS et vos codes à usage unique. N’installez des applis que depuis la boutique officielle.',
    },
    deadline: {
      title: 'Vous presse',
      explanation:
        'La pression pour agir vite sert à vous empêcher de vérifier auprès de quelqu’un.',
    },
    threat: {
      title: 'Vous menace d’une sanction ou d’une coupure',
      explanation:
        'Les menaces d’arrestation, d’amende ou de coupure servent à effrayer les gens pour qu’ils paient vite.',
    },
    secrecy: {
      title: 'Vous demande de garder le secret',
      explanation:
        'Les escrocs vous isolent pour que personne ne puisse vous prévenir. Les vraies administrations et les vrais employeurs n’exigent jamais le secret.',
    },
    'digital-arrest': {
      title: 'Affirme que vous êtes en « arrestation numérique »',
      explanation:
        'L’arrestation numérique n’existe pas. La police ne retient jamais personne par appel vidéo et ne demande jamais d’argent pour régler une affaire.',
    },
    'agency-parcel': {
      title: 'Se fait passer pour la police, la douane ou une administration',
      explanation:
        'Les administrations n’appellent pas au sujet de colis saisis et ne demandent pas de payer pour vous blanchir. Raccrochez et appelez vous-même leur numéro officiel.',
    },
    'utility-cutoff': {
      title: 'Annonce que votre électricité sera coupée ce soir',
      explanation:
        'Les fournisseurs d’énergie envoient leurs avis par facture ou appli officielles, pas par SMS vous demandant d’appeler un numéro personnel.',
    },
    'tax-refund': {
      title: 'Propose un remboursement d’impôts via un lien',
      explanation:
        'Les remboursements d’impôts passent par le portail fiscal officiel, pas par des liens dans des messages.',
    },
    'gov-scheme-fee': {
      title: 'Propose une aide publique contre des frais ou via un lien',
      explanation:
        'Les demandes d’aides publiques sont gratuites sur les portails officiels. Personne n’a besoin de payer un intermédiaire.',
    },
    'guaranteed-returns': {
      title: 'Promet des rendements élevés ou garantis',
      explanation:
        'Un vrai placement peut perdre de l’argent. Des rendements élevés garantis sont la signature de la fraude à l’investissement.',
    },
    prize: {
      title: 'Dit que vous avez gagné un prix à un jeu auquel vous n’avez pas participé',
      explanation:
        'On ne peut pas gagner une loterie ou un tirage auquel on n’a pas participé. Les arnaques au gain se terminent par des « frais » pour le récupérer.',
    },
    'instant-loan': {
      title: 'Propose un prêt instantané sans vérification',
      explanation:
        'Les applis de prêt non agréées facturent souvent des frais cachés et harcèlent les emprunteurs. Passez par des prêteurs agréés par la banque centrale.',
    },
    'family-new-number': {
      title: 'Prétend être un proche avec un nouveau numéro',
      explanation:
        'Les escrocs se font passer pour un proche avec un nouveau téléphone qui a besoin d’argent en urgence. Appelez-le sur le numéro que vous connaissez déjà.',
    },
    'romance-money': {
      title: 'Une personne rencontrée en ligne a besoin d’argent',
      explanation:
        'N’envoyez jamais d’argent à quelqu’un que vous n’avez pas rencontré en personne, même si la relation semble sincère.',
    },
    sextortion: {
      title: 'Menace de diffuser des photos ou vidéos intimes',
      explanation:
        'Ne payez pas — payer entraîne généralement d’autres demandes. Arrêtez de répondre, gardez les preuves et signalez-le.',
    },
    'voice-clone': {
      title: 'Un appel urgent avec la voix d’un proche',
      explanation:
        'Les voix peuvent désormais être copiées par l’IA. Raccrochez et rappelez un numéro que vous connaissez, ou demandez le mot de code familial.',
    },
    'move-to-chat': {
      title: 'Déplace la conversation vers une messagerie privée',
      explanation:
        'Les escrocs vous font quitter les plateformes officielles pour des endroits moins protégés et sans trace.',
    },
    'charity-urgent': {
      title: 'Don urgent sur un compte personnel',
      explanation:
        'Donnez via le site officiel d’associations reconnues, jamais sur des comptes personnels partagés par message.',
    },
    'virus-alert': {
      title: 'Prétend que votre appareil a un virus',
      explanation:
        'Les vraies entreprises ne vous écrivent pas et ne vous appellent pas au sujet de virus. Fermez la page et n’appelez pas le numéro affiché.',
    },
    'delivery-problem': {
      title: 'Dit qu’une livraison a échoué ou est bloquée',
      explanation:
        'Les faux messages de livraison mènent à des pages de paiement. Suivez vos colis uniquement dans l’appli ou sur le site officiel du transporteur.',
    },
    'combo-authority-secrecy': {
      title: 'Menace d’allure officielle et exigence de secret',
      explanation:
        'Cela correspond au schéma de l’« arrestation numérique » : un faux agent, une accusation effrayante et l’ordre de n’en parler à personne.',
    },
    'combo-credentials-link': {
      title: 'Une menace et un lien pour « régler le problème »',
      explanation:
        'Faire peur d’abord, envoyer un lien ensuite : c’est la recette d’hameçonnage la plus courante.',
    },
    inheritance: {
      title: 'Dit que vous héritez d’une fortune',
      explanation:
        'Les héritages inattendus venant d’inconnus se terminent par des « frais » ou des taxes pour débloquer un argent qui n’arrive jamais.',
    },
    'combo-delivery-link': {
      title: 'Un problème de livraison avec un lien pour le régler',
      explanation:
        'Les transporteurs n’envoient presque jamais de lien pour payer ou corriger votre adresse. Suivez le colis dans l’application ou sur le site officiel du transporteur.',
    },
    'combo-job-chat': {
      title: 'De l’argent facile proposé par messagerie',
      explanation:
        'Les offres d’emploi non sollicitées avec paiement quotidien sur WhatsApp ou Telegram sont presque toujours des arnaques aux tâches.',
    },
    'link-lookalike': {
      title: 'Le lien imite un site connu',
      titleBrand: 'Le lien imite {brand}',
      explanation:
        'L’adresse ressemble à celle d’une vraie marque, mais ce n’est pas son site officiel.',
    },
    'link-ip-host': {
      title: 'Le lien est un simple numéro, pas un nom',
      explanation:
        'Les vraies entreprises utilisent des sites avec un nom, pas des adresses numériques.',
    },
    'link-punycode': {
      title: 'Le lien utilise des lettres trompeuses',
      explanation:
        'Des caractères spéciaux peuvent rendre une fausse adresse identique à une vraie.',
    },
    'link-at-sign': {
      title: 'Le lien cache sa vraie destination',
      explanation:
        'Un « @ » dans une adresse web peut vous envoyer ailleurs que vers le nom affiché.',
    },
    'link-data-uri': {
      title: 'Le lien contient une page cachée',
      explanation:
        'Ce lien transporte une page web entière, une astuce pour échapper à la détection.',
    },
    'link-file-download': {
      title: 'Le lien télécharge une appli ou un programme',
      explanation:
        'Les applis téléchargées via un lien peuvent lire vos messages et vos codes. N’installez que depuis la boutique officielle.',
    },
    'link-shortener': {
      title: 'Le lien est raccourci',
      explanation:
        'Les liens courts cachent leur destination. Les escrocs s’en servent pour masquer de faux sites.',
    },
    'link-suspicious-tld': {
      title: 'Le lien se termine par un domaine inhabituel',
      explanation: 'Ce type d’adresse sert souvent à des sites d’arnaque éphémères.',
    },
    'link-free-hosting': {
      title: 'Le lien est hébergé sur un créateur de sites gratuit',
      explanation:
        'N’importe qui peut créer ces pages en quelques minutes ; les banques et les administrations ne les utilisent pas.',
    },
    'link-messaging-redirect': {
      title: 'Le lien ouvre une conversation privée',
      explanation: 'Le lien vous envoie sur WhatsApp ou Telegram avec un compte inconnu.',
    },
    'link-many-subdomains': {
      title: 'Le lien comporte une longue chaîne de noms',
      explanation:
        'Une longue chaîne peut placer un nom de confiance au début d’une adresse qui ne l’est pas.',
    },
    'link-insecure-http': {
      title: 'Le lien n’est pas sécurisé',
      explanation: 'La page n’utilise pas de connexion chiffrée.',
    },
    'link-very-long': {
      title: 'Le lien est anormalement long',
      explanation: 'Les liens très longs peuvent cacher du pistage ou une adresse déguisée.',
    },
    'free-mail-official': {
      title: 'Nom d’allure officielle sur une adresse e-mail gratuite',
      explanation:
        'Les banques, employeurs et administrations écrivent depuis leur propre domaine, pas depuis Gmail ou Yahoo.',
    },
    'foreign-number': {
      title: 'Le numéro vient d’un autre pays',
      explanation:
        'Les messages d’emploi ou de gain venant de numéros étrangers inattendus sont un schéma d’arnaque courant.',
    },
    'hidden-instructions': {
      title: 'Contient des instructions destinées à un outil de vérification, pas à vous',
      explanation:
        'Un vrai message est écrit pour la personne qui le lit. Un texte qui dit à un ordinateur comment évaluer le message cherche à échapper aux vérifications.',
    },
  },
  advice: {
    'check-anyway':
      'Nous n’avons pas trouvé de signes d’arnaque courants. Si le message demande de l’argent, des codes ou d’agir vite, vérifiez d’abord auprès d’une personne de confiance.',
    pause:
      'Prenez le temps avant de répondre, de cliquer ou de payer. Les arnaques misent sur la précipitation.',
    'verify-independently':
      'Vérifiez vous-même l’expéditeur : utilisez l’appli officielle, le site ou le numéro que vous connaissez déjà, pas les coordonnées du message.',
    'dont-engage': 'Ne répondez pas, n’ouvrez pas les liens et ne payez pas.',
    'block-report': 'Bloquez l’expéditeur et signalez-le (voir où signaler ci-dessous).',
    'if-paid':
      'Vous avez déjà payé ou donné des informations ? Appelez votre banque maintenant pour bloquer le paiement, changez vos mots de passe et signalez-le vite : agir tôt augmente les chances de récupérer l’argent.',
    'cat-job':
      'Un vrai employeur ne vous demande jamais de payer pour un emploi, une formation ou un « kit ».',
    'cat-bank-kyc':
      'Votre banque ne vous demandera jamais votre PIN, votre mot de passe ou un code à usage unique, et ne fermera pas votre compte par SMS. Appelez le numéro au dos de votre carte.',
    'cat-delivery':
      'Suivez vos livraisons uniquement dans l’appli ou sur le site officiel du transporteur. Les transporteurs ne réclament pas de petits frais par SMS.',
    'cat-investment':
      'Des rendements élevés garantis sont un signal d’alerte. Vérifiez l’entreprise auprès de votre autorité financière avant d’investir.',
    'cat-crypto':
      'Les paiements en crypto sont irréversibles. N’envoyez pas de crypto à quelqu’un qui vous a contacté en premier.',
    'cat-lottery-prize':
      'On ne peut pas gagner un tirage auquel on n’a pas participé. Ne payez jamais de frais pour récupérer un gain.',
    'cat-romance':
      'N’envoyez jamais d’argent à quelqu’un que vous n’avez pas rencontré en personne, même si vous vous sentez proche.',
    'cat-sextortion':
      'Ne payez pas — payer entraîne généralement d’autres demandes. Arrêtez de répondre, conservez les preuves et signalez-le. Vous n’avez rien fait de mal.',
    'cat-tech-support':
      'N’installez pas d’appli d’accès à distance et n’achetez pas de cartes cadeaux à la demande d’un appelant. Les vraies entreprises ne vous appellent pas pour des virus.',
    'cat-impersonation-authority':
      'Raccrochez. Appelez l’administration sur son numéro officiel, que vous cherchez vous-même.',
    'cat-digital-arrest':
      'L’« arrestation numérique » n’existe pas. La police ne retient jamais personne par appel vidéo et ne demande pas d’argent pour régler une affaire. Raccrochez et appelez la police locale.',
    'cat-loan-app':
      'N’empruntez qu’auprès de prêteurs agréés par la banque centrale. Ne donnez pas aux applis l’accès à vos contacts ou à vos photos.',
    'cat-utility-disconnection':
      'Payez vos factures uniquement via l’appli, le site ou l’agence officiels. Les fournisseurs d’énergie ne vous demandent pas d’appeler des numéros personnels.',
    'cat-tax-refund':
      'Demandez vos remboursements d’impôts uniquement sur le site officiel des impôts, en tapant l’adresse vous-même.',
    'cat-government-scheme':
      'Les demandes d’aides publiques sont gratuites sur les portails officiels. Ne payez jamais d’intermédiaire.',
    'cat-family-emergency':
      'Avant d’envoyer quoi que ce soit, appelez votre proche sur le numéro que vous avez déjà.',
    'cat-marketplace':
      'Ne remboursez pas un « trop-perçu ». Attendez que l’argent soit réellement arrivé sur votre compte.',
    'cat-rental':
      'Ne versez jamais de dépôt avant d’avoir visité le logement et vérifié qui en est le propriétaire.',
    'cat-charity':
      'Donnez via le site officiel d’une association reconnue, pas sur un compte personnel.',
    'cat-phishing-link': 'N’ouvrez pas le lien. Tapez vous-même l’adresse du site officiel.',
    'cat-sim-swap-otp':
      'Ne partagez jamais de codes à usage unique. Si votre téléphone perd soudain le réseau, appelez immédiatement votre opérateur.',
    'cat-qr-code':
      'Vous n’avez jamais besoin de scanner un code ni de saisir votre PIN pour recevoir de l’argent.',
    'cat-deepfake-voice':
      'Raccrochez et rappelez un numéro que vous connaissez. Convenez en famille d’un mot de code pour les urgences.',
  },
  aiExplanation: 'Signalé par la vérification IA, qui analyse le message entier dans son contexte.',
};
