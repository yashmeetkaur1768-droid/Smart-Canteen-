import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import MenuCard from './components/MenuCard';
import CartDrawer from './components/CartDrawer';
import OrderTracker from './components/OrderTracker';
import OrderHistory from './components/OrderHistory';
import StaffDashboard from './components/StaffDashboard';
import AuthPage from './components/AuthPage';
import Toast from './components/Toast';
import { fetchMenu, placeOrder, getMe, logout, clearToken, clearUser, getToken, getUser } from './services/api';
import { RefreshCw } from 'lucide-react';

export default function App() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState({ loading: true, user: null, token: null });
  const [expiredMessage, setExpiredMessage] = useState('');

  // ── View state ─────────────────────────────────────────────────────────────
  const [studentView, setStudentView] = useState('menu');
  const [staffView, setStaffView] = useState('orders');

  // ── App data ───────────────────────────────────────────────────────────────
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [notification, setNotification] = useState(null);

  // ── Category filter & search (Stage 4) ────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // ── Load menu ──────────────────────────────────────────────────────────────
  const loadMenu = useCallback(async () => {
    try {
      const menuRes = await fetchMenu();
      if (menuRes.status === 'ok') setMenu(menuRes.menu || []);
    } catch (err) {
      console.error('Failed to load menu:', err);
    }
  }, []);

  // ── Auth init: restore session ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const storedToken = getToken();
      if (!storedToken) {
        setAuthState({ loading: false, user: null, token: null });
        return;
      }
      try {
        const res = await getMe();
        if (res.status === 'ok') {
          setAuthState({ loading: false, user: res.user, token: storedToken });
          loadMenu();
        } else {
          clearToken();
          clearUser();
          setAuthState({ loading: false, user: null, token: null });
        }
      } catch {
        clearToken();
        clearUser();
        setAuthState({ loading: false, user: null, token: null });
      }
    };
    init();
  }, [loadMenu]);

  // ── Listen for auth:expired event ─────────────────────────────────────────
  useEffect(() => {
    const handleExpired = () => {
      setAuthState({ loading: false, user: null, token: null });
      setExpiredMessage('Your session has expired. Please log in again.');
      setCart([]);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  // ── Handle successful auth ─────────────────────────────────────────────────
  const handleAuthSuccess = useCallback(async (user, token) => {
    setAuthState({ loading: false, user, token });
    setExpiredMessage('');
    await loadMenu();
  }, [loadMenu]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
    } catch { /* ignore errors on logout */ }
    clearToken();
    clearUser();
    setAuthState({ loading: false, user: null, token: null });
    setCart([]);
    setActiveOrderId(null);
    setStudentView('menu');
  };

  // ── Refresh student data (after order / cancel) ────────────────────────────
  const refreshAfterOrder = async () => {
    // Re-fetch user data to update balance
    try {
      const res = await getMe();
      if (res.status === 'ok') {
        setAuthState(prev => ({ ...prev, user: res.user }));
      }
    } catch { /* ignore */ }
    await loadMenu();
  };

  // ── Cart operations ────────────────────────────────────────────────────────
  const handleAddToCart = (item, quantityToAdd) => {
    setCart(prevCart => {
      const existing = prevCart.find(i => i.item_id === item.item_id);
      if (existing) {
        const updatedQty = Math.min(item.stock, existing.quantity + quantityToAdd);
        return prevCart.map(i => i.item_id === item.item_id ? { ...i, quantity: updatedQty } : i);
      }
      return [...prevCart, { ...item, quantity: quantityToAdd }];
    });
    showNotification(`Added ${quantityToAdd}× ${item.name} to cart`);
  };

  const handleUpdateQuantity = (itemId, newQty) => {
    if (newQty <= 0) { handleRemoveItem(itemId); return; }
    setCart(prev => prev.map(item => item.item_id === itemId ? { ...item, quantity: newQty } : item));
  };

  const handleRemoveItem = (itemId) => setCart(prev => prev.filter(item => item.item_id !== itemId));
  const handleClearCart = () => setCart([]);

  // ── Place order ────────────────────────────────────────────────────────────
  const handlePlaceOrder = async (orderPayload) => {
    setIsPlacingOrder(true);
    try {
      const res = await placeOrder(orderPayload);
      if (res.status === 'ok') {
        const placed = res.order;
        setActiveOrderId(placed.order_id);
        showNotification(`Order #${placed.order_id} placed. Estimated wait: ${placed.estimated_wait_minutes} mins`);
        await refreshAfterOrder();
        setStudentView('track');
      }
    } catch (err) {
      throw err;
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Greeting ───────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = authState.user?.name?.split(' ')[0] || 'there';

  // ── Filter menu ────────────────────────────────────────────────────────────
  const filteredMenu = menu.filter(item => {
    const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (authState.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading Smart Canteen…</div>
        </div>
      </div>
    );
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!authState.user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} expiredMessage={expiredMessage} />;
  }

  const role = authState.user.role;
  const activeStudent = authState.user; // for student role: student IS activeStudent

  return (
    <div className="app-container">
      {/* Reusable Toast Notification */}
      <Toast toast={notification} onClose={() => setNotification(null)} />

      {/* Main Navbar */}
      <Navbar
        user={authState.user}
        studentView={studentView}
        onStudentViewChange={setStudentView}
        staffView={staffView}
        onStaffViewChange={setStaffView}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onLogout={handleLogout}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        activeStudent={activeStudent}
        onPlaceOrder={handlePlaceOrder}
        isPlacingOrder={isPlacingOrder}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {role === 'student' ? (
          <>
            {studentView === 'menu' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Page Header */}
                <div className="page-header">
                  <div>
                    <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {greeting}, {firstName}
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      What would you like to eat today?
                    </p>
                  </div>
                  <div className="wallet-chip">
                    <span>Wallet</span>
                    <strong>₹{activeStudent?.balance?.toFixed(0) || 0}</strong>
                    {activeOrderId && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                        onClick={() => setStudentView('track')}
                      >
                        Active Order #{activeOrderId}
                      </button>
                    )}
                  </div>
                </div>

                {/* Menu Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      Canteen Menu
                    </h2>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {filteredMenu.length} of {menu.length} items
                    </span>
                  </div>

                  {/* Filter Bar */}
                  <div className="filter-bar">
                    {['All', 'Snacks', 'Main Course', 'Beverages'].map(cat => (
                      <button
                        key={cat}
                        className={`filter-chip ${categoryFilter === cat ? 'active' : ''}`}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search menu…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="menu-grid">
                    {filteredMenu.map(item => (
                      <MenuCard
                        key={item.item_id}
                        item={item}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                    {filteredMenu.length === 0 && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No items match your search.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {studentView === 'track' && (
              <OrderTracker
                orderId={activeOrderId}
                onOrderCancelled={(cancelledId) => {
                  showNotification(`Order #${cancelledId} cancelled. Inventory restored.`);
                  refreshAfterOrder();
                }}
                onSelectAnotherOrder={setActiveOrderId}
              />
            )}

            {studentView === 'history' && activeStudent && (
              <OrderHistory
                student={activeStudent}
                onSelectOrderToTrack={(orderId) => {
                  setActiveOrderId(orderId);
                  setStudentView('track');
                }}
              />
            )}
          </>
        ) : (
          /* Staff Interface */
          <StaffDashboard activeTab={staffView} />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-color)',
        padding: '1.25rem 1rem',
        textAlign: 'center',
        fontSize: '0.82rem',
        color: 'var(--text-muted)',
        marginTop: 'auto'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <strong>Smart Canteen</strong> — Viswakarma Institute Of Technology, Pune.
        </div>
      </footer>
    </div>
  );
}
