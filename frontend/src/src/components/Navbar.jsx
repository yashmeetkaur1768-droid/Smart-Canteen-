import React from 'react';
import { UtensilsCrossed, ShoppingBag, Clock, History, LayoutDashboard, LogOut, User } from 'lucide-react';

export default function Navbar({
  user,
  studentView,
  onStudentViewChange,
  staffView,
  onStaffViewChange,
  cartCount,
  onOpenCart,
  onLogout
}) {
  const role = user?.role;

  return (
    <header className="navbar">
      <div className="nav-content">
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand">
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Smart Canteen</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Predict &amp; Manage Queue
              </div>
            </div>
          </div>

          {/* Navigation Links based on active role */}
          {role === 'student' ? (
            <nav className="nav-links" style={{ marginLeft: '1rem' }}>
              <button
                className={`nav-btn ${studentView === 'menu' ? 'active' : ''}`}
                onClick={() => onStudentViewChange('menu')}
              >
                <UtensilsCrossed size={16} />
                <span>Menu</span>
              </button>
              <button
                className={`nav-btn ${studentView === 'track' ? 'active' : ''}`}
                onClick={() => onStudentViewChange('track')}
              >
                <Clock size={16} />
                <span>Live Tracker</span>
              </button>
              <button
                className={`nav-btn ${studentView === 'history' ? 'active' : ''}`}
                onClick={() => onStudentViewChange('history')}
              >
                <History size={16} />
                <span>My Orders</span>
              </button>
            </nav>
          ) : (
            <nav className="nav-links" style={{ marginLeft: '1rem' }}>
              <button
                className={`nav-btn ${staffView === 'orders' ? 'active' : ''}`}
                onClick={() => onStaffViewChange('orders')}
              >
                <LayoutDashboard size={16} />
                <span>Kitchen Queue</span>
              </button>
              <button
                className={`nav-btn ${staffView === 'inventory' ? 'active' : ''}`}
                onClick={() => onStaffViewChange('inventory')}
              >
                <ShoppingBag size={16} />
                <span>Menu &amp; Stock</span>
              </button>
              <button
                className={`nav-btn ${staffView === 'cancellations' ? 'active' : ''}`}
                onClick={() => onStaffViewChange('cancellations')}
              >
                <History size={16} />
                <span>Cancellations</span>
              </button>
            </nav>
          )}
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* User info chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'var(--bg-surface-alt)',
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem'
          }}>
            <User size={15} color="var(--primary)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {user?.name?.split(' ')[0] || user?.username}
            </span>
            {role === 'student' && user?.balance !== undefined && (
              <span style={{
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--primary-light)',
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem'
              }}>
                ₹{user.balance?.toFixed(0)}
              </span>
            )}
            {role === 'staff' && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'var(--primary)',
                color: '#fff',
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                Staff
              </span>
            )}
          </div>

          {/* Cart Trigger (students only) */}
          {role === 'student' && (
            <button
              className="btn btn-primary"
              onClick={onOpenCart}
              style={{ position: 'relative', padding: '0.45rem 0.9rem' }}
            >
              <ShoppingBag size={17} />
              <span>Cart</span>
              {cartCount > 0 && (
                <span style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: 9999,
                  marginLeft: '0.2rem'
                }}>
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Logout button */}
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              padding: '0.4rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)'
            }}
            title="Logout"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
