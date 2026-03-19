export const formatINR = (paise: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100)

export const paiseToRupees = (paise: number): number => paise / 100
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100)

export const formatRupees = (rupees: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rupees)
