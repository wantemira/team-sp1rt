import { useId } from 'react'
import { financialBasis } from '../../lib/financialBasis'
import { formatMoney } from '../../lib/format'

function Value({ label, value, source }) {
  return <div><dt>{label}</dt><dd>{value ?? 'Нет данных'}{source && <small>{source}</small>}</dd></div>
}

export function FinancialBasis({ application }) {
  const id = useId()
  const basis = financialBasis(application)
  const history = basis.history
  const discipline = !history ? null : history.total === 0 ? 'Нет истории платежей' : `${history.delayed} из ${history.total}`
  const overdue = basis.overdueDays === null ? null : basis.overdueDays === 0 ? 'Нет текущей просрочки' : `${basis.overdueDays} дн.`
  return <section className="financial-basis" aria-labelledby={id}>
    <div className="financial-basis__header"><h3 id={id}>Финансовые основания решения</h3><p className="muted">{basis.saved ? 'Сохранённые данные последнего расчёта' : 'Последние полученные данные; расчёт ещё не сохранён'}</p></div>
    {basis.sourceProblem && <p className="financial-basis__warning">Данные источников требуют повторной проверки. Эти показатели не подтверждают допустимость одобрения.</p>}
    <div className="financial-basis__grid">
      <div><h4>Денежный поток</h4><dl>
        <Value label="Выручка за 12 месяцев" value={basis.revenue.amount === null ? null : formatMoney(basis.revenue.amount)} source={basis.revenue.amount === null ? null : basis.revenue.source} />
        <Value label="Операционные расходы за 12 месяцев" value={basis.expenses.amount === null ? null : formatMoney(basis.expenses.amount)} source={basis.expenses.amount === null ? null : basis.expenses.source} />
        <Value label="Операционный поток в месяц" value={basis.monthlyCashFlow} />
      </dl><p className="financial-basis__note">(Выручка − операционные расходы) / 12. Платежи по кредитам учитываются отдельно.</p></div>
      <div><h4>Обязательства и дисциплина · БКИ</h4><dl>
        <Value label="Платежи по действующим кредитам в месяц" value={basis.debtPayments === null ? null : formatMoney(basis.debtPayments)} />
        <Value label="Активные кредиты" value={basis.activeLoans} />
        <Value label="Платежи с задержкой за 12 месяцев" value={discipline} source={history?.total ? 'Задержанные / все платежи' : null} />
        <Value label="Текущая просрочка" value={overdue} />
      </dl></div>
    </div>
  </section>
}
