// Идентификаторы попыток возрастают; порядок элементов ответа не определяет актуальность.
export function groupChecks(checks = []) {
  const latest = new Map()
  for (const check of checks) {
    const previous = latest.get(check.check_type)
    if (!previous || Number(check.id) >= Number(previous.id) || check.id == null) latest.set(check.check_type, check)
  }
  const current = [...latest.values()]
  return { current, previous: checks.filter(check => !current.includes(check)) }
}
