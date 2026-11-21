import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  CheckCircle,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  Package,
  XCircle,
  Zap,
  Plus,
  RefreshCw,
  Edit2,
  FileText
} from 'lucide-react';
import {
  fetchStaffDashboard,
  staffStartPrep,
  staffMarkReady,
  staffCompleteOrder,
  updateInventory,
  updateMenuItem,
  fetchCancellations
} from '../services/api';

export default function StaffDashboard({ activeTab = 'orders' }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState('active'); // 'active', 'priority', 'normal', 'all'
  const [actionInProgress, setActionInProgress] = useState(null);

  // Edit price modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  const loadData = async () => {
    try {
      const [dashRes, cancRes] = await Promise.all([
        fetchStaffDashboard(),
        fetchCancellations()
      ]);
      if (dashRes.status === 'ok') {
        setDashboardData(dashRes);
      }
      if (cancRes.status === 'ok') {
        setCancellations(cancRes.cancellations || []);
      }
    } catch (err) {
      console.error('Failed to load staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStartPrep = async (orderId) => {
    setActionInProgress(orderId);
    try {
      await staffStartPrep(orderId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to start preparation');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkReady = async (orderId) => {
    setActionInProgress(orderId);
    try {
      await staffMarkReady(orderId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to mark order ready');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleComplete = async (orderId) => {
    setActionInProgress(orderId);
    try {
      await staffCompleteOrder(orderId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to complete order');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestock = async (itemId, deltaQty) => {
    try {
      await updateInventory(itemId, { restock_quantity: deltaQty });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update inventory');
    }
  };

  const handleSavePrice = async () => {
    if (!editingItem || !editPrice) return;
    try {
      await updateMenuItem(editingItem.item_id, { price: parseFloat(editPrice) });
      setEditingItem(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update price');
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary)' }} />
        <div style={{ color: 'var(--text-muted)' }}>Loading canteen staff dashboard...</div>
      </div>
    );
  }

  const { stats, low_stock_warnings, orders } = dashboardData || {
    stats: {},
    low_stock_warnings: [],
    orders: []
  };

  // Filter orders according to selected tab
  const filteredOrders = orders.filter(o => {
    if (queueFilter === 'active') return ['Pending', 'Preparing', 'Ready'].includes(o.status);
    if (queueFilter === 'priority') return o.is_prepaid && ['Pending', 'Preparing'].includes(o.status);
    if (queueFilter === 'normal') return !o.is_prepaid && ['Pending', 'Preparing'].includes(o.status);
    return true; // 'all'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem'
      }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active In Queue</span>
            <Flame size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {stats.active_queue || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2 Kitchen Stations active</div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Today's Sales</span>
            <TrendingUp size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.35rem' }}>
            ₹{stats.total_sales?.toFixed(0) || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.completed_orders || 0} orders completed</div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Placed</span>
            <Package size={18} color="var(--text-main)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {stats.total_orders || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.cancelled_orders || 0} cancellations</div>
        </div>

        <div className="card" style={{
          padding: '1rem',
          backgroundColor: low_stock_warnings.length > 0 ? '#fffbeb' : 'var(--bg-surface)',
          borderColor: low_stock_warnings.length > 0 ? '#fde68a' : 'var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: low_stock_warnings.length > 0 ? '#92400e' : 'var(--text-muted)', fontWeight: 600 }}>
              Low Stock Alerts
            </span>
            <AlertTriangle size={18} color={low_stock_warnings.length > 0 ? '#d97706' : 'var(--text-muted)'} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: low_stock_warnings.length > 0 ? '#b45309' : 'var(--text-main)', marginTop: '0.35rem' }}>
            {low_stock_warnings.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {low_stock_warnings.length > 0 ? `${low_stock_warnings.map(i => i.name).join(', ')}` : 'All inventory healthy'}
          </div>
        </div>
      </div>

      {/* View Switcher based on activeTab */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Queue Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Live Kitchen Queue</h3>

            <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-surface-alt)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button
                className={`role-btn ${queueFilter === 'active' ? 'active' : ''}`}
                onClick={() => setQueueFilter('active')}
              >
                Active Kitchen ({orders.filter(o => ['Pending', 'Preparing', 'Ready'].includes(o.status)).length})
              </button>
              <button
                className={`role-btn ${queueFilter === 'priority' ? 'active' : ''}`}
                onClick={() => setQueueFilter('priority')}
              >
                ⚡ Priority ({orders.filter(o => o.is_prepaid && ['Pending', 'Preparing'].includes(o.status)).length})
              </button>
              <button
                className={`role-btn ${queueFilter === 'normal' ? 'active' : ''}`}
                onClick={() => setQueueFilter('normal')}
              >
                Standard Orders ({orders.filter(o => !o.is_prepaid && ['Pending', 'Preparing'].includes(o.status)).length})
              </button>
              <button
                className={`role-btn ${queueFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQueueFilter('all')}
              >
                All Orders ({orders.length})
              </button>
            </div>
          </div>

          {/* Orders Cards List */}
          {filteredOrders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <CheckCircle size={36} color="var(--primary)" style={{ margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontWeight: 600 }}>Kitchen queue is clear!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No orders currently waiting in this view.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filteredOrders.map(ord => (
                <div
                  key={ord.order_id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    borderLeft: ord.is_prepaid ? '4px solid var(--accent)' : '4px solid var(--primary)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.05rem' }}>
                        Order #{ord.order_id}
                      </span>
                      <span className={`status-badge status-${ord.status.toLowerCase()}`}>
                        {ord.status}
                      </span>
                      {ord.is_prepaid && (
                        <span className="priority-badge">
                          ⚡ Priority Order
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Seq: #{ord.sequence_number}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                      Student: <strong>{ord.student_name}</strong> ({ord.student_id}) • Placed at {ord.created_at}
                    </div>

                    <div style={{ fontSize: '0.92rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      {ord.items?.map(it => `${it.quantity}× ${it.item_name}`).join(', ')}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Amount</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                        ₹{ord.total_amount?.toFixed(0)}
                      </div>
                    </div>

                    {ord.status === 'Pending' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem' }}
                        disabled={actionInProgress === ord.order_id}
                        onClick={() => handleStartPrep(ord.order_id)}
                      >
                        <Flame size={15} />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {ord.status === 'Preparing' && (
                      <button
                        className="btn btn-accent"
                        style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem' }}
                        disabled={actionInProgress === ord.order_id}
                        onClick={() => handleMarkReady(ord.order_id)}
                      >
                        <CheckCircle size={15} />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {ord.status === 'Ready' && (
                      <button
                        className="btn btn-outline"
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.5rem 0.95rem',
                          borderColor: 'var(--primary)',
                          color: 'var(--primary)',
                          fontWeight: 700
                        }}
                        disabled={actionInProgress === ord.order_id}
                        onClick={() => handleComplete(ord.order_id)}
                      >
                        <CheckCircle size={15} />
                        <span>Complete Pickup</span>
                      </button>
                    )}

                    {ord.status === 'Completed' && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        ✓ Collected
                      </span>
                    )}

                    {ord.status === 'Cancelled' && (
                      <span style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>
                        ✗ Cancelled
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory & Menu Control View */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Menu & Inventory Control</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Each menu item's price and stock are synchronized in real-time with the kitchen queue system.
          </p>

          <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Item ID</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Name</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Price</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Stock (Portions)</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Restock Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length >= 0 && (
                  // Fetch unique menu items from db
                  [
                    { id: 1, name: 'Vada Pav', cat: 'Snacks', price: 20 },
                    { id: 2, name: 'Sandwich', cat: 'Snacks', price: 50 },
                    { id: 3, name: 'Misal Pav', cat: 'Main Course', price: 60 },
                    { id: 4, name: 'Tea', cat: 'Beverages', price: 10 }
                  ].map(stub => {
                    const found = low_stock_warnings.find(w => w.item_id === stub.id);
                    // Look in menu if available or stub
                    return (
                      <tr key={stub.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)' }}>#{stub.id}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{found?.name || stub.name}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{stub.cat}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>
                          <span>₹{found?.price || stub.price}</span>
                          <button
                            onClick={() => {
                              setEditingItem(found || { item_id: stub.id, name: stub.name, price: stub.price });
                              setEditPrice(String(found?.price || stub.price));
                            }}
                            style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}
                            title="Edit Price"
                          >
                            <Edit2 size={13} />
                          </button>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {found ? found.stock : 'In Stock'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {found ? (
                            found.stock <= 0 ? (
                              <span className="stock-tag stock-out">Out of Stock</span>
                            ) : (
                              <span className="stock-tag stock-low">Low Stock ({found.stock})</span>
                            )
                          ) : (
                            <span className="stock-tag stock-ok">In Stock</span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                              onClick={() => handleRestock(stub.id, 5)}
                            >
                              +5
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                              onClick={() => handleRestock(stub.id, 10)}
                            >
                              +10
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                              onClick={() => handleRestock(stub.id, 20)}
                            >
                              +20
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancellation Stack View */}
      {activeTab === 'cancellations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Recent Cancellations</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Most recently cancelled orders appear at the top. Order amounts are refunded and inventory is restored automatically.
            </p>
          </div>

          {cancellations.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontWeight: 600 }}>No cancellations recorded</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No orders have been cancelled.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cancellations.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="card"
                  style={{
                    padding: '1rem 1.25rem',
                    borderLeft: idx === 0 ? '4px solid #ef4444' : '4px solid var(--border-color)',
                    background: idx === 0 ? '#fef2f2' : 'var(--bg-surface)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                          Order #{c.order_id}
                        </span>
                        {idx === 0 && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: '#dc2626',
                            color: '#fff',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            TOP OF STACK
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Stack Depth: #{idx + 1}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Student: {c.student_name} ({c.student_id}) • Cancelled at {c.cancelled_at}
                      </div>
                      <div style={{ fontSize: '0.88rem', marginTop: '0.35rem' }}>
                        Reason: <em>"{c.reason}"</em>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Restored Portions: {c.items_summary}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Refund Amount</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c' }}>
                        ₹{c.refund_amount?.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Price Modal */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Update Price for {editingItem.name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Updating this price will update the menu and instantly reflect across all student orders.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                New Price (₹):
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSavePrice}
              >
                Save Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
