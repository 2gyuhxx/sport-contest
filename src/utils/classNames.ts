export function classNames(
  ...values: Array<string | boolean | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}
