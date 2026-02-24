import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ChevronRight,
  CreditCard,
  DollarSign,
  Edit3,
  LayoutDashboard,
  LogOut,
  Menu,
  Minus,
  Package,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { createNoSessionSupabaseClient, hasSupabaseEnv, supabase } from './lib/supabase'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  pos: 'Point of Sale',
  inventory: 'Inventory',
  finance: 'Finance',
  settings: 'Settings',
}

const PAYMENT_METHODS = ['cash', 'card', 'insurance']
const LOW_STOCK_THRESHOLD = 10

const DEFAULT_SETTINGS = {
  id: null,
  store_name: 'NovaCare Pharmacy',
  currency: 'USD',
  tax_rate: 0,
  prices_include_tax: false,
  address: '',
  phone: '',
  support_email: '',
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateKey(value) {
  if (!value) {
    return null
  }
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function getInitials(name) {
  return String(name || 'US')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function medicineStatus(item) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (item.expiry) {
    const expiry = new Date(`${item.expiry}T00:00:00`)
    if (!Number.isNaN(expiry.getTime()) && expiry < today) {
      return 'Expired'
    }
  }

  if (Number(item.stock) <= LOW_STOCK_THRESHOLD) {
    return 'Low Stock'
  }

  return 'In Stock'
}

function buildSeries(transactions, fromValue, toValue) {
  const from = parseDateKey(fromValue)
  const to = parseDateKey(toValue)
  if (!from || !to) {
    return []
  }

  const start = new Date(Math.min(from.getTime(), to.getTime()))
  const end = new Date(Math.max(from.getTime(), to.getTime()))

  const totalsByDay = {}
  for (const transaction of transactions) {
    const key = transaction.createdAt.slice(0, 10)
    totalsByDay[key] = (totalsByDay[key] || 0) + Number(transaction.total)
  }

  const result = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(cursor)
    result.push({
      key,
      label,
      total: Number((totalsByDay[key] || 0).toFixed(2)),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

function rangeFilter(transactions, fromValue, toValue) {
  const from = parseDateKey(fromValue)
  const to = parseDateKey(toValue)
  if (!from || !to) {
    return transactions
  }

  const start = new Date(Math.min(from.getTime(), to.getTime()))
  const end = new Date(Math.max(from.getTime(), to.getTime()))
  end.setHours(23, 59, 59, 999)

  return transactions.filter((transaction) => {
    const createdAt = new Date(transaction.createdAt)
    return createdAt >= start && createdAt <= end
  })
}

function statusTone(status) {
  if (status === 'Expired') {
    return 'rose'
  }
  if (status === 'Low Stock') {
    return 'amber'
  }
  return 'emerald'
}

function mapSettingsRow(row) {
  if (!row) {
    return DEFAULT_SETTINGS
  }

  return {
    id: row.id,
    store_name: row.store_name || DEFAULT_SETTINGS.store_name,
    currency: row.currency || 'USD',
    tax_rate: Number(row.tax_rate || 0),
    prices_include_tax: Boolean(row.prices_include_tax),
    address: row.address || '',
    phone: row.phone || '',
    support_email: row.support_email || '',
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [appLoading, setAppLoading] = useState(false)

  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')

  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [medicines, setMedicines] = useState([])
  const [transactions, setTransactions] = useState([])
  const [staffProfiles, setStaffProfiles] = useState([])

  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [saleSubmitting, setSaleSubmitting] = useState(false)

  const [financeRange, setFinanceRange] = useState(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 29)
    return {
      from: formatDateInput(from),
      to: formatDateInput(to),
      preset: '30',
    }
  })

  const [notice, setNotice] = useState(null)

  const pushNotice = useCallback((type, message) => {
    setNotice({ type, message })
    window.clearTimeout(pushNotice.timer)
    pushNotice.timer = window.setTimeout(() => setNotice(null), 3200)
  }, [])

  const loadProfile = useCallback(async (user) => {
    if (!user?.id) {
      return null
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        pushNotice('error', error.message)
        return null
      }

      if (data) {
        return data
      }

      await new Promise((resolve) => window.setTimeout(resolve, 200))
    }

    return {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.email || 'User',
      role: 'staff',
      created_at: new Date().toISOString(),
    }
  }, [pushNotice])

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) {
      pushNotice('error', error.message)
      return
    }

    const row = data?.[0]
    if (!row) {
      setSettings(DEFAULT_SETTINGS)
      return
    }

    setSettings(mapSettingsRow(row))
  }, [pushNotice])

  const loadMedicines = useCallback(async () => {
    const { data, error } = await supabase
      .from('medicines')
      .select('id,sku,name,category,price,stock,expiry,created_at')
      .order('name', { ascending: true })

    if (error) {
      pushNotice('error', error.message)
      return
    }

    const mapped = (data || []).map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category || 'General',
      price: Number(item.price || 0),
      stock: Number(item.stock || 0),
      expiry: item.expiry,
      createdAt: item.created_at,
    }))

    setMedicines(mapped)
  }, [pushNotice])

  const loadTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(
        'id,user_id,total,tax,payment_method,created_at,transaction_items(qty,unit_price,line_total,medicine_id,medicines(name,sku))',
      )
      .order('created_at', { ascending: false })

    if (error) {
      pushNotice('error', error.message)
      return
    }

    const mapped = (data || []).map((item) => {
      const items = item.transaction_items || []
      return {
        id: item.id,
        userId: item.user_id,
        total: Number(item.total || 0),
        tax: Number(item.tax || 0),
        paymentMethod: item.payment_method,
        createdAt: item.created_at,
        itemsCount: items.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        items: items.map((row) => ({
          medicineId: row.medicine_id,
          name: row.medicines?.name || 'Medicine',
          sku: row.medicines?.sku || '-',
          qty: Number(row.qty || 0),
          unitPrice: Number(row.unit_price || 0),
          lineTotal: Number(row.line_total || 0),
        })),
      }
    })

    setTransactions(mapped)
  }, [pushNotice])

  const loadStaffProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,created_at')
      .order('created_at', { ascending: false })

    if (error) {
      pushNotice('error', error.message)
      return
    }

    setStaffProfiles(data || [])
  }, [pushNotice])

  const loadAll = useCallback(async (role) => {
    setAppLoading(true)
    try {
      if (role === 'admin') {
        await Promise.all([loadSettings(), loadMedicines(), loadTransactions(), loadStaffProfiles()])
      } else {
        await Promise.all([loadSettings(), loadMedicines(), loadTransactions()])
        setStaffProfiles([])
      }
    } finally {
      setAppLoading(false)
    }
  }, [loadMedicines, loadSettings, loadStaffProfiles, loadTransactions])

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setAuthLoading(false)
      return undefined
    }

    let mounted = true

    const clearSessionState = () => {
      setProfileLoading(false)
      setProfile(null)
      setMedicines([])
      setTransactions([])
      setStaffProfiles([])
      setSettings(DEFAULT_SETTINGS)
      setCart([])
      setSaleSubmitting(false)
    }

    const bootstrap = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession()

        if (!mounted) {
          return
        }

        if (error) {
          pushNotice('error', error.message)
        }

        setSession(currentSession)
        setAuthLoading(false)

        if (!currentSession?.user) {
          clearSessionState()
          return
        }

        setProfileLoading(true)
        const nextProfile = await loadProfile(currentSession.user)
        if (!mounted) {
          return
        }
        setProfile(nextProfile)
      } finally {
        if (mounted) {
          setAuthLoading(false)
          setProfileLoading(false)
        }
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted || event === 'INITIAL_SESSION') {
        return
      }

      setSession(nextSession)

      if (!nextSession?.user) {
        clearSessionState()
        return
      }

      setProfileLoading(true)
      const nextProfile = await loadProfile(nextSession.user)
      if (!mounted) {
        return
      }
      setProfile(nextProfile)
      setProfileLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile, pushNotice])

  useEffect(() => {
    if (!session?.user || !profile?.role) {
      return
    }
    void loadAll(profile.role)
  }, [session, profile, loadAll])

  useEffect(() => {
    setCart((prev) => {
      return prev
        .map((item) => {
          const fresh = medicines.find((medicine) => medicine.id === item.medicineId)
          if (!fresh) {
            return null
          }
          return {
            ...item,
            name: fresh.name,
            price: fresh.price,
            stock: fresh.stock,
            qty: Math.min(item.qty, fresh.stock),
          }
        })
        .filter((item) => item && item.qty > 0)
    })
  }, [medicines])

  const isAdmin = profile?.role === 'admin'

  const inventoryWithStatus = useMemo(
    () => medicines.map((item) => ({ ...item, status: medicineStatus(item) })),
    [medicines],
  )

  const categoryOptions = useMemo(() => {
    const set = new Set(inventoryWithStatus.map((item) => item.category))
    return ['All', ...Array.from(set)]
  }, [inventoryWithStatus])

  const cartSubtotal = useMemo(
    () => Number(cart.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2)),
    [cart],
  )

  const cartTax = useMemo(() => {
    const rate = Number(settings.tax_rate || 0) / 100
    if (!rate || cartSubtotal <= 0) {
      return 0
    }
    if (settings.prices_include_tax) {
      return Number((cartSubtotal - cartSubtotal / (1 + rate)).toFixed(2))
    }
    return Number((cartSubtotal * rate).toFixed(2))
  }, [cartSubtotal, settings.prices_include_tax, settings.tax_rate])

  const cartTotal = useMemo(() => {
    if (settings.prices_include_tax) {
      return cartSubtotal
    }
    return Number((cartSubtotal + cartTax).toFixed(2))
  }, [cartSubtotal, cartTax, settings.prices_include_tax])

  const dashboardStats = useMemo(() => {
    const revenue = transactions.reduce((sum, row) => sum + row.total, 0)
    const transactionsCount = transactions.length
    const stockValue = inventoryWithStatus.reduce((sum, row) => sum + row.price * row.stock, 0)
    const lowStock = inventoryWithStatus.filter((row) => row.status === 'Low Stock').length
    return {
      revenue: Number(revenue.toFixed(2)),
      transactionsCount,
      stockValue: Number(stockValue.toFixed(2)),
      lowStock,
    }
  }, [inventoryWithStatus, transactions])

  const inventorySignals = useMemo(() => {
    return {
      lowStock: inventoryWithStatus.filter((item) => item.status === 'Low Stock').length,
      expired: inventoryWithStatus.filter((item) => item.status === 'Expired').length,
    }
  }, [inventoryWithStatus])

  const filteredFinanceTransactions = useMemo(
    () => rangeFilter(transactions, financeRange.from, financeRange.to),
    [transactions, financeRange.from, financeRange.to],
  )

  const financeSeries = useMemo(
    () => buildSeries(filteredFinanceTransactions, financeRange.from, financeRange.to),
    [filteredFinanceTransactions, financeRange.from, financeRange.to],
  )

  const financePaymentBreakdown = useMemo(() => {
    return PAYMENT_METHODS.map((method) => {
      const total = filteredFinanceTransactions
        .filter((row) => row.paymentMethod === method)
        .reduce((sum, row) => sum + row.total, 0)
      return { method, total: Number(total.toFixed(2)) }
    })
  }, [filteredFinanceTransactions])

  const setFinancePreset = useCallback((days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    setFinanceRange({ from: formatDateInput(start), to: formatDateInput(end), preset: String(days) })
  }, [])

  const handleLogin = useCallback(
    async ({ email, password }) => {
      const normalizedEmail = String(email || '').trim().toLowerCase()
      if (!normalizedEmail || !password) {
        return { ok: false, message: 'Email and password are required.' }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) {
        return { ok: false, message: error.message }
      }
      return { ok: true }
    },
    [],
  )

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setHeaderSearch('')
    setCart([])
    setPaymentMethod(PAYMENT_METHODS[0])
  }, [])

  const addToCart = useCallback(
    (medicine) => {
      if (medicine.status === 'Expired') {
        pushNotice('error', `${medicine.name} is expired and cannot be sold.`)
        return
      }

      const already = cart.find((item) => item.medicineId === medicine.id)?.qty || 0
      if (already >= medicine.stock) {
        pushNotice('error', `Insufficient stock for ${medicine.name}.`)
        return
      }

      setCart((prev) => {
        const exists = prev.find((item) => item.medicineId === medicine.id)
        if (!exists) {
          return [
            ...prev,
            {
              medicineId: medicine.id,
              sku: medicine.sku,
              name: medicine.name,
              price: medicine.price,
              qty: 1,
              stock: medicine.stock,
            },
          ]
        }

        return prev.map((item) =>
          item.medicineId === medicine.id ? { ...item, qty: item.qty + 1 } : item,
        )
      })
    },
    [cart, pushNotice],
  )

  const updateCartQty = useCallback((medicineId, nextQty) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((item) => item.medicineId !== medicineId))
      return
    }

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicineId !== medicineId) {
            return item
          }
          return { ...item, qty: Math.min(nextQty, item.stock) }
        })
        .filter((item) => item.qty > 0),
    )
  }, [])

  const removeCartItem = useCallback((medicineId) => {
    setCart((prev) => prev.filter((item) => item.medicineId !== medicineId))
  }, [])

  const completeSale = useCallback(async () => {
    if (saleSubmitting) {
      return
    }

    if (cart.length === 0) {
      pushNotice('error', 'Add medicines to complete a sale.')
      return
    }

    for (const row of cart) {
      if (row.qty > row.stock) {
        pushNotice('error', `Stock is insufficient for ${row.name}.`)
        return
      }
    }

    const payload = {
      payment_method: paymentMethod,
      items: cart.map((row) => ({ medicine_id: row.medicineId, qty: row.qty })),
    }

    setSaleSubmitting(true)
    let rpcError = null
    try {
      const result = await supabase.rpc('complete_sale', { payload })
      rpcError = result.error
    } catch (error) {
      rpcError = error
    } finally {
      setSaleSubmitting(false)
    }

    if (rpcError) {
      pushNotice('error', rpcError.message || 'Failed to complete sale.')
      return
    }

    setCart([])
    setPaymentMethod(PAYMENT_METHODS[0])
    await Promise.all([loadMedicines(), loadTransactions()])
    pushNotice('success', 'Sale completed successfully.')
  }, [cart, loadMedicines, loadTransactions, paymentMethod, pushNotice, saleSubmitting])

  const addMedicine = useCallback(
    async (payload) => {
      if (!isAdmin) {
        return { ok: false, message: 'Only admins can add medicines.' }
      }

      const sku = String(payload.sku || '').trim()
      const name = String(payload.name || '').trim()
      const category = String(payload.category || '').trim()
      const price = Number(payload.price)
      const stock = Number(payload.stock)
      const expiry = payload.expiry || null

      if (!sku || !name || !category || !expiry) {
        return { ok: false, message: 'All fields are required.' }
      }
      if (Number.isNaN(price) || price < 0.1) {
        return { ok: false, message: 'Price must be at least 0.1.' }
      }
      if (Number.isNaN(stock) || stock < 0) {
        return { ok: false, message: 'Stock must be 0 or greater.' }
      }

      const { error } = await supabase.from('medicines').insert([
        {
          sku,
          name,
          category,
          price,
          stock,
          expiry,
        },
      ])

      if (error) {
        return { ok: false, message: error.message }
      }

      await loadMedicines()
      pushNotice('success', `${name} added to inventory.`)
      return { ok: true }
    },
    [isAdmin, loadMedicines, pushNotice],
  )

  const editMedicineStock = useCallback(
    async (id, stock) => {
      if (!isAdmin) {
        return { ok: false, message: 'Only admins can edit stock.' }
      }

      const parsedStock = Number(stock)
      if (Number.isNaN(parsedStock) || parsedStock < 0) {
        return { ok: false, message: 'Stock must be 0 or greater.' }
      }

      const { error } = await supabase.from('medicines').update({ stock: parsedStock }).eq('id', id)

      if (error) {
        return { ok: false, message: error.message }
      }

      await loadMedicines()
      pushNotice('success', 'Stock updated.')
      return { ok: true }
    },
    [isAdmin, loadMedicines, pushNotice],
  )

  const clearInventory = useCallback(async () => {
    if (!isAdmin) {
      return
    }

    const confirmed = window.confirm('Delete all medicines from inventory?')
    if (!confirmed) {
      return
    }

    const { error } = await supabase
      .from('medicines')
      .delete()
      .gte('created_at', '1900-01-01T00:00:00+00:00')

    if (error) {
      pushNotice('error', error.message)
      return
    }

    setCart([])
    await loadMedicines()
    pushNotice('success', 'All medicines deleted from inventory.')
  }, [isAdmin, loadMedicines, pushNotice])

  const saveSettings = useCallback(
    async (nextSettings) => {
      if (!isAdmin) {
        return { ok: false, message: 'Only admins can update settings.' }
      }

      const payload = {
        store_name: nextSettings.store_name,
        currency: nextSettings.currency,
        tax_rate: Number(nextSettings.tax_rate || 0),
        prices_include_tax: Boolean(nextSettings.prices_include_tax),
        address: nextSettings.address,
        phone: nextSettings.phone,
        support_email: nextSettings.support_email,
        updated_at: new Date().toISOString(),
      }

      if (nextSettings.id) {
        const { data, error } = await supabase
          .from('settings')
          .update(payload)
          .eq('id', nextSettings.id)
          .select('*')
          .maybeSingle()

        if (error) {
          return { ok: false, message: error.message }
        }

        if (data) {
          setSettings(mapSettingsRow(data))
          pushNotice('success', 'Settings saved.')
          return { ok: true }
        }
      }

      const { data, error } = await supabase.from('settings').insert([payload]).select('*').single()
      if (error) {
        return { ok: false, message: error.message }
      }

      setSettings(mapSettingsRow(data))
      pushNotice('success', 'Settings saved.')
      return { ok: true }
    },
    [isAdmin, pushNotice],
  )

  const registerStaff = useCallback(
    async (payload) => {
      if (!isAdmin) {
        return { ok: false, message: 'Only admins can register staff.' }
      }

      const fullName = String(payload.fullName || '').trim()
      const email = String(payload.email || '').trim().toLowerCase()
      const password = String(payload.password || '')

      if (!fullName || !email || !password) {
        return { ok: false, message: 'Name, email, and password are required.' }
      }
      if (password.length < 8) {
        return { ok: false, message: 'Password must be at least 8 characters.' }
      }

      const onboardingClient = createNoSessionSupabaseClient()
      if (!onboardingClient) {
        return { ok: false, message: 'Supabase client unavailable.' }
      }

      const { data: signUpData, error: signUpError } = await onboardingClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) {
        return { ok: false, message: signUpError.message }
      }

      const createdUserId = signUpData.user?.id
      if (!createdUserId) {
        return { ok: false, message: 'Unable to create staff account.' }
      }

      let profileReady = false
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', createdUserId)
          .maybeSingle()

        if (profileError) {
          return { ok: false, message: profileError.message }
        }

        if (profileRow?.id) {
          profileReady = true
          break
        }

        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }

      if (!profileReady) {
        return { ok: false, message: 'Staff profile was not created yet. Please try again.' }
      }

      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'staff', full_name: fullName, email })
        .eq('id', createdUserId)

      if (roleError) {
        return { ok: false, message: roleError.message }
      }

      await loadStaffProfiles()
      pushNotice('success', 'Staff account registered.')
      return { ok: true }
    },
    [isAdmin, loadStaffProfiles, pushNotice],
  )

  const updateStaffRole = useCallback(
    async (profileId, role) => {
      if (!isAdmin) {
        return { ok: false, message: 'Only admins can update staff roles.' }
      }

      const nextRole = role === 'admin' ? 'admin' : 'staff'
      const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', profileId)

      if (error) {
        return { ok: false, message: error.message }
      }

      await loadStaffProfiles()
      pushNotice('success', 'Staff role updated.')
      return { ok: true }
    },
    [isAdmin, loadStaffProfiles, pushNotice],
  )

  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-5">
          <h1 className="text-lg font-semibold">Supabase Environment Missing</h1>
          <p className="text-sm text-slate-600 mt-2">
            Add <code>VITE_SUPABASE_URL</code> and either <code>VITE_SUPABASE_ANON_KEY</code> or{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your env file.
          </p>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <div className="text-sm text-slate-600">Loading authentication...</div>
      </div>
    )
  }

  if (session?.user && profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <div className="text-sm text-slate-600">Loading your account...</div>
      </div>
    )
  }

  if (!session?.user || !profile) {
    return <LoginScreen onLogin={handleLogin} />
  }

  const userDisplayName = profile.full_name || profile.email || 'User'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-sm">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <Sidebar
        activePage={activePage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={(page) => {
          setActivePage(page)
          setSidebarOpen(false)
        }}
      />

      <div className="md:pl-64">
        <HeaderBar
          title={PAGE_TITLES[activePage]}
          breadcrumb={['Home', PAGE_TITLES[activePage]]}
          searchValue={headerSearch}
          onSearchChange={setHeaderSearch}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          user={{ name: userDisplayName, email: profile.email, role: profile.role }}
          onLogout={handleLogout}
        />

        <main className="max-w-7xl mx-auto w-full p-3 sm:p-4 md:p-6 space-y-4">
          {notice ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {notice.message}
            </div>
          ) : null}

          {appLoading ? (
            <Card>
              <p className="text-sm text-slate-600">Syncing data from Supabase...</p>
            </Card>
          ) : null}

          {activePage === 'dashboard' ? (
            <DashboardPage
              stats={dashboardStats}
              transactions={transactions}
              inventorySignals={inventorySignals}
              currency={settings.currency}
            />
          ) : null}

          {activePage === 'pos' ? (
            <POSPage
              medicines={inventoryWithStatus}
              categories={categoryOptions}
              globalSearch={headerSearch}
              cart={cart}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              onAddToCart={addToCart}
              onUpdateQty={updateCartQty}
              onRemoveItem={removeCartItem}
              onCompleteSale={completeSale}
              isSubmittingSale={saleSubmitting}
              subtotal={cartSubtotal}
              tax={cartTax}
              total={cartTotal}
              currency={settings.currency}
            />
          ) : null}

          {activePage === 'inventory' ? (
            <InventoryPage
              medicines={inventoryWithStatus}
              categories={categoryOptions}
              globalSearch={headerSearch}
              isAdmin={isAdmin}
              onAddMedicine={addMedicine}
              onEditStock={editMedicineStock}
              onClearInventory={clearInventory}
              currency={settings.currency}
            />
          ) : null}

          {activePage === 'finance' ? (
            <FinancePage
              transactions={filteredFinanceTransactions}
              series={financeSeries}
              paymentBreakdown={financePaymentBreakdown}
              currency={settings.currency}
              range={financeRange}
              onRangeChange={(key, value) =>
                setFinanceRange((prev) => ({ ...prev, [key]: value, preset: 'custom' }))
              }
              onApplyPreset={setFinancePreset}
            />
          ) : null}

          {activePage === 'settings' ? (
            <SettingsPage
              settings={settings}
              setSettings={setSettings}
              onSaveSettings={saveSettings}
              isAdmin={isAdmin}
              profiles={staffProfiles}
              onRefreshProfiles={loadStaffProfiles}
              onUpdateStaffRole={updateStaffRole}
              onRegisterStaff={registerStaff}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await onLogin({ email, password })
    if (!result.ok) {
      setError(result.message)
    }

    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-5">
        <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold">Pharmacy SaaS</p>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Login</h1>
        <p className="text-xs text-slate-500 mt-1">Sign in with your Supabase email and password.</p>

        <form className="space-y-3 mt-4" onSubmit={submit} autoComplete="off">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@domain.com"
            autoComplete="off"
            name="login_email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            name="login_password"
          />

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}

          <Button type="submit" className="w-full" icon={Shield} disabled={submitting}>
            {submitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

function Sidebar({ activePage, isOpen, onClose, onNavigate }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-white/60 backdrop-blur-md border-r border-slate-200 transition-transform duration-200 md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold">NovaCare</p>
          <p className="text-sm font-semibold text-slate-900">Management</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      <nav className="p-3 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

function HeaderBar({ title, breadcrumb, searchValue, onSearchChange, onToggleSidebar, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu size={17} />
          </button>

          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
              {breadcrumb.map((item, index) => (
                <div className="flex items-center gap-1" key={`${item}-${index}`}>
                  {index > 0 ? <ChevronRight size={12} /> : null}
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-9 w-full max-w-sm">
            <Search size={15} className="text-slate-400" />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
              placeholder="Search medicines, sku, categories..."
            />
          </div>

          <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 h-9 text-xs text-slate-600">
            <CalendarDays size={14} />
            <span>
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date())}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white inline-flex items-center gap-2"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="h-6 w-6 rounded-full bg-indigo-600 text-white text-xs inline-flex items-center justify-center font-semibold">
                {getInitials(user.name)}
              </span>
              <span className="hidden sm:block text-xs text-left leading-tight">
                <span className="block text-slate-800 font-medium truncate max-w-[160px]">{user.name}</span>
                <span className="block text-slate-500 capitalize">{user.role}</span>
              </span>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-sm p-2">
                <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{user.email}</p>
                  <p className="text-xs text-slate-500 capitalize">Role: {user.role}</p>
                </div>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5"
                  onClick={() => {
                    setMenuOpen(false)
                    void onLogout()
                  }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <div className="rounded-xl border border-slate-200 bg-white px-3 h-9 flex items-center gap-2">
          <Search size={15} className="text-slate-400" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
            placeholder="Search medicines, sku, categories..."
          />
        </div>
      </div>
    </header>
  )
}

function DashboardPage({ stats, transactions, inventorySignals, currency }) {
  const sparkRevenue = transactions.slice(0, 7).map((row) => row.total).reverse()
  const sparkTx = transactions.slice(0, 7).map((row) => row.itemsCount || 1).reverse()
  const sparkStock = [0.95, 1, 1.05, 1.02, 1, 1.01, 0.99].map((factor) => stats.stockValue * factor)
  const sparkLow = [stats.lowStock + 1, stats.lowStock, stats.lowStock + 1, stats.lowStock, stats.lowStock]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={formatCurrency(stats.revenue, currency)} icon={DollarSign} trend={sparkRevenue} />
        <StatCard
          label="Transactions"
          value={String(stats.transactionsCount)}
          icon={Receipt}
          trend={sparkTx}
        />
        <StatCard label="Stock Value" value={formatCurrency(stats.stockValue, currency)} icon={Package} trend={sparkStock} />
        <StatCard label="Low Stock" value={String(stats.lowStock)} icon={AlertTriangle} trend={sparkLow} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Recent Transactions" subtitle="Latest completed sales">
          <Table
            columns={[
              { label: 'ID' },
              { label: 'Date' },
              { label: 'Items', className: 'text-right' },
              { label: 'Payment' },
              { label: 'Total', className: 'text-right' },
            ]}
          >
            {transactions.slice(0, 8).map((tx) => (
              <tr key={tx.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{tx.id.slice(0, 8)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(tx.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-right text-slate-700">{tx.itemsCount}</td>
                <td className="px-3 py-2 text-xs text-slate-700 capitalize">{tx.paymentMethod}</td>
                <td className="px-3 py-2 text-xs text-right font-medium text-slate-900">
                  {formatCurrency(tx.total, currency)}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Inventory Signals" subtitle="Operational alerts">
          <div className="space-y-2">
            <SignalItem label="Low Stock Items" value={inventorySignals.lowStock} tone="amber" />
            <SignalItem label="Expired Items" value={inventorySignals.expired} tone="rose" />
          </div>
        </Card>
      </div>
    </div>
  )
}

function POSPage({
  medicines,
  categories,
  globalSearch,
  cart,
  paymentMethod,
  onPaymentMethodChange,
  onAddToCart,
  onUpdateQty,
  onRemoveItem,
  onCompleteSale,
  isSubmittingSale,
  subtotal,
  tax,
  total,
  currency,
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filteredMedicines = useMemo(() => {
    const query = `${globalSearch} ${search}`.trim().toLowerCase()
    return medicines.filter((medicine) => {
      const categoryOk = category === 'All' || medicine.category === category
      if (!categoryOk) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        medicine.name.toLowerCase().includes(query) ||
        medicine.sku.toLowerCase().includes(query) ||
        medicine.category.toLowerCase().includes(query)
      )
    })
  }, [medicines, search, category, globalSearch])

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
      <Card title="Medicine Catalog" subtitle="Search, filter, and add to receipt">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 h-9 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
              placeholder="Search medicine in POS"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMedicines.map((medicine) => {
            const inCartQty = cart.find((item) => item.medicineId === medicine.id)?.qty || 0
            const available = Math.max(0, medicine.stock - inCartQty)
            const disabled = medicine.status === 'Expired' || available <= 0

            return (
              <div key={medicine.id} className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{medicine.sku}</p>
                    <p className="text-sm font-medium text-slate-900">{medicine.name}</p>
                    <p className="text-xs text-slate-500">{medicine.category}</p>
                  </div>
                  <Badge tone={statusTone(medicine.status)}>{medicine.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Stock: {medicine.stock}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(medicine.price, currency)}</span>
                </div>
                <Button
                  className="w-full mt-3"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onAddToCart(medicine)}
                  icon={Plus}
                >
                  {disabled ? 'Unavailable' : 'Add'}
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="xl:sticky xl:top-[72px]" title="Digital Receipt" subtitle={`Items: ${totalItems}`}>
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500 text-center">
              No medicines in receipt.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.medicineId} className="rounded-xl border border-slate-100 bg-white p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(item.price, currency)} each</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.medicineId)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      className="p-1.5 text-slate-600 hover:bg-slate-100"
                      onClick={() => onUpdateQty(item.medicineId, item.qty - 1)}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-xs font-medium">{item.qty}</span>
                    <button
                      type="button"
                      className="p-1.5 text-slate-600 hover:bg-slate-100"
                      onClick={() => onUpdateQty(item.medicineId, item.qty + 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <p className="text-xs font-semibold text-slate-800">
                    {formatCurrency(item.qty * item.price, currency)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500 font-medium">Payment Method</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPaymentMethodChange(method)}
                disabled={isSubmittingSale}
                className={`h-8 rounded-lg text-xs border capitalize ${
                  paymentMethod === method
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Tax</span>
            <span>{formatCurrency(tax, currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>

        <Button
          className="w-full mt-3"
          onClick={() => void onCompleteSale()}
          icon={CreditCard}
          disabled={cart.length === 0 || isSubmittingSale}
        >
          {isSubmittingSale ? 'Processing...' : 'Complete Sale'}
        </Button>
      </Card>
    </div>
  )
}

function InventoryPage({
  medicines,
  categories,
  globalSearch,
  isAdmin,
  onAddMedicine,
  onEditStock,
  onClearInventory,
  currency,
}) {
  const [category, setCategory] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [selectedMedicine, setSelectedMedicine] = useState(null)

  const [addForm, setAddForm] = useState({
    sku: '',
    name: '',
    category: '',
    price: '',
    stock: '',
    expiry: '',
  })
  const [addError, setAddError] = useState('')

  const [stockValue, setStockValue] = useState('')
  const [stockError, setStockError] = useState('')

  const filtered = useMemo(() => {
    const query = globalSearch.trim().toLowerCase()
    return medicines.filter((medicine) => {
      const categoryOk = category === 'All' || medicine.category === category
      if (!categoryOk) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        medicine.name.toLowerCase().includes(query) ||
        medicine.sku.toLowerCase().includes(query) ||
        medicine.category.toLowerCase().includes(query)
      )
    })
  }, [medicines, category, globalSearch])

  const submitAddMedicine = async (event) => {
    event.preventDefault()
    setAddError('')

    const result = await onAddMedicine(addForm)
    if (!result.ok) {
      setAddError(result.message)
      return
    }

    setAddForm({ sku: '', name: '', category: '', price: '', stock: '', expiry: '' })
    setShowAddModal(false)
  }

  const submitStockUpdate = async (event) => {
    event.preventDefault()
    setStockError('')

    if (!selectedMedicine) {
      return
    }

    const result = await onEditStock(selectedMedicine.id, stockValue)
    if (!result.ok) {
      setStockError(result.message)
      return
    }

    setShowStockModal(false)
    setSelectedMedicine(null)
    setStockValue('')
  }

  return (
    <div className="space-y-4">
      <Card
        title="Inventory"
        subtitle="Supabase-backed medicines"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {isAdmin ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => void onClearInventory()} icon={Trash2}>
                  Clear All
                </Button>
                <Button size="sm" onClick={() => setShowAddModal(true)} icon={Plus}>
                  Add Medicine
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <Table
          columns={[
            { label: 'SKU' },
            { label: 'Name' },
            { label: 'Category' },
            { label: 'Price', className: 'text-right' },
            { label: 'Stock', className: 'text-right' },
            { label: 'Expiry' },
            { label: 'Status' },
            ...(isAdmin ? [{ label: 'Action', className: 'text-right' }] : []),
          ]}
        >
          {filtered.map((medicine) => (
            <tr key={medicine.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-xs font-medium text-slate-800">{medicine.sku}</td>
              <td className="px-3 py-2 text-xs text-slate-800">{medicine.name}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{medicine.category}</td>
              <td className="px-3 py-2 text-xs text-right text-slate-700">
                {formatCurrency(medicine.price, currency)}
              </td>
              <td className="px-3 py-2 text-xs text-right font-medium text-slate-800">{medicine.stock}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{medicine.expiry || '-'}</td>
              <td className="px-3 py-2 text-xs">
                <Badge tone={statusTone(medicine.status)}>{medicine.status}</Badge>
              </td>
              {isAdmin ? (
                <td className="px-3 py-2 text-xs text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Edit3}
                    onClick={() => {
                      setSelectedMedicine(medicine)
                      setStockValue(String(medicine.stock))
                      setStockError('')
                      setShowStockModal(true)
                    }}
                  >
                    Edit Stock
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Medicine"
        description="Retail medicine price must be at least 0.1."
      >
        <form className="space-y-3" onSubmit={(event) => void submitAddMedicine(event)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="SKU"
              value={addForm.sku}
              onChange={(event) => setAddForm((prev) => ({ ...prev, sku: event.target.value }))}
            />
            <Input
              label="Name"
              value={addForm.name}
              onChange={(event) => setAddForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              label="Category"
              value={addForm.category}
              onChange={(event) => setAddForm((prev) => ({ ...prev, category: event.target.value }))}
            />
            <Input
              label="Price"
              type="number"
              min="0.1"
              step="0.01"
              value={addForm.price}
              onChange={(event) => setAddForm((prev) => ({ ...prev, price: event.target.value }))}
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={addForm.stock}
              onChange={(event) => setAddForm((prev) => ({ ...prev, stock: event.target.value }))}
            />
            <Input
              label="Expiry"
              type="date"
              value={addForm.expiry}
              onChange={(event) => setAddForm((prev) => ({ ...prev, expiry: event.target.value }))}
            />
          </div>

          {addError ? <p className="text-xs text-rose-600">{addError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Medicine</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showStockModal}
        onClose={() => setShowStockModal(false)}
        title="Edit Stock"
        description={selectedMedicine ? `${selectedMedicine.name} (${selectedMedicine.sku})` : ''}
      >
        <form className="space-y-3" onSubmit={(event) => void submitStockUpdate(event)}>
          <Input
            label="Stock Quantity"
            type="number"
            min="0"
            value={stockValue}
            onChange={(event) => setStockValue(event.target.value)}
          />

          {stockError ? <p className="text-xs text-rose-600">{stockError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowStockModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Update Stock</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function FinancePage({
  transactions,
  series,
  paymentBreakdown,
  currency,
  range,
  onRangeChange,
  onApplyPreset,
}) {
  const maxDaily = Math.max(...series.map((item) => item.total), 1)
  const paymentTotal = paymentBreakdown.reduce((sum, row) => sum + row.total, 0)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card
        className="xl:col-span-3"
        title="Finance Filters"
        subtitle="Use custom date range or quick presets"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant={range.preset === '30' ? 'primary' : 'secondary'}
              onClick={() => onApplyPreset(30)}
            >
              30 Days
            </Button>
            <Button
              size="sm"
              variant={range.preset === '90' ? 'primary' : 'secondary'}
              onClick={() => onApplyPreset(90)}
            >
              90 Days
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="From"
            type="date"
            value={range.from}
            onChange={(event) => onRangeChange('from', event.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={range.to}
            onChange={(event) => onRangeChange('to', event.target.value)}
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">Transactions in range</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">{transactions.length}</p>
          </div>
        </div>
      </Card>

      <Card className="xl:col-span-2" title="Daily Earnings" subtitle="Bar sparkline based on selected range">
        <div className="h-44 flex items-end gap-1.5 overflow-x-auto">
          {series.map((item) => {
            const height = Math.max(8, Math.round((item.total / maxDaily) * 120))
            return (
              <div key={item.key} className="min-w-[40px] flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-indigo-100 relative" style={{ height }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-indigo-600" style={{ height }} />
                </div>
                <p className="text-[10px] text-slate-500 leading-none">{item.label}</p>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Payment Breakdown" subtitle="% and totals in selected range">
        <div className="space-y-3">
          {paymentBreakdown.map((row) => {
            const percent = paymentTotal > 0 ? (row.total / paymentTotal) * 100 : 0
            return (
              <div key={row.method}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium capitalize">{row.method}</span>
                  <span className="text-slate-500">
                    {percent.toFixed(1)}% ({formatCurrency(row.total, currency)})
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function SettingsPage({
  settings,
  setSettings,
  onSaveSettings,
  isAdmin,
  profiles,
  onRefreshProfiles,
  onUpdateStaffRole,
  onRegisterStaff,
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffSubmitting, setStaffSubmitting] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  const save = async () => {
    setSaving(true)
    setError('')
    const result = await onSaveSettings(settings)
    if (!result.ok) {
      setError(result.message)
    }
    setSaving(false)
  }

  const submitStaff = async (event) => {
    event.preventDefault()
    setStaffSubmitting(true)
    setStaffError('')

    const result = await onRegisterStaff(staffForm)
    if (!result.ok) {
      setStaffError(result.message)
      setStaffSubmitting(false)
      return
    }

    setStaffForm({ fullName: '', email: '', password: '' })
    setShowStaffModal(false)
    setStaffSubmitting(false)
  }

  const handleRoleChange = async (profileId, role) => {
    setStaffError('')
    const result = await onUpdateStaffRole(profileId, role)
    if (!result.ok) {
      setStaffError(result.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card title="General" subtitle="Store level settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Store Name"
            value={settings.store_name}
            onChange={(event) => setSettings((prev) => ({ ...prev, store_name: event.target.value }))}
          />

          <label className="space-y-1 block">
            <span className="text-xs font-medium text-slate-600">Currency</span>
            <select
              className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              value={settings.currency}
              onChange={(event) => setSettings((prev) => ({ ...prev, currency: event.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Store Identity" subtitle="Displayed on receipts and support details">
        <div className="grid grid-cols-1 gap-3">
          <Input
            label="Address"
            value={settings.address}
            onChange={(event) => setSettings((prev) => ({ ...prev, address: event.target.value }))}
          />
          <Input
            label="Phone"
            value={settings.phone}
            onChange={(event) => setSettings((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <Input
            label="Support Email"
            type="email"
            value={settings.support_email}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, support_email: event.target.value }))
            }
          />
        </div>
      </Card>

      <Card
        className="xl:col-span-2"
        title="Settings Save"
        subtitle="Taxation section removed from UI as requested"
      >
        {error ? <p className="text-xs text-rose-600 mb-2">{error}</p> : null}
        <Button onClick={() => void save()} disabled={!isAdmin || saving} icon={Settings}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {!isAdmin ? (
          <p className="text-xs text-slate-500 mt-2">Only admins can update settings.</p>
        ) : null}
      </Card>

      {isAdmin ? (
        <Card
          className="xl:col-span-2"
          title="Staff Management"
          subtitle="Create staff accounts and manage profile roles"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" icon={Users} onClick={() => setShowStaffModal(true)}>
                Add Staff
              </Button>
              <Button size="sm" variant="secondary" icon={RefreshCcw} onClick={() => void onRefreshProfiles()}>
                Refresh
              </Button>
            </div>
          }
        >
          {staffError ? <p className="text-xs text-rose-600 mb-2">{staffError}</p> : null}
          <Table
            columns={[
              { label: 'Name' },
              { label: 'Email' },
              { label: 'Status' },
              { label: 'Role' },
              { label: 'Created' },
            ]}
          >
            {profiles.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-800">{row.full_name || 'User'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.email}</td>
                <td className="px-3 py-2 text-xs">
                  <Badge tone="emerald">Active</Badge>
                </td>
                <td className="px-3 py-2 text-xs">
                  <select
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                    value={row.role}
                    onChange={(event) => void handleRoleChange(row.id, event.target.value)}
                  >
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(row.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card className="xl:col-span-2" title="Staff Management" subtitle="Admin only section">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Staff management is only available for admins.
          </div>
        </Card>
      )}

      <Modal
        open={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        title="Add Staff Account"
        description="Creates a Supabase Auth user and sets profile role to staff."
      >
        <form className="space-y-3" onSubmit={(event) => void submitStaff(event)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={staffForm.fullName}
              onChange={(event) =>
                setStaffForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
            />
            <Input
              label="Email"
              type="email"
              value={staffForm.email}
              onChange={(event) => setStaffForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <Input
              label="Password"
              type="password"
              value={staffForm.password}
              onChange={(event) =>
                setStaffForm((prev) => ({ ...prev, password: event.target.value }))
              }
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Role</p>
              <p className="text-sm font-medium text-slate-900 mt-1">staff</p>
            </div>
          </div>

          {staffError ? <p className="text-xs text-rose-600">{staffError}</p> : null}

          <p className="text-xs text-slate-500">
            Password must be 8+ characters. If email confirmation is enabled in Supabase, the user must verify first.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowStaffModal(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={Users} disabled={staffSubmitting}>
              {staffSubmitting ? 'Creating...' : 'Create Staff'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function StatCard({ label, value, icon, trend }) {
  const Icon = icon

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{value}</p>
        </div>
        <span className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 inline-flex items-center justify-center">
          <Icon size={16} />
        </span>
      </div>
      <SparkBars values={trend} />
    </Card>
  )
}

function SparkBars({ values }) {
  const max = Math.max(...values, 1)

  return (
    <div className="mt-3 h-10 flex items-end gap-1">
      {values.map((value, index) => {
        const height = Math.max(4, Math.round((value / max) * 40))
        return (
          <div key={`${index}-${value}`} className="w-full rounded-sm bg-indigo-100" style={{ height }}>
            <div className="h-full w-full rounded-sm bg-indigo-500/80" />
          </div>
        )
      })}
    </div>
  )
}

function SignalItem({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between">
      <span className="text-xs text-slate-600">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  )
}

function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className}`}>
      {title || subtitle || action ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
          </div>
          {action ? <div className="sm:self-start">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  type = 'button',
  ...props
}) {
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
  }

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs rounded-lg',
    md: 'h-9 px-3.5 text-sm rounded-xl',
  }

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  )
}

function Badge({ children, tone = 'slate' }) {
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center h-6 px-2 rounded-full text-xs border font-medium ${toneClasses[tone] || toneClasses.slate}`}
    >
      {children}
    </span>
  )
}

function Input({ label, className = '', ...props }) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        className={`w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 ${className}`}
        {...props}
      />
    </label>
  )
}

function Modal({ open, onClose, title, description, children }) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-label="Close modal overlay"
      />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description ? <p className="text-xs text-slate-500 mt-0.5">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Table({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((column) => (
              <th
                key={column.label}
                className={`px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${column.className || ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export default App
