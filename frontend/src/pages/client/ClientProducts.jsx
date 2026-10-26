import { useNavigate } from 'react-router-dom'
import { useProducts } from '../../hooks/useProducts'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, EmptyState, InlineAlert, LoadingState } from '../../components/ui'
import { formatMoney } from '../../lib/format'

export default function ClientProducts() {
  const navigate = useNavigate()
  const { products, loading, error, reload } = useProducts()
  return <>
    <PageHeader title="Продукты" description="Финансирование текущей деятельности вашего бизнеса" />
    {loading ? <LoadingState label="Загружаем условия кредита…" /> : error ?
      <InlineAlert tone="danger">{error}<Button onClick={reload}>Повторить</Button></InlineAlert> : !products.length ?
        <EmptyState title="Сейчас нет доступных продуктов" description="Попробуйте обновить список позже." actionLabel="Обновить" onAction={reload} /> :
        <div className="products-grid">{products.map(product => <Card key={product.id} title={product.name}>
          <div className="stack"><p className="muted">На закупку товаров, аренду и другие операционные расходы.</p>
            <dl className="offer-details">
              <div><dt>Сумма</dt><dd>{formatMoney(product.min_amount)} – {formatMoney(product.max_amount)}</dd></div>
              <div><dt>Сроки</dt><dd>{product.terms.join(' / ')} мес.</dd></div>
            </dl>
            <Button onClick={() => navigate('/client/applications/new')}>Оформить заявку</Button>
          </div>
        </Card>)}</div>}
  </>
}
