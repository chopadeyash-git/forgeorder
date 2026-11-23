import React, { useState } from 'react';
import { ShoppingBag, RefreshCw, Dice5 } from 'lucide-react';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function Storefront({ products, onOrderCreated, appendLog }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customerId, setCustomerId] = useState(() => generateUUID());
  const [idempotencyKey, setIdempotencyKey] = useState(() => 'ord-key-' + generateUUID().slice(0, 8));
  const [correlationId, setCorrelationId] = useState(() => generateUUID());
  const [loading, setLoading] = useState(false);

  // Default selection
  const activeProduct = selectedProduct || products[0];

  const handleGenCustomer = () => setCustomerId(generateUUID());
  const handleGenIdemp = () => setIdempotencyKey('ord-key-' + generateUUID().slice(0, 8));
  const handleGenCorr = () => setCorrelationId(generateUUID());

  const subtotal = activeProduct ? activeProduct.price * quantity : 0;
  const taxRate = activeProduct?.taxRate || 0.18;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProduct) return;

    setLoading(true);
    const body = {
      customerId: customerId.trim(),
      productId: activeProduct.id,
      quantity: Number(quantity)
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.trim(),
          'X-Correlation-ID': correlationId.trim()
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      appendLog('POST', '/api/orders', res.status, data, idempotencyKey.trim());

      if (res.ok) {
        onOrderCreated(data);
        // Regenerate fresh key for next order
        setIdempotencyKey('ord-key-' + generateUUID().slice(0, 8));
        setCorrelationId(generateUUID());
      } else {
        alert(`Order creation failed (${res.status}): ${data.message || data.code || 'Check trace console'}`);
      }
    } catch (err) {
      appendLog('POST', '/api/orders', 0, err.message, idempotencyKey.trim());
      alert('Network request error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" aria-labelledby="heading-storefront">
      <h2 id="heading-storefront" className="card-title">
        <ShoppingBag size={18} />
        <span>1. Create Order (POST /api/orders)</span>
      </h2>

      <fieldset>
        <legend>Catalog & Stock (Atomic Concurrency)</legend>
        <div className="product-grid" role="radiogroup" aria-label="Product Catalog">
          {products.map((p) => {
            const isSelected = activeProduct && activeProduct.id === p.id;
            const isLow = p.availableQuantity <= 5;

            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className={`product-option ${isSelected ? 'selected' : ''}`}
                role="radio"
                aria-checked={isSelected}
              >
                <div className="product-name">{p.name}</div>
                <div className="product-price">${Number(p.price).toFixed(2)}</div>
                <div className={`stock-tag ${isLow ? 'low' : ''}`}>
                  Available: <strong>{p.availableQuantity}</strong> (Res: {p.reservedQuantity || 0})
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="order-quantity">
            Quantity
            <span className="hint">Atomic DB reservation</span>
          </label>
          <input
            type="number"
            id="order-quantity"
            name="quantity"
            min="1"
            max="1000"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            required
            aria-describedby="qty-hint"
          />
          <span id="qty-hint" className="hint">
            Conditional update in PostgreSQL ensures stock never goes below 0.
          </span>
          <div className="error-msg">
            <span role="img" aria-label="Error">⚠️</span> Enter a valid quantity (min 1).
          </div>
        </div>

        <div className="field">
          <label htmlFor="order-customer-id">
            Customer ID
            <span className="hint">UUID</span>
          </label>
          <div className="input-row">
            <input
              type="text"
              id="order-customer-id"
              name="customerId"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              pattern="[0-9a-fA-F\-]{36}"
              aria-describedby="customer-hint"
            />
            <button
              type="button"
              onClick={handleGenCustomer}
              className="btn btn-secondary btn-sm"
              title="Generate new customer UUID"
            >
              <Dice5 size={14} />
              <span>New</span>
            </button>
          </div>
          <span id="customer-hint" className="hint">
            Protected by Redis-backed rate limiter (&le; 20 orders/min).
          </span>
          <div className="error-msg">
            <span role="img" aria-label="Error">⚠️</span> Valid 36-character UUID required.
          </div>
        </div>

        <div className="field">
          <label htmlFor="order-idemp-key">
            Idempotency-Key
            <span className="hint">Header: Idempotency-Key</span>
          </label>
          <div className="input-row">
            <input
              type="text"
              id="order-idemp-key"
              name="idempotencyKey"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              required
              aria-describedby="idemp-hint"
            />
            <button
              type="button"
              onClick={handleGenIdemp}
              className="btn btn-secondary btn-sm"
              title="Regenerate key"
            >
              <RefreshCw size={13} />
              <span>New</span>
            </button>
          </div>
          <span id="idemp-hint" className="hint">
            Submitting duplicate request returns cached response. Varying payload returns 409 Conflict.
          </span>
        </div>

        <div className="field">
          <label htmlFor="order-corr-id">
            X-Correlation-ID (Optional)
            <span className="hint">Header: X-Correlation-ID</span>
          </label>
          <div className="input-row">
            <input
              type="text"
              id="order-corr-id"
              name="correlationId"
              value={correlationId}
              onChange={(e) => setCorrelationId(e.target.value)}
            />
            <button
              type="button"
              onClick={handleGenCorr}
              className="btn btn-secondary btn-sm"
              title="Generate new correlation ID"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="summary-box">
          <div className="summary-row">
            <span>Item:</span>
            <strong>{activeProduct?.name || 'None'} &times; {quantity}</strong>
          </div>
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Tax (18%):</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !activeProduct}
          style={{ width: '100%' }}
        >
          {loading ? 'Reserving Inventory...' : '🛒 Reserve & Create Order (POST /api/orders)'}
        </button>
      </form>
    </section>
  );
}
