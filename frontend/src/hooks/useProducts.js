import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { readProducts } from '../lib/products'

export function useProducts() {
  const { api } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ loading: true, products: [], error: '' })
  useEffect(() => {
    const controller = new AbortController()
    api.products(controller.signal).then(data => {
      const products = readProducts(data)
      if (!controller.signal.aborted) setState({ loading: false, products, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, products: [], error: error.message })
    })
    return () => controller.abort()
  }, [api, attempt])
  function reload() {
    setState({ loading: true, products: [], error: '' })
    setAttempt(value => value + 1)
  }
  return { ...state, reload }
}
