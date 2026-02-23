import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ChevronRight,
  CreditCard,
  DollarSign,
  Edit3,
  LogOut,
  Menu,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Wallet,
  X,
  LayoutDashboard,
  Trash2,
} from 'lucide-react'

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

const PAYMENT_METHODS = ['Cash', 'Card', 'Insurance']
const LOW_STOCK_THRESHOLD = 10

const SEED_USERS = [
  {
    id: 'USR-001',
    name: 'Admin User',
    email: 'admin@pharmacy.com',
    password: 'Admin123!',
    role: 'admin',
    active: true,
  },
]

const SEED_SETTINGS = {
  storeName: 'NovaCare Pharmacy',
  currency: 'USD',
  taxRate: 7.5,
  pricesIncludeTax: false,
  address: '145 Cedar Avenue, Portland, OR 97204',
  phone: '+1 (503) 555-0144',
  supportEmail: 'support@novacarepharmacy.com',
}

const SEED_MEDICINES = [
  {
    sku: 'MED-1001',
    name: 'Paracetamol 500mg',
    category: 'Pain Relief',
    price: 4.5,
    stock: 52,
    expiryDate: '2027-03-14',
  },
  {
    sku: 'MED-1002',
    name: 'Ibuprofen 200mg',
    category: 'Pain Relief',
    price: 6.2,
    stock: 9,
    expiryDate: '2027-11-20',
  },
  {
    sku: 'MED-1003',
    name: 'Amoxicillin 250mg',
    category: 'Antibiotic',
    price: 12.9,
    stock: 18,
    expiryDate: '2026-08-10',
  },
  {
    sku: 'MED-1004',
    name: 'Metformin 500mg',
    category: 'Diabetes',
    price: 10.8,
    stock: 35,
    expiryDate: '2027-01-22',
  },
  {
    sku: 'MED-1005',
    name: 'Lisinopril 10mg',
    category: 'Cardiology',
    price: 8.4,
    stock: 7,
    expiryDate: '2026-05-01',
  },
  {
    sku: 'MED-1006',
    name: 'Cetirizine 10mg',
    category: 'Allergy',
    price: 5.95,
    stock: 41,
    expiryDate: '2028-02-18',
  },
  {
    sku: 'MED-1007',
    name: 'Omeprazole 20mg',
    category: 'Digestive',
    price: 9.15,
    stock: 12,
    expiryDate: '2026-10-05',
  },
  {
    sku: 'MED-1008',
    name: 'Insulin Glargine',
    category: 'Diabetes',
    price: 42.4,
    stock: 4,
    expiryDate: '2025-12-01',
  },
]

function daysAgoIso(daysAgo, hour = 11) {
  const date = new Date()
  date.setHours(hour, 15, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

const SEED_TRANSACTIONS = [
  {
    id: 'TX-430112',
    datetime: daysAgoIso(6),
    items: [
      { sku: 'MED-1001', name: 'Paracetamol 500mg', qty: 2, price: 4.5 },
      { sku: 'MED-1006', name: 'Cetirizine 10mg', qty: 1, price: 5.95 },
    ],
    itemsCount: 3,
    subtotal: 14.95,
    tax: 1.12,
    total: 16.07,
    paymentMethod: 'Cash',
  },
  {
    id: 'TX-430113',
    datetime: daysAgoIso(4),
    items: [{ sku: 'MED-1003', name: 'Amoxicillin 250mg', qty: 1, price: 12.9 }],
    itemsCount: 1,
    subtotal: 12.9,
    tax: 0.97,
    total: 13.87,
    paymentMethod: 'Card',
  },
  {
    id: 'TX-430114',
    datetime: daysAgoIso(2),
    items: [
      { sku: 'MED-1002', name: 'Ibuprofen 200mg', qty: 1, price: 6.2 },
      { sku: 'MED-1004', name: 'Metformin 500mg', qty: 2, price: 10.8 },
    ],
    itemsCount: 3,
    subtotal: 27.8,
    tax: 2.09,
    total: 29.89,
    paymentMethod: 'Insurance',
  },
  {
    id: 'TX-430115',
    datetime: daysAgoIso(1),
    items: [{ sku: 'MED-1007', name: 'Omeprazole 20mg', qty: 1, price: 9.15 }],
    itemsCount: 1,
    subtotal: 9.15,
    tax: 0.69,
    total: 9.84,
    paymentMethod: 'Card',
  },
]

function normalizeEmail(value) {
  return value.trim().toLowerCase()
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function roundMoney(value) {
  return Number((value || 0).toFixed(2))
}

function getMedicineStatus(medicine) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(`${medicine.expiryDate}T00:00:00`)

  if (expiry < today) {
    return 'Expired'
  }
  if (Number(medicine.stock) <= LOW_STOCK_THRESHOLD) {
    return 'Low Stock'
  }
  return 'In Stock'
}

function build7DaySeries(transactions) {
  const byDay = {}
  for (const tx of transactions) {
    const key = tx.datetime.slice(0, 10)
    if (!byDay[key]) {
      byDay[key] = { total: 0, count: 0 }
    }
    byDay[key].total += Number(tx.total)
    byDay[key].count += 1
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
    return {
      key,
      label,
      total: roundMoney(byDay[key]?.total || 0),
      count: byDay[key]?.count || 0,
    }
  })
}

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function App() {
  const [users, setUsers] = useState(SEED_USERS)
  const [currentUser, setCurrentUser] = useState(null)

  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')

  const [settings, setSettings] = useState(SEED_SETTINGS)
  const [inventory, setInventory] = useState(SEED_MEDICINES)
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS)

  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])

  const [flash, setFlash] = useState(null)

  const inventoryWithStatus = useMemo(
    () => inventory.map((item) => ({ ...item, status: getMedicineStatus(item) })),
    [inventory],
  )

  const categories = useMemo(() => {
    const set = new Set(inventoryWithStatus.map((item) => item.category))
    return ['All', ...Array.from(set)]
  }, [inventoryWithStatus])

  const dailySeries = useMemo(() => build7DaySeries(transactions), [transactions])

  const paymentBreakdown = useMemo(() => {
    return PAYMENT_METHODS.map((method) => {
      const total = transactions
        .filter((tx) => tx.paymentMethod === method)
        .reduce((sum, tx) => sum + tx.total, 0)
      return { method, total: roundMoney(total) }
    })
  }, [transactions])

  const dashboardStats = useMemo(() => {
    const revenue = transactions.reduce((sum, tx) => sum + tx.total, 0)
    const transactionsCount = transactions.length
    const stockValue = inventoryWithStatus.reduce((sum, med) => sum + med.price * med.stock, 0)
    const lowStockCount = inventoryWithStatus.filter((med) => med.status === 'Low Stock').length
    return {
      revenue: roundMoney(revenue),
      transactionsCount,
      stockValue: roundMoney(stockValue),
      lowStockCount,
    }
  }, [transactions, inventoryWithStatus])

  const inventorySignals = useMemo(() => {
    return {
      lowStock: inventoryWithStatus.filter((med) => med.status === 'Low Stock').length,
      expired: inventoryWithStatus.filter((med) => med.status === 'Expired').length,
    }
  }, [inventoryWithStatus])

  const cartSubtotal = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + item.price * item.qty, 0)),
    [cart],
  )

  const cartTax = useMemo(() => {
    const rate = Number(settings.taxRate) / 100
    if (!rate || cartSubtotal <= 0) {
      return 0
    }
    if (settings.pricesIncludeTax) {
      return roundMoney(cartSubtotal - cartSubtotal / (1 + rate))
    }
    return roundMoney(cartSubtotal * rate)
  }, [cartSubtotal, settings.taxRate, settings.pricesIncludeTax])

  const cartTotal = useMemo(() => {
    if (settings.pricesIncludeTax) {
      return cartSubtotal
    }
    return roundMoney(cartSubtotal + cartTax)
  }, [cartSubtotal, cartTax, settings.pricesIncludeTax])

  const notify = (type, message) => {
    setFlash({ type, message })
    window.clearTimeout(notify.timer)
    notify.timer = window.setTimeout(() => {
      setFlash(null)
    }, 3200)
  }

  const handleLogin = ({ email, password }) => {
    const user = users.find((item) => normalizeEmail(item.email) === normalizeEmail(email))
    if (!user || user.password !== password) {
      return { ok: false, message: 'Invalid email or password.' }
    }
    if (!user.active) {
      return { ok: false, message: 'This account is inactive. Contact an administrator.' }
    }

    setCurrentUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
    })
    setActivePage('dashboard')
    setSidebarOpen(false)
    setHeaderSearch('')
    return { ok: true }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setCart([])
    setPaymentMethod(PAYMENT_METHODS[0])
    setHeaderSearch('')
  }

  const canManageInventory = currentUser?.role === 'admin'
  const canManageStaff = currentUser?.role === 'admin'

  const addToCart = (medicine) => {
    if (medicine.status === 'Expired') {
      notify('error', `${medicine.name} is expired and cannot be sold.`)
      return
    }

    const currentQty = cart.find((item) => item.sku === medicine.sku)?.qty || 0
    if (currentQty >= medicine.stock) {
      notify('error', `Insufficient stock for ${medicine.name}.`)
      return
    }

    setCart((prev) => {
      const exists = prev.find((item) => item.sku === medicine.sku)
      if (!exists) {
        return [
          ...prev,
          {
            sku: medicine.sku,
            name: medicine.name,
            price: medicine.price,
            qty: 1,
          },
        ]
      }
      return prev.map((item) =>
        item.sku === medicine.sku ? { ...item, qty: item.qty + 1 } : item,
      )
    })
  }

  const updateCartQty = (sku, nextQty) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((item) => item.sku !== sku))
      return
    }

    const source = inventoryWithStatus.find((item) => item.sku === sku)
    const maxQty = source?.stock || 0

    setCart((prev) =>
      prev.map((item) =>
        item.sku === sku
          ? {
              ...item,
              qty: Math.min(nextQty, maxQty),
            }
          : item,
      ),
    )
  }

  const removeCartItem = (sku) => {
    setCart((prev) => prev.filter((item) => item.sku !== sku))
  }

  const completeSale = () => {
    if (cart.length === 0) {
      notify('error', 'Add items to the cart before completing a sale.')
      return
    }

    for (const cartItem of cart) {
      const source = inventoryWithStatus.find((item) => item.sku === cartItem.sku)
      if (!source) {
        notify('error', `Item ${cartItem.name} no longer exists in inventory.`)
        return
      }
      if (source.status === 'Expired') {
        notify('error', `${source.name} is expired and cannot be sold.`)
        return
      }
      if (cartItem.qty > source.stock) {
        notify('error', `Stock is insufficient for ${source.name}.`)
        return
      }
    }

    const subtotal = roundMoney(cart.reduce((sum, item) => sum + item.qty * item.price, 0))
    const taxRate = Number(settings.taxRate) / 100

    let tax = 0
    let total = subtotal

    if (taxRate > 0) {
      if (settings.pricesIncludeTax) {
        tax = roundMoney(subtotal - subtotal / (1 + taxRate))
      } else {
        tax = roundMoney(subtotal * taxRate)
        total = roundMoney(subtotal + tax)
      }
    }

    const soldMap = cart.reduce((acc, item) => {
      acc[item.sku] = (acc[item.sku] || 0) + item.qty
      return acc
    }, {})

    setInventory((prev) =>
      prev.map((medicine) => {
        const qty = soldMap[medicine.sku] || 0
        if (!qty) {
          return medicine
        }
        return { ...medicine, stock: Math.max(0, medicine.stock - qty) }
      }),
    )

    const transaction = {
      id: `TX-${Date.now().toString().slice(-7)}`,
      datetime: new Date().toISOString(),
      items: cart.map((item) => ({ ...item })),
      itemsCount: cart.reduce((sum, item) => sum + item.qty, 0),
      subtotal,
      tax,
      total,
      paymentMethod,
    }

    setTransactions((prev) => [transaction, ...prev])
    setCart([])
    setPaymentMethod(PAYMENT_METHODS[0])
    notify('success', `Sale completed successfully (${formatCurrency(total, settings.currency)}).`)
  }

  const addMedicine = (payload) => {
    if (!canManageInventory) {
      return { ok: false, message: 'Only admins can add medicines.' }
    }

    const required = ['sku', 'name', 'category', 'price', 'stock', 'expiryDate']
    for (const key of required) {
      if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
        return { ok: false, message: 'All medicine fields are required.' }
      }
    }

    if (inventory.some((med) => med.sku.toLowerCase() === String(payload.sku).trim().toLowerCase())) {
      return { ok: false, message: 'SKU must be unique.' }
    }

    const nextMedicine = {
      sku: String(payload.sku).trim(),
      name: String(payload.name).trim(),
      category: String(payload.category).trim(),
      price: Number(payload.price),
      stock: Number(payload.stock),
      expiryDate: payload.expiryDate,
    }

    if (!nextMedicine.sku || !nextMedicine.name || !nextMedicine.category) {
      return { ok: false, message: 'SKU, name, and category cannot be empty.' }
    }
    if (Number.isNaN(nextMedicine.price) || nextMedicine.price < 0) {
      return { ok: false, message: 'Price must be a valid number.' }
    }
    if (Number.isNaN(nextMedicine.stock) || nextMedicine.stock < 0) {
      return { ok: false, message: 'Stock must be a valid number.' }
    }

    setInventory((prev) => [...prev, nextMedicine])
    notify('success', `${nextMedicine.name} added to inventory.`)
    return { ok: true }
  }

  const editMedicineStock = (sku, stock) => {
    if (!canManageInventory) {
      return { ok: false, message: 'Only admins can edit stock.' }
    }

    if (stock === '' || Number(stock) < 0 || Number.isNaN(Number(stock))) {
      return { ok: false, message: 'Stock must be 0 or greater.' }
    }

    setInventory((prev) =>
      prev.map((medicine) =>
        medicine.sku === sku ? { ...medicine, stock: Number(stock) } : medicine,
      ),
    )

    notify('success', `Stock updated for ${sku}.`)
    return { ok: true }
  }

  const addStaffUser = (payload) => {
    if (!canManageStaff) {
      return { ok: false, message: 'Only admins can create staff accounts.' }
    }

    const name = String(payload.name || '').trim()
    const email = normalizeEmail(String(payload.email || ''))
    const password = String(payload.password || '')
    const role = payload.role === 'admin' ? 'admin' : 'staff'
    const active = Boolean(payload.active)

    if (!name || !email || !password) {
      return { ok: false, message: 'Name, email, and password are required.' }
    }

    if (password.length < 8) {
      return { ok: false, message: 'Password must be at least 8 characters.' }
    }

    if (users.some((user) => normalizeEmail(user.email) === email)) {
      return { ok: false, message: 'Email must be unique.' }
    }

    setUsers((prev) => [
      ...prev,
      {
        id: `USR-${Date.now().toString().slice(-6)}`,
        name,
        email,
        password,
        role,
        active,
      },
    ])

    notify('success', `${name} account created.`)
    return { ok: true }
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />
  }

  const pageTitle = PAGE_TITLES[activePage]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-sm">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      ) : null}

      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page)
          setSidebarOpen(false)
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="md:pl-64">
        <HeaderBar
          title={pageTitle}
          breadcrumb={['Home', pageTitle]}
          searchValue={headerSearch}
          onSearchChange={setHeaderSearch}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          user={currentUser}
          onLogout={handleLogout}
        />

        <main className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-4">
          {flash ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${
                flash.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {flash.message}
            </div>
          ) : null}

          {activePage === 'dashboard' ? (
            <DashboardPage
              stats={dashboardStats}
              dailySeries={dailySeries}
              transactions={transactions}
              inventorySignals={inventorySignals}
              currency={settings.currency}
            />
          ) : null}

          {activePage === 'pos' ? (
            <POSPage
              medicines={inventoryWithStatus}
              categories={categories}
              globalSearch={headerSearch}
              cart={cart}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              onAddToCart={addToCart}
              onUpdateQty={updateCartQty}
              onRemoveItem={removeCartItem}
              onCompleteSale={completeSale}
              subtotal={cartSubtotal}
              tax={cartTax}
              total={cartTotal}
              settings={settings}
            />
          ) : null}

          {activePage === 'inventory' ? (
            <InventoryPage
              medicines={inventoryWithStatus}
              categories={categories}
              globalSearch={headerSearch}
              canManageInventory={canManageInventory}
              onAddMedicine={addMedicine}
              onEditStock={editMedicineStock}
              currency={settings.currency}
            />
          ) : null}

          {activePage === 'finance' ? (
            <FinancePage
              dailySeries={dailySeries}
              paymentBreakdown={paymentBreakdown}
              transactions={transactions}
              currency={settings.currency}
            />
          ) : null}

          {activePage === 'settings' ? (
            <SettingsPage
              settings={settings}
              onSettingsChange={setSettings}
              users={users}
              currentUser={currentUser}
              onAddStaff={addStaffUser}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('admin@pharmacy.com')
  const [password, setPassword] = useState('Admin123!')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    setError('')
    const result = onLogin({ email, password })
    if (!result.ok) {
      setError(result.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-5">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold">Pharmacy SaaS</p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Login</h1>
          <p className="text-xs text-slate-500 mt-1">Use your account credentials to continue.</p>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@pharmacy.com"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}

          <Button type="submit" className="w-full" icon={Shield}>
            Sign In
          </Button>
        </form>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Seed Admin</p>
          <p>Email: admin@pharmacy.com</p>
          <p>Password: Admin123!</p>
        </div>
      </Card>
    </div>
  )
}

function Sidebar({ activePage, onNavigate, isOpen, onClose }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-white/60 backdrop-blur-md border-r border-slate-200 transition-transform duration-200 md:translate-x-0 ${
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
              type="button"
              key={item.id}
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
                <div className="flex items-center gap-1" key={item + index}>
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
              placeholder="Search medicines, transactions..."
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
                <span className="block text-slate-800 font-medium">{user.name}</span>
                <span className="block text-slate-500 capitalize">{user.role}</span>
              </span>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-sm p-2">
                <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{user.email}</p>
                  <p className="text-xs text-slate-500 capitalize">Role: {user.role}</p>
                </div>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogout()
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
    </header>
  )
}

function DashboardPage({ stats, dailySeries, transactions, inventorySignals, currency }) {
  const revenueTrend = dailySeries.map((item) => item.total)
  const transactionsTrend = dailySeries.map((item) => item.count)
  const stockTrend = dailySeries.map((_, index) => Math.max(1, stats.stockValue * (0.9 + index * 0.015)))
  const lowStockTrend = dailySeries.map((_, index) => Math.max(0, stats.lowStockCount + (index % 2 === 0 ? 1 : 0)))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Revenue"
          value={formatCurrency(stats.revenue, currency)}
          icon={DollarSign}
          trend={revenueTrend}
        />
        <StatCard
          label="Transactions"
          value={String(stats.transactionsCount)}
          icon={Receipt}
          trend={transactionsTrend}
        />
        <StatCard
          label="Stock Value"
          value={formatCurrency(stats.stockValue, currency)}
          icon={Package}
          trend={stockTrend}
        />
        <StatCard
          label="Low Stock"
          value={String(stats.lowStockCount)}
          icon={AlertTriangle}
          trend={lowStockTrend}
        />
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
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{tx.id}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(tx.datetime)}</td>
                <td className="px-3 py-2 text-xs text-right text-slate-700">{tx.itemsCount}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{tx.paymentMethod}</td>
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
  subtotal,
  tax,
  total,
  settings,
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
            const inCartQty = cart.find((item) => item.sku === medicine.sku)?.qty || 0
            const available = Math.max(0, medicine.stock - inCartQty)
            const disabled = medicine.status === 'Expired' || available <= 0

            return (
              <div key={medicine.sku} className="rounded-xl border border-slate-100 bg-white p-3">
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
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(medicine.price, settings.currency)}
                  </span>
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

      <Card className="sticky top-[72px]" title="Digital Receipt" subtitle={`Items: ${totalItems}`}>
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500 text-center">
              No medicines in receipt.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.sku} className="rounded-xl border border-slate-100 bg-white p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(item.price, settings.currency)} each</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.sku)}
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
                      onClick={() => onUpdateQty(item.sku, item.qty - 1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-xs font-medium">{item.qty}</span>
                    <button
                      type="button"
                      className="p-1.5 text-slate-600 hover:bg-slate-100"
                      onClick={() => onUpdateQty(item.sku, item.qty + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    {formatCurrency(item.qty * item.price, settings.currency)}
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
                type="button"
                key={method}
                onClick={() => onPaymentMethodChange(method)}
                className={`h-8 rounded-lg text-xs border ${
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
            <span>{formatCurrency(subtotal, settings.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Tax ({Number(settings.taxRate).toFixed(1)}%)</span>
            <span>{formatCurrency(tax, settings.currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(total, settings.currency)}</span>
          </div>
        </div>

        <Button className="w-full mt-3" onClick={onCompleteSale} icon={CreditCard}>
          Complete Sale
        </Button>
      </Card>
    </div>
  )
}

function InventoryPage({
  medicines,
  categories,
  globalSearch,
  canManageInventory,
  onAddMedicine,
  onEditStock,
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
    expiryDate: '',
  })
  const [addError, setAddError] = useState('')

  const [editStockValue, setEditStockValue] = useState('')
  const [editStockError, setEditStockError] = useState('')

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

  const submitAddMedicine = (event) => {
    event.preventDefault()
    setAddError('')
    const result = onAddMedicine(addForm)
    if (!result.ok) {
      setAddError(result.message)
      return
    }

    setAddForm({
      sku: '',
      name: '',
      category: '',
      price: '',
      stock: '',
      expiryDate: '',
    })
    setShowAddModal(false)
  }

  const openStockEditor = (medicine) => {
    setSelectedMedicine(medicine)
    setEditStockValue(String(medicine.stock))
    setEditStockError('')
    setShowStockModal(true)
  }

  const submitStockEdit = (event) => {
    event.preventDefault()
    if (!selectedMedicine) {
      return
    }
    const result = onEditStock(selectedMedicine.sku, editStockValue)
    if (!result.ok) {
      setEditStockError(result.message)
      return
    }

    setShowStockModal(false)
    setSelectedMedicine(null)
    setEditStockValue('')
  }

  return (
    <div className="space-y-4">
      <Card
        title="Inventory"
        subtitle="Single source of truth for POS"
        action={
          <div className="flex items-center gap-2">
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
            {canManageInventory ? (
              <Button size="sm" onClick={() => setShowAddModal(true)} icon={Plus}>
                Add Medicine
              </Button>
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
            ...(canManageInventory ? [{ label: 'Action', className: 'text-right' }] : []),
          ]}
        >
          {filtered.map((medicine) => (
            <tr key={medicine.sku} className="border-t border-slate-100">
              <td className="px-3 py-2 text-xs font-medium text-slate-800">{medicine.sku}</td>
              <td className="px-3 py-2 text-xs text-slate-800">{medicine.name}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{medicine.category}</td>
              <td className="px-3 py-2 text-xs text-right text-slate-700">
                {formatCurrency(medicine.price, currency)}
              </td>
              <td className="px-3 py-2 text-xs text-right font-medium text-slate-800">{medicine.stock}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{medicine.expiryDate}</td>
              <td className="px-3 py-2 text-xs">
                <Badge tone={statusTone(medicine.status)}>{medicine.status}</Badge>
              </td>
              {canManageInventory ? (
                <td className="px-3 py-2 text-xs text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Edit3}
                    onClick={() => openStockEditor(medicine)}
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
        description="Create a medicine record for inventory and POS."
      >
        <form className="space-y-3" onSubmit={submitAddMedicine}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="SKU"
              value={addForm.sku}
              onChange={(event) => setAddForm((prev) => ({ ...prev, sku: event.target.value }))}
              placeholder="MED-1011"
            />
            <Input
              label="Name"
              value={addForm.name}
              onChange={(event) => setAddForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Medicine name"
            />
            <Input
              label="Category"
              value={addForm.category}
              onChange={(event) => setAddForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Category"
            />
            <Input
              label="Price"
              type="number"
              min="0"
              step="0.01"
              value={addForm.price}
              onChange={(event) => setAddForm((prev) => ({ ...prev, price: event.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={addForm.stock}
              onChange={(event) => setAddForm((prev) => ({ ...prev, stock: event.target.value }))}
              placeholder="0"
            />
            <Input
              label="Expiry Date"
              type="date"
              value={addForm.expiryDate}
              onChange={(event) => setAddForm((prev) => ({ ...prev, expiryDate: event.target.value }))}
            />
          </div>

          {addError ? <p className="text-xs text-rose-600">{addError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>
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
        <form className="space-y-3" onSubmit={submitStockEdit}>
          <Input
            label="Stock Quantity"
            type="number"
            min="0"
            value={editStockValue}
            onChange={(event) => setEditStockValue(event.target.value)}
          />

          {editStockError ? <p className="text-xs text-rose-600">{editStockError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowStockModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Update Stock</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function FinancePage({ dailySeries, paymentBreakdown, transactions, currency }) {
  const maxDaily = Math.max(...dailySeries.map((item) => item.total), 1)
  const paymentTotal = paymentBreakdown.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2" title="Daily Earnings" subtitle="Last 7 days">
        <div className="h-44 flex items-end gap-2">
          {dailySeries.map((item) => {
            const height = Math.max(8, Math.round((item.total / maxDaily) * 120))
            return (
              <div key={item.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full max-w-[42px] rounded-t-md bg-indigo-100 relative" style={{ height }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-indigo-600" style={{ height }} />
                </div>
                <p className="text-[10px] text-slate-500 leading-none">{item.label}</p>
                <p className="text-[10px] text-slate-700 font-medium leading-none">
                  {formatCurrency(item.total, currency)}
                </p>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Payment Breakdown" subtitle="By method">
        <div className="space-y-3">
          {paymentBreakdown.map((item) => {
            const percent = paymentTotal > 0 ? (item.total / paymentTotal) * 100 : 0
            return (
              <div key={item.method}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium">{item.method}</span>
                  <span className="text-slate-500">
                    {percent.toFixed(1)}% ({formatCurrency(item.total, currency)})
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

      <Card className="xl:col-span-3" title="Finance Summary" subtitle="Transactions and totals">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Transactions</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">{transactions.length}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Revenue</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">
              {formatCurrency(transactions.reduce((sum, tx) => sum + tx.total, 0), currency)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Tax Collected</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">
              {formatCurrency(transactions.reduce((sum, tx) => sum + tx.tax, 0), currency)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function SettingsPage({ settings, onSettingsChange, users, currentUser, onAddStaff }) {
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    active: true,
  })
  const [staffError, setStaffError] = useState('')

  const isAdmin = currentUser.role === 'admin'

  const updateField = (key, value) => {
    onSettingsChange((prev) => ({ ...prev, [key]: value }))
  }

  const submitStaff = (event) => {
    event.preventDefault()
    setStaffError('')
    const result = onAddStaff(staffForm)
    if (!result.ok) {
      setStaffError(result.message)
      return
    }

    setStaffForm({ name: '', email: '', password: '', role: 'staff', active: true })
    setShowStaffModal(false)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card title="General" subtitle="Store level settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Store Name"
            value={settings.storeName}
            onChange={(event) => updateField('storeName', event.target.value)}
          />
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-slate-600">Currency</span>
            <select
              className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              value={settings.currency}
              onChange={(event) => updateField('currency', event.target.value)}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Taxation" subtitle="Applied in POS checkout">
        <div className="space-y-3">
          <Input
            label="Tax Rate (%)"
            type="number"
            min="0"
            step="0.1"
            value={settings.taxRate}
            onChange={(event) => updateField('taxRate', Number(event.target.value || 0))}
          />

          <label className="h-9 rounded-xl border border-slate-200 bg-white px-3 flex items-center justify-between">
            <span className="text-xs text-slate-700">Prices include tax</span>
            <input
              type="checkbox"
              checked={settings.pricesIncludeTax}
              onChange={(event) => updateField('pricesIncludeTax', event.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>
      </Card>

      <Card title="Store Identity" subtitle="Displayed on receipts and contact channels" className="xl:col-span-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Address"
            value={settings.address}
            onChange={(event) => updateField('address', event.target.value)}
          />
          <Input
            label="Phone"
            value={settings.phone}
            onChange={(event) => updateField('phone', event.target.value)}
          />
          <Input
            label="Support Email"
            type="email"
            value={settings.supportEmail}
            onChange={(event) => updateField('supportEmail', event.target.value)}
          />
        </div>
      </Card>

      {isAdmin ? (
        <Card
          title="Staff Management"
          subtitle="Create and manage staff accounts"
          className="xl:col-span-2"
          action={
            <Button size="sm" onClick={() => setShowStaffModal(true)} icon={Users}>
              Add Staff
            </Button>
          }
        >
          <Table
            columns={[
              { label: 'Name' },
              { label: 'Email' },
              { label: 'Role' },
              { label: 'Status' },
            ]}
          >
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{user.name}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{user.email}</td>
                <td className="px-3 py-2 text-xs">
                  <Badge tone={user.role === 'admin' ? 'indigo' : 'slate'}>{user.role}</Badge>
                </td>
                <td className="px-3 py-2 text-xs">
                  <Badge tone={user.active ? 'emerald' : 'rose'}>
                    {user.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card className="xl:col-span-2" title="Staff Management" subtitle="Admin only section">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Staff accounts can be created only by admins.
          </div>
        </Card>
      )}

      <Modal
        open={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        title="Add Staff Account"
        description="New users can login immediately after creation."
      >
        <form className="space-y-3" onSubmit={submitStaff}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Name"
              value={staffForm.name}
              onChange={(event) => setStaffForm((prev) => ({ ...prev, name: event.target.value }))}
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
              onChange={(event) => setStaffForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-600">Role</span>
              <select
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                value={staffForm.role}
                onChange={(event) => setStaffForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>

          <label className="h-9 rounded-xl border border-slate-200 bg-white px-3 flex items-center justify-between">
            <span className="text-xs text-slate-700">Active account</span>
            <input
              type="checkbox"
              checked={staffForm.active}
              onChange={(event) => setStaffForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="h-4 w-4"
            />
          </label>

          {staffError ? <p className="text-xs text-rose-600">{staffError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowStaffModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Staff</Button>
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
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
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

function statusTone(status) {
  if (status === 'Expired') {
    return 'rose'
  }
  if (status === 'Low Stock') {
    return 'amber'
  }
  return 'emerald'
}

export default App
