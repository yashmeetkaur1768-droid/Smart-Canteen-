import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertTriangle, XCircle, Flame, ChefHat, Sparkles, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchOrder, cancelOrder } from '../services/api';

const STATUS_STEPS = [
  { key: 'Pending', label: 'Pending', desc: 'In queue' },
  { key: 'Preparing', label: 'Preparing', desc: 'Cooking' },
  { key: 'Ready', label: 'Ready', desc: 'Ready for pickup' },
  { key: 'Completed', label: 'Completed', desc: 'Picked up' }
];

export default function OrderTracker({ orderId, onOrderCancelled, onSelectAnotherOrder }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed mind');
  const [isCancelling, setIsCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrder = async (isManual = false) => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    if (isManual) setRefreshing(true);
    try {
      const res = await fetchOrder(orderId);
      if (res.status === 'ok') {
        setOrder(res.order);
        setError('');
      } else {
        setError(res.message || 'Could not fetch order');
      }
    } catch (err) {
      setError(err.message || 'Could not fetch order');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Poll every 3.5 seconds while order is active
  useEffect(() => {
    loadOrder();
    const interval = setInterval(() => {
      if (order && (order.status === 'Completed' || order.status === 'Cancelled')) {
        clearInterval(interval);
        return;
      }
      loadOrder();
    }, 3500);

    return () => clearInterval(interval);
  }, [orderId, order?.status]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelOrder(orderId, cancelReason);
      setShowCancelModal(false);
      await loadOrder();
      if (onOrderCancelled) onOrderCancelled(orderId);
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Checking queue status…</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <div style={{ color: '#991b1b', fontWeight: 600, fontSize: '1rem' }}>{error || 'No active order selected'}</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          Select an order from your order history or place a new order from the menu.
        </p>
      </div>
    );
  }

  const isCancelled = order.status === 'Cancelled';
  const isReady = order.status === 'Ready';
  const isCompleted = order.status === 'Completed';
  const isPreparing = order.status === 'Preparing';
  const isPending = order.status === 'Pending';

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Primary Queue & Estimated Wait Hero Box */}
      <div className="card" style={{
        backgroundColor: isCancelled
          ? '#fef2f2'
          : isReady
          ? '#f0fdf4'
          : isCompleted
          ? '#f8fafc'
          : order.is_prepaid
          ? 'var(--accent-light)'
          : 'var(--bg-surface)',
        border: `1.5px solid ${
          isCancelled
            ? '#fecaca'
            : isReady
            ? '#bbf7d0'
            : order.is_prepaid
            ? 'var(--accent)'
            : 'var(--border-color)'
        }`,
        padding: '1.5rem',
        borderRadius: 'var(--radius-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-muted)'
              }}>
                ORDER #{order.order_id}
              </span>
              {order.is_prepaid && (
                <span className="priority-badge">
                  Priority Order
                </span>
              )}
            </div>

            {/* Prominent Position and Wait Display */}
            {isCancelled ? (
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={26} color="#dc2626" aria-hidden="true" />
                <span>Order Cancelled</span>
              </h2>
            ) : isCompleted ? (
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={26} color="#166534" aria-hidden="true" />
                <span>Order Completed</span>
              </h2>
            ) : isReady ? (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={26} color="#15803d" aria-hidden="true" />
                  <span>Ready for Pickup</span>
                </h2>
                <p style={{ fontSize: '0.9rem', color: '#166534', marginTop: '0.25rem', fontWeight: 600 }}>
                  Please present Order #{order.order_id} at the counter.
                </p>
              </div>
            ) : isPreparing ? (
              <div>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#c25e00', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Flame size={26} color="#c25e00" aria-hidden="true" />
                  <span>Cooking at Kitchen Station</span>
                </h2>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                  Estimated remaining: ~{order.estimated_wait_minutes || 2} min{order.estimated_wait_minutes === 1 ? '' : 's'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    #{order.queue_position || 1} in queue
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                    ~{order.estimated_wait_minutes || 1} min wait
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {order.orders_ahead || 0} order{order.orders_ahead === 1 ? '' : 's'} ahead of you across 2 kitchen stations.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadOrder(true)}
            aria-label="Refresh order status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface)',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              fontWeight: 500
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Progress Progression: Pending → Preparing → Ready → Completed */}
      {!isCancelled && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '1.25rem' }}>
            Order Status
          </h3>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '12%',
              right: '12%',
              height: 3,
              backgroundColor: 'var(--border-subtle)',
              zIndex: 1
            }} />

            {/* Filled progress bar */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '12%',
              width: `${Math.max(0, currentStepIndex) * (76 / (STATUS_STEPS.length - 1))}%`,
              height: 3,
              backgroundColor: 'var(--primary)',
              zIndex: 2,
              transition: 'width 0.3s ease'
            }} />

            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const isUpcoming = idx > currentStepIndex;

              return (
                <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, width: '22%' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: isPast ? 'var(--primary)' : isCurrent ? 'var(--primary)' : 'var(--bg-surface)',
                    border: `2px solid ${isPast || isCurrent ? 'var(--primary)' : 'var(--border-color)'}`,
                    color: isPast || isCurrent ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    boxShadow: isCurrent ? '0 0 0 3px var(--primary-light)' : 'none'
                  }}>
                    {isPast ? <CheckCircle2 size={16} aria-hidden="true" /> : (idx + 1)}
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? 'var(--primary)' : isPast ? 'var(--text-main)' : 'var(--text-muted)',
                    marginTop: '0.5rem',
                    textAlign: 'center'
                  }}>
                    {step.label}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-light)',
                    textAlign: 'center',
                    marginTop: '0.15rem'
                  }}>
                    {step.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Summary & Actions */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Items Summary
          </h3>
          <span className={`status-badge status-${order.status.toLowerCase()}`}>
            {order.status}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {order.items?.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
              <span>
                <strong>{it.quantity}×</strong> {it.item_name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                ₹{it.subtotal?.toFixed(0)}
              </span>
            </div>
          ))}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-color)',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: 'var(--primary)'
          }}>
            <span>Total:</span>
            <span>₹{order.total_amount?.toFixed(0)}</span>
          </div>
        </div>

        {/* Cancellation Section (only while pending) */}
        {isPending && (
          <div style={{
            padding: '0.9rem 1rem',
            background: 'var(--bg-surface-alt)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Need to cancel this order?</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Allowed while in the Pending queue before kitchen preparation begins.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Order
            </button>
          </div>
        )}

        {isPreparing && (
          <div style={{
            padding: '0.75rem 0.9rem',
            background: 'var(--bg-surface-alt)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ChefHat size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>Preparation has started in the kitchen. Cancellations are locked to prevent food waste.</span>
          </div>
        )}
      </div>

      {/* Cancel Order Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay" style={{ zIndex: 120 }} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
          <div className="modal-content" style={{ padding: '1.5rem', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-sm)',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626'
              }}>
                <AlertTriangle size={22} aria-hidden="true" />
              </div>
              <div>
                <h3 id="cancel-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Cancel Order #{order.order_id}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Return inventory and refund wallet</div>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Are you sure you want to cancel this order?
              {order.is_prepaid && (
                <span style={{ display: 'block', marginTop: '0.35rem', fontWeight: 600, color: 'var(--primary)' }}>
                  ₹{order.total_amount?.toFixed(0)} will be immediately refunded to your wallet.
                </span>
              )}
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="cancel-reason-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Reason for cancellation:
              </label>
              <select
                id="cancel-reason-select"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  fontSize: '0.88rem'
                }}
              >
                <option value="Changed mind">Changed mind</option>
                <option value="Ordered wrong item">Ordered wrong item</option>
                <option value="Waiting time too long">Waiting time too long</option>
                <option value="Leaving campus">Leaving campus</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                disabled={isCancelling}
                onClick={() => setShowCancelModal(false)}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={isCancelling}
                onClick={handleCancel}
              >
                {isCancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
