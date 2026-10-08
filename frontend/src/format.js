export const CATEGORIES = [
  'Séance',
  'Exorcism',
  'Cursed Relics',
  'Ectoplasm',
  'Ghost Tours',
  'Salt & Iron',
  'Other',
]

export const INCOME_CATEGORIES = [
  'Bounty',
  'Freelance',
  'Affiliate',
  'Referral',
  'Royalty',
  'Other',
]

export const PAYOUT_METHODS = ['Bitcoin', 'PayPal', 'Crypto', 'Bank transfer', 'Other']

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export const formatAmount = (value) => currency.format(Number(value) || 0)

export const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
