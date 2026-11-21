import React, { useState } from 'react';
import { X, Trash2, Zap, ArrowRight, ShieldCheck, AlertCircle, ShoppingBag, Minus, Plus } from 'lucide-react';

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  activeStudent,
  onPlaceOrder,
  isPlacingOrder
}) {
  const [isPrepaid, setIsPrepaid] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const studentBalance = activeStudent?.balance ?? 0;
  const shortfall = Math.max(0, totalAmount - studentBalance);
  const hasInsufficientBalance = isPrepaid && shortfall > 0;

  const handleCheckoutClick = () => {
    setErrorMessage('');
    if (cart.length === 0 || isPlacingOrder) return;

    if (isPrepaid) {
      if (hasInsufficientBalance) {
        setErrorMessage(
          `Insufficient wallet balance. Required: ₹${totalAmount.toFixed(2)}, Available: ₹${studentBalance.toFixed(2)} (Shortfall: ₹${shortfall.toFixed(2)}). Switch to standard order or add funds.`
        );
        return;
      }
      setShowConfirmationModal(true);
    } else {
      executeOrderPlacement(false);
    }
  };

  const executeOrderPlacement = async (prepaidFlag) => {
    if (isPlacingOrder) return;
    try {
      setShowConfirmationModal(false);
      await onPlaceOrder({
        student_id: activeStudent?.student_id,
        items: cart.map(item => ({ item_id: item.item_id, quantity: item.quantity })),
        is_prepaid: prepaidFlag
      });
      onClearCart();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to place order. Please try again.');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div
          className="modal-content"
          style={{
            maxWidth: 440,
            width: '100%',
            height: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '1.1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 id="cart-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
            </h2>
            <button
              onClick={onClose}
              aria-label="Close cart"
              style={{
                background: 'var(--bg-surface-alt)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <ShoppingBag size={40} style={{ margin: '0 auto 0.75rem auto', color: 'var(--text-muted)' }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>Your cart is empty</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Select items from the canteen menu to begin.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {cart.map(item => (
                  <div
                    key={item.item_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.85rem',
                      background: 'var(--bg-surface-alt)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        ₹{item.price.toFixed(0)} × {item.quantity} = ₹{(item.price * item.quantity).toFixed(0)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="qty-stepper" style={{ background: '#fff' }}>
                        <button
                          type="button"
                          className="qty-btn"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() => onUpdateQuantity(item.item_id, item.quantity - 1)}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="qty-val">{item.quantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          aria-label={`Increase ${item.name} quantity`}
                          disabled={item.quantity >= item.stock}
                          onClick={() => onUpdateQuantity(item.item_id, item.quantity + 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.item_id)}
                        style={{ color: '#dc2626', padding: '0.4rem', display: 'flex', alignItems: 'center' }}
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.85rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Order Option Toggle */}
            {cart.length > 0 && (
              <div style={{
                marginTop: '1.25rem',
                padding: '0.9rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: isPrepaid ? '1.5px solid var(--accent)' : '1px solid var(--border-color)',
                backgroundColor: isPrepaid ? 'var(--accent-light)' : 'var(--bg-surface-alt)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Zap size={18} color={isPrepaid ? 'var(--accent)' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isPrepaid ? 'var(--accent)' : 'var(--text-main)' }}>
                      Prepaid Priority Queue
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="prepaid-toggle"
                    checked={isPrepaid}
                    onChange={(e) => {
                      setIsPrepaid(e.target.checked);
                      setErrorMessage('');
                    }}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                  {isPrepaid ? (
                    <span style={{ color: '#92400e' }}>
                      Orders in the priority queue are scheduled ahead of standard orders. Deducted instantly from your wallet balance.
                    </span>
                  ) : (
                    <span>
                      Standard order served in order of arrival. Pay or collect directly at the counter.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer with Balance, Summary and Checkout */}
          {cart.length > 0 && (
            <div style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-surface)'
            }}>
              {/* Cost Summary Breakdown */}
              <div style={{
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                marginBottom: '0.75rem',
                paddingBottom: '0.65rem',
                borderBottom: '1px dashed var(--border-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>₹{totalAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Wallet Balance:</span>
                  <span style={{ fontWeight: 600, color: hasInsufficientBalance ? '#dc2626' : 'var(--primary)' }}>
                    ₹{studentBalance.toFixed(2)}
                  </span>
                </div>
                {hasInsufficientBalance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 600 }}>
                    <span>Shortfall:</span>
                    <span>₹{shortfall.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Total Payable:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                  ₹{totalAmount.toFixed(0)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClearCart}
                  disabled={isPlacingOrder}
                  style={{ flex: 1, padding: '0.55rem' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '0.55rem' }}
                  disabled={isPlacingOrder || hasInsufficientBalance}
                  onClick={handleCheckoutClick}
                >
                  {isPlacingOrder ? (
                    'Processing…'
                  ) : hasInsufficientBalance ? (
                    'Insufficient Balance'
                  ) : (
                    <>
                      <span>{isPrepaid ? 'Continue to Pay' : 'Place Order'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Priority/Prepaid Deduction */}
      {showConfirmationModal && (
        <div className="modal-overlay" style={{ zIndex: 120 }} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <div className="modal-content" style={{ padding: '1.5rem', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 id="confirm-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Confirm Priority Order
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Wallet deduction confirmation</div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-surface-alt)',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student Name:</span>
                <span style={{ fontWeight: 600 }}>{activeStudent?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeStudent?.student_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Balance:</span>
                <span style={{ fontWeight: 600 }}>₹{studentBalance.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.45rem',
                borderTop: '1px dashed var(--border-color)',
                marginTop: '0.45rem'
              }}>
                <span style={{ fontWeight: 700 }}>Order Cost:</span>
                <span style={{ fontWeight: 800, color: 'var(--accent)' }}>- ₹{totalAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining Balance:</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{(studentBalance - totalAmount).toFixed(2)}</span>
              </div>
            </div>

            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginBottom: '1.25rem',
              lineHeight: 1.45
            }}>
              Your campus wallet will be debited for ₹{totalAmount.toFixed(2)}. The order will be scheduled in the kitchen's priority queue.
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                disabled={isPlacingOrder}
                onClick={() => setShowConfirmationModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={isPlacingOrder}
                onClick={() => executeOrderPlacement(true)}
              >
                {isPlacingOrder ? 'Submitting…' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
