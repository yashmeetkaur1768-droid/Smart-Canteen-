import React, { useState, useEffect } from 'react';
import { Clock, Eye, ShoppingBag } from 'lucide-react';
import { fetchStudentOrders } from '../services/api';

export default function OrderHistory({ student, onSelectOrderToTrack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student?.student_id) return;
    setLoading(true);
    fetchStudentOrders(student.student_id)
      .then(res => {
        if (res.status === 'ok') {
          setOrders(res.orders || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [student?.student_id]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading order history...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Order History</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Orders placed by {student.name} ({student.student_id})
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <ShoppingBag size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: 600 }}>No past orders found</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Browse the menu to place your first order!
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {orders.map(o => (
            <div
              key={o.order_id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>
                    Order #{o.order_id}
                  </span>
                  <span className={`status-badge status-${o.status.toLowerCase()}`}>
                    {o.status}
                  </span>
                  {o.is_prepaid && (
                    <span className="priority-badge">
                      ⚡ Priority
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  {o.created_at}
                </div>

                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  {o.items?.map(it => `${it.quantity}× ${it.item_name}`).join(', ')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Amount</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                    ₹{o.total_amount?.toFixed(0)}
                  </div>
                </div>

                <button
                  className="btn btn-outline"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                  onClick={() => onSelectOrderToTrack(o.order_id)}
                >
                  <Eye size={15} />
                  <span>View Status</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
