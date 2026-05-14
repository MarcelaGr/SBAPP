export const EXPENSE_CATEGORIES = [
  'Court fees',
  'Filing costs',
  'Mileage',
  'Reimbursements',
  'Travel expenses',
  'Copy/printing expenses',
  'Investigation costs',
  'Expert witness costs',
  'Miscellaneous expenses',
]

export function normalizeExpenseCategory(value) {
  return EXPENSE_CATEGORIES.includes(value) ? value : 'Miscellaneous expenses'
}
