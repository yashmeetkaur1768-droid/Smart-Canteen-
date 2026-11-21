import React, { useState } from 'react';
import { Plus, Minus, Clock, Check } from 'lucide-react';

export default function MenuCard({ item, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const isOutOfStock = item.stock <= 0 || !item.is_available;
  const isLowStock = item.stock > 0 && item.stock <= 5;

  const initials = item.name
    ? item.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SC';

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(item, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="menu-card" style={{ opacity: isOutOfStock ? 0.72 : 1 }}>
      {/* Top image or typographic fallback */}
      <div className="menu-card-img-wrap">
        {item.image_url && !imageFailed ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="menu-card-img"
            onError={() => setImageFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            className="menu-card-initials-fallback"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-surface-alt)',
              color: 'var(--primary)',
              fontWeight: 800,
              fontSize: '1.4rem',
              letterSpacing: '0.05em'
            }}
          >
            <span>{initials}</span>
          </div>
        )}

        <div style={{
          position: 'absolute',
          top: '0.65rem',
          right: '0.65rem',
          display: 'flex',
          gap: '0.35rem'
        }}>
          <span style={{
            fontSize: '0.72rem',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid var(--border-color)',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontWeight: 600,
            color: 'var(--text-muted)'
          }}>
            <Clock size={12} aria-hidden="true" />
            <span>{item.prep_time_minutes}m prep</span>
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="menu-card-body">
        <div>
          <span className="menu-card-category">{item.category}</span>
          <h3 className="menu-card-title">{item.name}</h3>

          <div className="menu-card-price-row">
            <span className="price-text">₹{item.price.toFixed(0)}</span>
            {isOutOfStock ? (
              <span className="stock-tag stock-out">Sold out</span>
            ) : isLowStock ? (
              <span className="stock-tag stock-low">Low stock: {item.stock} left</span>
            ) : (
              <span className="stock-tag stock-ok">Available: {item.stock} left</span>
            )}
          </div>
        </div>

        {/* Action row */}
        <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="qty-stepper" role="group" aria-label={`Quantity for ${item.name}`}>
            <button
              type="button"
              className="qty-btn"
              aria-label={`Decrease quantity of ${item.name}`}
              disabled={isOutOfStock || quantity <= 1}
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="qty-val" aria-live="polite">{quantity}</span>
            <button
              type="button"
              className="qty-btn"
              aria-label={`Increase quantity of ${item.name}`}
              disabled={isOutOfStock || quantity >= item.stock}
              onClick={() => setQuantity(q => Math.min(item.stock, q + 1))}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className={`btn ${justAdded ? 'btn-primary' : 'btn-outline'}`}
            style={{
              flex: 1,
              backgroundColor: justAdded ? 'var(--primary)' : 'var(--bg-surface)',
              color: justAdded ? '#ffffff' : 'var(--primary)',
              borderColor: 'var(--primary)'
            }}
            disabled={isOutOfStock}
            onClick={handleAdd}
            aria-label={isOutOfStock ? `${item.name} is sold out` : `Add ${quantity} ${item.name} to cart`}
          >
            {justAdded ? (
              <>
                <Check size={16} aria-hidden="true" />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus size={16} aria-hidden="true" />
                <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
