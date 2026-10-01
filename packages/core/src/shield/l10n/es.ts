import type { ShieldText } from './index';

/** Español neutro, tuteo (como el resto de la app). */
export const es: ShieldText = {
  signals: {
    'pay-to-work': {
      title: 'Te pide pagar antes de empezar a trabajar',
      explanation:
        'Los empleadores reales te pagan a ti. Nunca cobran por contratarte, capacitarte o darte un empleo.',
    },
    'task-earnings': {
      title: 'Te paga por tareas sencillas en línea',
      explanation:
        'Los trabajos de tareas que pagan por «me gusta», calificaciones o reseñas suelen terminar pidiéndote «recargar» dinero que nunca recuperas.',
    },
    'earn-per-day': {
      title: 'Promete dinero fácil todos los días',
      explanation:
        'Las ganancias diarias garantizadas por poco trabajo son uno de los ganchos más comunes de las estafas de empleo.',
    },
    'fee-to-receive': {
      title: 'Pide una tarifa para liberar dinero o un paquete',
      explanation:
        'Que te pidan pagar una pequeña tarifa para recibir un paquete, premio, préstamo o reembolso es una estafa clásica de pago por adelantado.',
    },
    'gift-cards': {
      title: 'Quiere el pago en tarjetas de regalo',
      explanation:
        'Ningún negocio real, oficina de impuestos ni policía pide que le paguen con tarjetas de regalo.',
    },
    'crypto-payment': {
      title: 'Te pide enviar criptomonedas',
      explanation:
        'Los pagos en cripto son difíciles de rastrear o revertir; por eso los estafadores los prefieren.',
    },
    'pin-to-receive': {
      title: 'Te pide escanear un código o ingresar tu PIN para recibir dinero',
      explanation:
        'Nunca necesitas escanear un código QR ni ingresar tu PIN para recibir dinero: solo para enviarlo.',
    },
    overpayment: {
      title: 'Dice que te pagó de más y quiere que devuelvas una parte',
      explanation:
        'El primer pago suele rebotar o nunca fue real, y el «reembolso» que envías se pierde.',
    },
    'rental-deposit': {
      title: 'Quiere un depósito antes de que veas el lugar',
      explanation:
        'Nunca pagues por un alquiler que no has visto, a un arrendador al que no conoces ni has verificado.',
    },
    'share-otp': {
      title: 'Pide un código, PIN o contraseña',
      explanation:
        'Los bancos, las apps y las autoridades nunca piden tu código de un solo uso, PIN o contraseña. Quien lo hace intenta entrar en tu cuenta.',
    },
    'kyc-block': {
      title: 'Amenaza con bloquear tu cuenta si no actualizas tus datos',
      explanation:
        'Los bancos y las operadoras móviles no cierran cuentas por mensaje de texto. Verifica en la app oficial o en una sucursal.',
    },
    'click-to-verify': {
      title: 'Te pide iniciar sesión o verificar mediante un enlace',
      explanation:
        'Los enlaces en mensajes pueden llevar a copias de sitios reales hechas para robar tu contraseña.',
    },
    'remote-access': {
      title: 'Quiere controlar tu teléfono o computadora a distancia',
      explanation:
        'Las apps de acceso remoto permiten a un desconocido ver tu pantalla y mover dinero de tus cuentas.',
    },
    'install-apk': {
      title: 'Te pide instalar una app desde un mensaje',
      explanation:
        'Las apps enviadas por mensaje pueden leer tus SMS y códigos de un solo uso. Instala apps solo desde la tienda oficial.',
    },
    deadline: {
      title: 'Te apresura',
      explanation: 'La presión para actuar rápido busca impedir que lo consultes con alguien.',
    },
    threat: {
      title: 'Te amenaza con una multa o un corte',
      explanation:
        'Las amenazas de arresto, multas o cortes de servicio se usan para asustar a la gente y que pague rápido.',
    },
    secrecy: {
      title: 'Te pide que lo mantengas en secreto',
      explanation:
        'Los estafadores te aíslan para que nadie pueda advertirte. Las autoridades y los empleadores reales nunca exigen secreto.',
    },
    'digital-arrest': {
      title: 'Dice que estás bajo «arresto digital»',
      explanation:
        'El arresto digital no existe. La policía nunca retiene a nadie por videollamada ni pide dinero para resolver un caso.',
    },
    'agency-parcel': {
      title: 'Se hace pasar por la policía, la aduana o una agencia del gobierno',
      explanation:
        'Las agencias no llaman por paquetes incautados ni piden pagos para limpiar tu nombre. Cuelga y llama tú mismo al número oficial de la agencia.',
    },
    'utility-cutoff': {
      title: 'Dice que esta noche te cortarán la luz',
      explanation:
        'Las compañías eléctricas avisan por facturas y apps oficiales, no con mensajes que te piden llamar a un número personal.',
    },
    'tax-refund': {
      title: 'Ofrece una devolución de impuestos mediante un enlace',
      explanation:
        'Las devoluciones de impuestos se gestionan en el portal oficial de impuestos, no con enlaces en mensajes.',
    },
    'gov-scheme-fee': {
      title: 'Ofrece un beneficio del gobierno a cambio de una tarifa o por un enlace',
      explanation:
        'Solicitar programas del gobierno es gratis en los portales oficiales. Nadie necesita pagarle a un intermediario.',
    },
    'guaranteed-returns': {
      title: 'Promete ganancias altas o garantizadas',
      explanation:
        'Las inversiones reales pueden perder dinero. Las ganancias altas garantizadas son la firma del fraude de inversión.',
    },
    prize: {
      title: 'Dice que ganaste un premio en el que no participaste',
      explanation:
        'No puedes ganar una lotería o un sorteo en el que nunca participaste. Las estafas de premios terminan pidiendo una «tarifa» para cobrarlo.',
    },
    'instant-loan': {
      title: 'Ofrece un préstamo instantáneo sin verificaciones',
      explanation:
        'Las apps de préstamos no registradas suelen cobrar comisiones ocultas y acosar a quienes piden prestado. Usa prestamistas registrados ante el banco central.',
    },
    'family-new-number': {
      title: 'Dice ser un familiar con un número nuevo',
      explanation:
        'Los estafadores se hacen pasar por un familiar con un teléfono nuevo que necesita dinero con urgencia. Llámalo al número que ya conoces.',
    },
    'romance-money': {
      title: 'Alguien que conociste en línea necesita dinero',
      explanation:
        'Nunca envíes dinero a alguien que no conoces en persona, por muy real que parezca la relación.',
    },
    sextortion: {
      title: 'Amenaza con compartir fotos o videos privados',
      explanation:
        'No pagues: pagar suele traer más exigencias. Deja de responder, guarda las pruebas y denúncialo.',
    },
    'voice-clone': {
      title: 'Una llamada urgente con la voz de un ser querido',
      explanation:
        'Hoy las voces se pueden copiar con IA. Cuelga y vuelve a llamar a un número que conozcas, o pregunta la palabra clave familiar.',
    },
    'move-to-chat': {
      title: 'Lleva la conversación a una app de chat privada',
      explanation:
        'Los estafadores te sacan de las plataformas oficiales hacia lugares con menos protección y sin registro.',
    },
    'charity-urgent': {
      title: 'Donación urgente a una cuenta personal',
      explanation:
        'Dona en el sitio web oficial de organizaciones benéficas registradas, nunca a cuentas personales compartidas por mensaje.',
    },
    'virus-alert': {
      title: 'Dice que tu dispositivo tiene un virus',
      explanation:
        'Las empresas reales no te escriben ni te llaman por virus. Cierra la página y no llames al número que aparece.',
    },
    'delivery-problem': {
      title: 'Dice que una entrega falló o está retenida',
      explanation:
        'Los mensajes falsos de entrega llevan a páginas de pago. Consulta tus envíos solo en la app o el sitio web oficial de la paquetería.',
    },
    'combo-authority-secrecy': {
      title: 'Amenaza con tono oficial y exigencia de secreto',
      explanation:
        'Coincide con el patrón del «arresto digital»: un agente falso, una acusación que asusta y la orden de no contárselo a nadie.',
    },
    'combo-credentials-link': {
      title: 'Una amenaza más un enlace para «solucionarla»',
      explanation: 'Primero asustar y después enviar un enlace es la receta de phishing más común.',
    },
    inheritance: {
      title: 'Dice que heredaste una fortuna',
      explanation:
        'Las herencias inesperadas de desconocidos terminan pidiendo «gastos» o impuestos para liberar un dinero que nunca llega.',
    },
    'combo-delivery-link': {
      title: 'Un problema de entrega con un enlace para resolverlo',
      explanation:
        'Las empresas de mensajería casi nunca envían un enlace para pagar o corregir tu dirección. Revisa el paquete en la app o la web oficial de la empresa.',
    },
    'combo-job-chat': {
      title: 'Dinero fácil ofrecido por una app de chat',
      explanation:
        'Las ofertas de empleo no solicitadas con pago diario por WhatsApp o Telegram casi siempre son estafas de tareas.',
    },
    'link-lookalike': {
      title: 'El enlace imita un sitio web conocido',
      titleBrand: 'El enlace imita a {brand}',
      explanation: 'La dirección se parece a la de una marca real, pero no es su sitio oficial.',
    },
    'link-ip-host': {
      title: 'El enlace es un número, no un nombre',
      explanation: 'Las empresas reales usan sitios con nombre, no direcciones numéricas.',
    },
    'link-punycode': {
      title: 'El enlace usa letras que imitan a otras',
      explanation:
        'Algunos caracteres especiales hacen que una dirección falsa se vea idéntica a una real.',
    },
    'link-at-sign': {
      title: 'El enlace oculta su destino real',
      explanation:
        'Una «@» en una dirección web puede llevarte a un sitio distinto del nombre que ves.',
    },
    'link-data-uri': {
      title: 'El enlace contiene una página oculta',
      explanation:
        'Este enlace lleva una página web completa dentro, un truco para evitar ser detectado.',
    },
    'link-file-download': {
      title: 'El enlace descarga una app o un programa',
      explanation:
        'Las apps descargadas desde enlaces pueden leer tus mensajes y códigos. Instala solo desde la tienda oficial.',
    },
    'link-shortener': {
      title: 'El enlace está acortado',
      explanation:
        'Los enlaces cortos ocultan adónde llevan. Los estafadores los usan para disfrazar sitios falsos.',
    },
    'link-suspicious-tld': {
      title: 'El enlace termina en un dominio poco común',
      explanation:
        'Este tipo de dirección se usa a menudo para sitios de estafa de corta duración.',
    },
    'link-free-hosting': {
      title: 'El enlace está en un creador de sitios gratuito',
      explanation:
        'Cualquiera puede crear estas páginas en minutos; los bancos y los gobiernos no las usan.',
    },
    'link-messaging-redirect': {
      title: 'El enlace abre un chat privado',
      explanation: 'El enlace te lleva a WhatsApp o Telegram con una cuenta desconocida.',
    },
    'link-many-subdomains': {
      title: 'El enlace tiene una larga cadena de nombres',
      explanation:
        'Las cadenas largas pueden poner un nombre confiable al inicio de una dirección que no lo es.',
    },
    'link-insecure-http': {
      title: 'El enlace no es seguro',
      explanation: 'La página no usa una conexión cifrada.',
    },
    'link-very-long': {
      title: 'El enlace es inusualmente largo',
      explanation: 'Los enlaces muy largos pueden ocultar rastreo o una dirección disfrazada.',
    },
    'free-mail-official': {
      title: 'Nombre con apariencia oficial en un correo gratuito',
      explanation:
        'Los bancos, empleadores y agencias envían correos desde su propio dominio, no desde Gmail o Yahoo.',
    },
    'foreign-number': {
      title: 'El número es de otro país',
      explanation:
        'Los mensajes de empleo y premios desde números internacionales inesperados son un patrón común de estafa.',
    },
    'hidden-instructions': {
      title: 'Contiene instrucciones dirigidas a una herramienta de revisión, no a ti',
      explanation:
        'Un mensaje real está escrito para quien lo lee. Un texto que le dice a una computadora cómo calificar el mensaje intenta esquivar las revisiones.',
    },
  },
  advice: {
    'check-anyway':
      'No encontramos señales comunes de estafa. Si te pide dinero, códigos o actuar rápido, consúltalo primero con alguien de confianza.',
    pause:
      'Haz una pausa antes de responder, hacer clic o pagar. Las estafas dependen de la prisa.',
    'verify-independently':
      'Verifica tú mismo quién lo envía: usa la app oficial, el sitio web o el número de teléfono que ya conoces, no los datos del mensaje.',
    'dont-engage': 'No respondas, no abras los enlaces y no pagues.',
    'block-report': 'Bloquea al remitente y denúncialo (abajo verás dónde).',
    'if-paid':
      '¿Ya pagaste o compartiste datos? Llama ahora a tu banco para detener el pago, cambia tus contraseñas y denúncialo rápido: actuar pronto aumenta la posibilidad de recuperar el dinero.',
    'cat-job':
      'Los empleadores reales nunca te piden pagar por un empleo, una capacitación o un «kit».',
    'cat-bank-kyc':
      'Tu banco nunca te pedirá tu PIN, contraseña o código de un solo uso, ni cerrará tu cuenta por mensaje. Llama al número que aparece al reverso de tu tarjeta.',
    'cat-delivery':
      'Consulta tus envíos solo en la app o el sitio oficial de la paquetería. Las paqueterías no piden pequeñas tarifas por mensaje.',
    'cat-investment':
      'Las ganancias altas garantizadas son una señal de alerta. Verifica la empresa con el regulador financiero antes de invertir.',
    'cat-crypto':
      'Los pagos en cripto no se pueden revertir. No envíes cripto a nadie que te haya contactado primero.',
    'cat-lottery-prize':
      'No puedes ganar un sorteo en el que no participaste. Nunca pagues para cobrar un premio.',
    'cat-romance':
      'Nunca envíes dinero a alguien que no conoces en persona, por muy cercano que lo sientas.',
    'cat-sextortion':
      'No pagues: pagar suele traer más exigencias. Deja de responder, guarda las pruebas y denúncialo. No has hecho nada malo.',
    'cat-tech-support':
      'No instales apps de acceso remoto ni compres tarjetas de regalo para quien te llama. Las empresas reales no te llaman por virus.',
    'cat-impersonation-authority':
      'Cuelga. Llama a la agencia a su número oficial, que tú mismo busques.',
    'cat-digital-arrest':
      'El «arresto digital» no existe. La policía nunca retiene a nadie por videollamada ni pide dinero para resolver un caso. Cuelga y llama a la policía local.',
    'cat-loan-app':
      'Pide prestado solo a prestamistas registrados ante el banco central. No des a las apps acceso a tus contactos o fotos.',
    'cat-utility-disconnection':
      'Paga tus facturas solo por la app, el sitio web o la oficina oficiales. Las compañías eléctricas no te piden llamar a números personales.',
    'cat-tax-refund':
      'Solicita devoluciones de impuestos solo en el sitio oficial de impuestos, escribiendo tú mismo la dirección.',
    'cat-government-scheme':
      'Solicitar programas del gobierno es gratis en los portales oficiales. Nunca le pagues a un intermediario.',
    'cat-family-emergency': 'Antes de enviar nada, llama a tu familiar al número que ya tienes.',
    'cat-marketplace':
      'No devuelvas «pagos de más». Espera a que el dinero se haya acreditado de verdad en tu cuenta.',
    'cat-rental': 'Nunca pagues un depósito antes de ver el lugar y comprobar quién es el dueño.',
    'cat-charity':
      'Dona en el sitio web oficial de una organización benéfica registrada, no a una cuenta personal.',
    'cat-phishing-link': 'No abras el enlace. Escribe tú mismo la dirección del sitio oficial.',
    'cat-sim-swap-otp':
      'Nunca compartas códigos de un solo uso. Si tu teléfono pierde la señal de repente, llama de inmediato a tu operadora.',
    'cat-qr-code': 'Nunca necesitas escanear un código ni ingresar tu PIN para recibir dinero.',
    'cat-deepfake-voice':
      'Cuelga y vuelve a llamar a un número que conozcas. Acuerden en familia una palabra clave para emergencias.',
  },
  aiExplanation: 'Señalado por la revisión con IA, que analiza todo el mensaje en contexto.',
};
