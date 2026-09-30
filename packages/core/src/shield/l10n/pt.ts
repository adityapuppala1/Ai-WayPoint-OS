import type { ShieldText } from './index';

/** Português do Brasil, “você” (como o resto do app). */
export const pt: ShieldText = {
  signals: {
    'pay-to-work': {
      title: 'Pede que você pague antes de começar a trabalhar',
      explanation:
        'Empregadores de verdade pagam você. Eles nunca cobram taxa para contratar, treinar ou dar um emprego.',
    },
    'task-earnings': {
      title: 'Paga por tarefas simples on-line',
      explanation:
        'Trabalhos de tarefas que pagam por curtidas, avaliações ou comentários costumam terminar pedindo para você “recarregar” dinheiro que nunca volta.',
    },
    'earn-per-day': {
      title: 'Promete dinheiro fácil todos os dias',
      explanation:
        'Ganhos diários garantidos por pouco trabalho são uma das iscas mais comuns dos golpes de emprego.',
    },
    'fee-to-receive': {
      title: 'Cobra uma taxa para liberar dinheiro ou uma encomenda',
      explanation:
        'Pagar uma pequena taxa para receber uma encomenda, prêmio, empréstimo ou reembolso é um golpe clássico de pagamento antecipado.',
    },
    'gift-cards': {
      title: 'Quer pagamento em cartões-presente',
      explanation:
        'Nenhuma empresa real, órgão de impostos ou polícia pede pagamento em cartões-presente.',
    },
    'crypto-payment': {
      title: 'Pede que você envie criptomoedas',
      explanation:
        'Pagamentos em cripto são difíceis de rastrear ou desfazer, por isso os golpistas preferem.',
    },
    'pin-to-receive': {
      title: 'Pede para escanear um código ou digitar sua senha para receber dinheiro',
      explanation:
        'Você nunca precisa escanear um QR code nem digitar sua senha para receber dinheiro — só para enviar.',
    },
    overpayment: {
      title: 'Diz que pagou a mais e quer parte de volta',
      explanation:
        'O primeiro pagamento costuma ser estornado ou nunca existiu, e o “reembolso” que você envia se perde.',
    },
    'rental-deposit': {
      title: 'Quer um depósito antes de você ver o imóvel',
      explanation:
        'Nunca pague por um aluguel que você não viu, a um proprietário que você não conheceu nem verificou.',
    },
    'share-otp': {
      title: 'Pede um código, senha ou PIN',
      explanation:
        'Bancos, aplicativos e órgãos oficiais nunca pedem seu código de verificação, senha ou PIN. Quem pede está tentando entrar na sua conta.',
    },
    'kyc-block': {
      title: 'Ameaça bloquear sua conta se você não atualizar os dados',
      explanation:
        'Bancos e operadoras não encerram contas por SMS. Confira pelo aplicativo oficial ou na agência.',
    },
    'click-to-verify': {
      title: 'Pede para você entrar ou confirmar dados por um link',
      explanation:
        'Links em mensagens podem levar a cópias de sites reais feitas para roubar sua senha.',
    },
    'remote-access': {
      title: 'Quer controlar seu celular ou computador a distância',
      explanation:
        'Aplicativos de acesso remoto deixam um estranho ver sua tela e movimentar dinheiro das suas contas.',
    },
    'install-apk': {
      title: 'Pede para instalar um aplicativo enviado por mensagem',
      explanation:
        'Aplicativos enviados por mensagem podem ler seus SMS e códigos de verificação. Instale apps só pela loja oficial.',
    },
    deadline: {
      title: 'Apressa você',
      explanation: 'A pressão para agir rápido serve para impedir que você confira com alguém.',
    },
    threat: {
      title: 'Ameaça com multa ou corte',
      explanation:
        'Ameaças de prisão, multa ou corte de serviço são usadas para assustar as pessoas e fazê-las pagar rápido.',
    },
    secrecy: {
      title: 'Pede para você manter segredo',
      explanation:
        'Golpistas isolam você para que ninguém possa alertar. Autoridades e empregadores de verdade nunca exigem segredo.',
    },
    'digital-arrest': {
      title: 'Diz que você está em “prisão digital”',
      explanation:
        'Prisão digital não existe. A polícia nunca mantém ninguém em chamada de vídeo nem pede dinheiro para resolver um caso.',
    },
    'agency-parcel': {
      title: 'Finge ser da polícia, da alfândega ou de um órgão do governo',
      explanation:
        'Órgãos públicos não ligam sobre encomendas apreendidas nem pedem pagamento para “limpar seu nome”. Desligue e ligue você mesmo para o número oficial.',
    },
    'utility-cutoff': {
      title: 'Diz que sua luz será cortada hoje à noite',
      explanation:
        'As distribuidoras de energia avisam por contas e aplicativos oficiais, não por mensagens pedindo que você ligue para um número pessoal.',
    },
    'tax-refund': {
      title: 'Oferece restituição de imposto por um link',
      explanation:
        'Restituições de imposto são feitas pelo portal oficial da Receita, não por links em mensagens.',
    },
    'gov-scheme-fee': {
      title: 'Oferece um benefício do governo mediante taxa ou por um link',
      explanation:
        'Inscrever-se em programas do governo é gratuito nos portais oficiais. Ninguém precisa pagar um intermediário.',
    },
    'guaranteed-returns': {
      title: 'Promete retorno alto ou garantido',
      explanation:
        'Investimentos de verdade podem dar prejuízo. Retorno alto garantido é a marca registrada da fraude de investimento.',
    },
    prize: {
      title: 'Diz que você ganhou um prêmio de um sorteio do qual não participou',
      explanation:
        'Você não pode ganhar uma loteria ou sorteio de que nunca participou. Golpes de prêmio terminam pedindo uma “taxa” para liberar.',
    },
    'instant-loan': {
      title: 'Oferece empréstimo na hora, sem análise',
      explanation:
        'Aplicativos de empréstimo não autorizados costumam cobrar taxas escondidas e assediar quem pega emprestado. Use instituições autorizadas pelo banco central.',
    },
    'family-new-number': {
      title: 'Diz ser um familiar com número novo',
      explanation:
        'Golpistas fingem ser um parente com celular novo que precisa de dinheiro com urgência. Ligue para o número que você já conhece.',
    },
    'romance-money': {
      title: 'Alguém que você conheceu on-line precisa de dinheiro',
      explanation:
        'Nunca envie dinheiro para alguém que você não conheceu pessoalmente, por mais real que a relação pareça.',
    },
    sextortion: {
      title: 'Ameaça divulgar fotos ou vídeos íntimos',
      explanation:
        'Não pague — pagar costuma trazer mais exigências. Pare de responder, guarde as provas e denuncie.',
    },
    'voice-clone': {
      title: 'Uma ligação urgente com a voz de alguém querido',
      explanation:
        'Hoje é possível copiar vozes com IA. Desligue e ligue de volta para um número que você conhece, ou pergunte a palavra-código da família.',
    },
    'move-to-chat': {
      title: 'Leva a conversa para um aplicativo de mensagens privado',
      explanation:
        'Golpistas tiram você das plataformas oficiais e levam para lugares com menos proteção e sem registro.',
    },
    'charity-urgent': {
      title: 'Doação urgente para uma conta pessoal',
      explanation:
        'Doe pelo site oficial de instituições registradas, nunca para contas pessoais enviadas por mensagem.',
    },
    'virus-alert': {
      title: 'Diz que seu aparelho está com vírus',
      explanation:
        'Empresas de verdade não mandam mensagem nem ligam por causa de vírus. Feche a página e não ligue para o número exibido.',
    },
    'delivery-problem': {
      title: 'Diz que uma entrega falhou ou está retida',
      explanation:
        'Mensagens falsas de entrega levam a páginas de pagamento. Acompanhe entregas só no aplicativo ou site oficial da transportadora.',
    },
    'combo-authority-secrecy': {
      title: 'Ameaça em tom oficial e pedido de segredo',
      explanation:
        'Isso segue o padrão da “prisão digital”: um falso agente, uma acusação assustadora e ordens para não contar a ninguém.',
    },
    'combo-credentials-link': {
      title: 'Uma ameaça e um link para “resolver”',
      explanation: 'Assustar primeiro e mandar o link depois é a receita de phishing mais comum.',
    },
    inheritance: {
      title: 'Diz que você herdou uma fortuna',
      explanation:
        'Heranças inesperadas de desconhecidos terminam com pedidos de “taxas” ou impostos para liberar um dinheiro que nunca chega.',
    },
    'combo-delivery-link': {
      title: 'Um problema na entrega com um link para resolver',
      explanation:
        'Transportadoras quase nunca mandam link para pagar ou corrigir o endereço. Confira a encomenda no app ou no site oficial da transportadora.',
    },
    'combo-job-chat': {
      title: 'Dinheiro fácil oferecido por aplicativo de mensagens',
      explanation:
        'Ofertas de emprego não solicitadas com pagamento diário pelo WhatsApp ou Telegram quase sempre são golpes de tarefas.',
    },
    'link-lookalike': {
      title: 'O link imita um site conhecido',
      titleBrand: 'O link imita {brand}',
      explanation: 'O endereço parece o de uma marca real, mas não é o site oficial.',
    },
    'link-ip-host': {
      title: 'O link é só um número, não um nome',
      explanation: 'Empresas de verdade usam sites com nome, não endereços numéricos.',
    },
    'link-punycode': {
      title: 'O link usa letras que imitam outras',
      explanation: 'Caracteres especiais podem deixar um endereço falso idêntico a um real.',
    },
    'link-at-sign': {
      title: 'O link esconde o destino real',
      explanation: 'Um “@” no endereço pode levar você a outro lugar que não o nome exibido.',
    },
    'link-data-uri': {
      title: 'O link contém uma página escondida',
      explanation:
        'Este link carrega uma página inteira dentro dele, um truque para evitar detecção.',
    },
    'link-file-download': {
      title: 'O link baixa um aplicativo ou programa',
      explanation:
        'Aplicativos baixados por links podem ler suas mensagens e códigos. Instale só pela loja oficial.',
    },
    'link-shortener': {
      title: 'O link está encurtado',
      explanation:
        'Links curtos escondem para onde levam. Golpistas os usam para disfarçar sites falsos.',
    },
    'link-suspicious-tld': {
      title: 'O link termina em um domínio incomum',
      explanation: 'Esse tipo de endereço é muito usado por sites de golpe que duram pouco.',
    },
    'link-free-hosting': {
      title: 'O link está em um criador de sites gratuito',
      explanation: 'Qualquer pessoa cria essas páginas em minutos; bancos e governos não as usam.',
    },
    'link-messaging-redirect': {
      title: 'O link abre uma conversa privada',
      explanation: 'O link leva você ao WhatsApp ou Telegram com uma conta desconhecida.',
    },
    'link-many-subdomains': {
      title: 'O link tem uma longa cadeia de nomes',
      explanation:
        'Cadeias longas podem colocar um nome confiável no início de um endereço que não é.',
    },
    'link-insecure-http': {
      title: 'O link não é seguro',
      explanation: 'A página não usa conexão criptografada.',
    },
    'link-very-long': {
      title: 'O link é longo demais',
      explanation: 'Links muito longos podem esconder rastreamento ou um endereço disfarçado.',
    },
    'free-mail-official': {
      title: 'Nome com cara de oficial em e-mail gratuito',
      explanation:
        'Bancos, empregadores e órgãos públicos enviam e-mails do próprio domínio, não do Gmail ou Yahoo.',
    },
    'foreign-number': {
      title: 'O número é de outro país',
      explanation:
        'Mensagens de emprego e prêmio vindas de números internacionais inesperados são um padrão comum de golpe.',
    },
  },
  advice: {
    'check-anyway':
      'Não encontramos sinais comuns de golpe. Se a mensagem pedir dinheiro, códigos ou pressa, confirme antes com alguém de confiança.',
    pause: 'Pare antes de responder, clicar ou pagar. Golpes dependem de pressa.',
    'verify-independently':
      'Confira o remetente você mesmo: use o aplicativo, o site ou o telefone oficial que você já conhece, não os dados da mensagem.',
    'dont-engage': 'Não responda, não abra os links e não pague.',
    'block-report': 'Bloqueie o remetente e denuncie (veja abaixo onde denunciar).',
    'if-paid':
      'Já pagou ou passou dados? Ligue agora para o seu banco para tentar bloquear o pagamento, troque suas senhas e denuncie rápido — agir cedo aumenta a chance de recuperar o dinheiro.',
    'cat-job': 'Empregadores de verdade nunca pedem pagamento por vaga, treinamento ou “kit”.',
    'cat-bank-kyc':
      'Seu banco nunca vai pedir sua senha, PIN ou código de verificação, nem encerrar sua conta por SMS. Ligue para o número no verso do seu cartão.',
    'cat-delivery':
      'Acompanhe entregas só no aplicativo ou site oficial da transportadora. Transportadoras não cobram pequenas taxas por SMS.',
    'cat-investment':
      'Retorno alto garantido é sinal de alerta. Consulte a empresa no órgão regulador financeiro antes de investir.',
    'cat-crypto':
      'Pagamentos em cripto não podem ser desfeitos. Não envie cripto para quem procurou você primeiro.',
    'cat-lottery-prize':
      'Você não pode ganhar um sorteio do qual não participou. Nunca pague taxa para receber prêmio.',
    'cat-romance':
      'Nunca envie dinheiro para alguém que você não conheceu pessoalmente, por mais próximo que se sinta.',
    'cat-sextortion':
      'Não pague — pagar costuma trazer mais exigências. Pare de responder, guarde as provas e denuncie. Você não fez nada de errado.',
    'cat-tech-support':
      'Não instale aplicativos de acesso remoto nem compre cartões-presente a pedido de quem liga. Empresas de verdade não ligam por causa de vírus.',
    'cat-impersonation-authority':
      'Desligue. Ligue para o órgão no número oficial, que você mesmo procurar.',
    'cat-digital-arrest':
      '“Prisão digital” não existe. A polícia nunca mantém ninguém em chamada de vídeo nem pede dinheiro para resolver um caso. Desligue e ligue para a polícia local.',
    'cat-loan-app':
      'Pegue empréstimo só com instituições autorizadas pelo banco central. Não dê aos aplicativos acesso aos seus contatos ou fotos.',
    'cat-utility-disconnection':
      'Pague contas só pelo aplicativo, site ou agência oficiais. Distribuidoras de energia não pedem que você ligue para números pessoais.',
    'cat-tax-refund':
      'Peça restituição de imposto só no site oficial da Receita, digitando o endereço você mesmo.',
    'cat-government-scheme':
      'Inscrever-se em programas do governo é gratuito nos portais oficiais. Nunca pague intermediário.',
    'cat-family-emergency':
      'Antes de enviar qualquer coisa, ligue para o seu familiar no número que você já tem.',
    'cat-marketplace':
      'Não devolva “pagamentos a mais”. Espere o dinheiro realmente cair na sua conta.',
    'cat-rental': 'Nunca pague depósito antes de ver o imóvel e confirmar quem é o dono.',
    'cat-charity':
      'Doe pelo site oficial de uma instituição registrada, não para uma conta pessoal.',
    'cat-phishing-link': 'Não abra o link. Digite você mesmo o endereço do site oficial.',
    'cat-sim-swap-otp':
      'Nunca compartilhe códigos de verificação. Se o seu celular perder o sinal de repente, ligue na hora para a sua operadora.',
    'cat-qr-code':
      'Você nunca precisa escanear um código nem digitar sua senha para receber dinheiro.',
    'cat-deepfake-voice':
      'Desligue e ligue de volta para um número que você conhece. Combinem uma palavra-código da família para emergências.',
  },
  aiExplanation: 'Apontado pela verificação com IA, que analisa a mensagem inteira no contexto.',
};
