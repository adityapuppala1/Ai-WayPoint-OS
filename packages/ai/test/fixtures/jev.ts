/**
 * The two request and response examples from TypeSafe's own documentation, word for word
 * (the quickstart, and the Choice example in the API reference). The judge's client is tested
 * against these, so a change in how Waypoint reads the documented shapes shows up here.
 */
export const QUICKSTART_REQUEST = {
  state:
    "Hi, I've been trying to connect my Stripe account for 3 days and the integration keeps failing. I'm losing sales. Please help ASAP.",
  model: 'jev-latest',
  questions: {
    department: {
      type: 'choice',
      instructions: 'Which team should handle this',
      criteria: {
        billing: 'Payment or subscription issues',
        technical: 'Bugs or integration problems',
        sales: 'Pricing or account questions',
      },
    },
    frustration: {
      type: 'score',
      instructions: 'How frustrated the customer appears',
      criteria: ['Calm, just stating facts', 'Frustrated but civil', 'Very angry, strong language'],
    },
    is_urgent: {
      type: 'noul',
      instructions: 'The message conveys urgency or time-sensitivity',
    },
  },
} as const;

export const QUICKSTART_RESPONSE = {
  model: 'jev-1.13.0',
  answers: {
    department: {
      type: 'choice',
      choice: 'technical',
      confidence: 0.78,
      probabilities: { technical: 0.85, sales: 0.0, billing: 0.15 },
    },
    frustration: {
      type: 'score',
      score: 1.0,
      confidence: 1.0,
      legend: {
        '0': 'Calm, just stating facts',
        '1': 'Frustrated but civil',
        '2': 'Very angry, strong language',
      },
      probabilities: { '0': 0.0, '1': 1.0, '2': 0.0 },
    },
    is_urgent: { type: 'noul', noul: 1.0 },
  },
  usage: { input_tokens: 392, output_tokens: 65 },
} as const;

export const CHOICE_REQUEST = {
  state: 'Help! My payouts have been failing for 3 days.',
  model: 'jev-latest',
  questions: {
    department: {
      type: 'choice',
      instructions: 'Which team should handle this?',
      criteria: {
        billing: 'Payments, invoicing, refunds',
        technical: 'Bugs, outages, integrations',
        sales: 'Pricing, upgrades, new accounts',
      },
    },
  },
} as const;

export const CHOICE_RESPONSE = {
  model: 'jev-1.13.0',
  answers: {
    department: {
      type: 'choice',
      choice: 'billing',
      probabilities: { billing: 0.88, technical: 0.12, sales: 0.0 },
      confidence: 0.81,
    },
  },
  usage: { input_tokens: 318, output_tokens: 34 },
} as const;
