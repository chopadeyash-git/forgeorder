import React, { useState } from 'react';
import { CreditCard, Ban, RotateCcw, Wrench, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function OrderManager({
  order,
  onOrderUpdated,
  appendLog
}) {
  const [cardToken, setCardToken] = useState('tok_success_visa');
  const [payIdempKey, setPayIdempKey] = useState(() => 'pay-key-' + generateUUID().slice(0, 8));
  const [cancelIdempKey, setCancelIdempKey] = useState(() => 'cancel-key-' + generateUUID().slice(0, 8));
  const [refundIdempKey, setRefundIdempKey] = useState(() => 'ref-key-' + generateUUID().slice(0, 8));
  const [refundAmount, setRefundAmount] = useState(order ? order.totalAmount : 0);
  const [loadingAction, setLoadingAction] = useState(null);

  // Sync refund amount when order changes
  React.useEffect(() => {
    if (order) {
      setRefundAmount(order.totalAmount);
    }
  }, [order?.id, order?.totalAmount]);

  if (!order) {
    return (
      <section className="card" aria-labelledby="heading-payments">
        <h2 id="heading-payments" className="card-title">
          <CreditCard size={18} />
          <span>2. Order Lifecycle & Actions</span>
        </h2>
        <div className="text-muted" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</p>
          <p>Create an order on the left or select an order from the database below to inspect or run payment operations.</p>
        </div>
      </section>
    );
  }

  // Refresh active order: GET /api/orders/{id}
  const handleReadOrder = async () => {
    setLoadingAction('read');
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const data = await res.json();
      appendLog('GET', `/api/orders/${order.id}`, res.status, data);
      if (res.ok) {
        onOrderUpdated(data);
      }
    } catch (err) {
      appendLog('GET', `/api/orders/${order.id}`, 0, err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Start payment: POST /api/orders/{id}/payments
  const handlePayment = async (e) => {
    e.preventDefault();
    setLoadingAction('pay');
    const key = payIdempKey.trim();

    try {
      const res = await fetch(`/api/orders/${order.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          'X-Correlation-ID': generateUUID()
        },
        body: JSON.stringify({ cardToken })
      });
      const data = await res.json();
      appendLog('POST', `/api/orders/${order.id}/payments`, res.status, data, key);

      // Re-fetch order status
      await handleReadOrder();
      setPayIdempKey('pay-key-' + generateUUID().slice(0, 8));
    } catch (err) {
      appendLog('POST', `/api/orders/${order.id}/payments`, 0, err.message, key);
    } finally {
      setLoadingAction(null);
    }
  };

  // Cancel order: POST /api/orders/{id}/cancel
  const handleCancel = async () => {
    if (!confirm(`Cancel order ${order.id}? This releases reserved inventory.`)) return;
    setLoadingAction('cancel');
    const key = cancelIdempKey.trim();

    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': key,
          'X-Correlation-ID': generateUUID()
        }
      });
      const data = await res.json();
      appendLog('POST', `/api/orders/${order.id}/cancel`, res.status, data, key);

      await handleReadOrder();
      setCancelIdempKey('cancel-key-' + generateUUID().slice(0, 8));
    } catch (err) {
      appendLog('POST', `/api/orders/${order.id}/cancel`, 0, err.message, key);
    } finally {
      setLoadingAction(null);
    }
  };

  // Refund order: POST /api/orders/{id}/refunds
  const handleRefund = async (e) => {
    e.preventDefault();
    setLoadingAction('refund');
    const key = refundIdempKey.trim();

    try {
      const res = await fetch(`/api/orders/${order.id}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          'X-Correlation-ID': generateUUID()
        },
        body: JSON.stringify({ amount: Number(refundAmount) })
      });
      const data = await res.json();
      appendLog('POST', `/api/orders/${order.id}/refunds`, res.status, data, key);

      await handleReadOrder();
      setRefundIdempKey('ref-key-' + generateUUID().slice(0, 8));
    } catch (err) {
      appendLog('POST', `/api/orders/${order.id}/refunds`, 0, err.message, key);
    } finally {
      setLoadingAction(null);
    }
  };

  // Reconcile order: POST /api/admin/orders/{id}/reconcile
  const handleReconcile = async () => {
    setLoadingAction('reconcile');
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/reconcile`, { method: 'POST' });
      const text = await res.text();
      appendLog('POST', `/api/admin/orders/${order.id}/reconcile`, res.status, text);

      await handleReadOrder();
    } catch (err) {
      appendLog('POST', `/api/admin/orders/${order.id}/reconcile`, 0, err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const isPayable =
    order.status === 'CREATED' ||
    order.status === 'INVENTORY_RESERVED' ||
    order.status === 'PAYMENT_FAILED';

  const isReconcilable = order.status === 'RECONCILIATION_REQUIRED';
  const isCancellable =
    order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && order.status !== 'FULFILLED';
  const isRefundable = order.status === 'CONFIRMED' || order.status === 'FULFILLED';

  const payInfo = order.payment || order.paymentSummary;

  return (
    <section className="card" aria-labelledby="heading-payments">
      <div className="section-header">
        <h2 id="heading-payments" className="card-title" style={{ marginBottom: 0 }}>
          <CreditCard size={18} />
          <span>2. Order Lifecycle & Actions</span>
        </h2>
        <button
          type="button"
          onClick={handleReadOrder}
          disabled={loadingAction === 'read'}
          className="btn btn-secondary btn-sm"
          title="Read order: GET /api/orders/{id}"
        >
          <RefreshCw size={13} />
          <span>Read (GET)</span>
        </button>
      </div>

      <div className="summary-box">
        <div className="summary-row">
          <span>Active Order ID:</span>
          <span className="mono" style={{ fontSize: '0.8rem' }}>{order.id}</span>
        </div>
        <div className="summary-row" style={{ alignItems: 'center' }}>
          <span>Current State:</span>
          <span className={`badge badge-${order.status}`}>{order.status}</span>
        </div>
        <div className="summary-row">
          <span>Total Charged:</span>
          <strong>${Number(order.totalAmount).toFixed(2)}</strong>
        </div>
        <div className="summary-row">
          <span>Payment Attempt:</span>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            {payInfo ? `${payInfo.status} (Provider: ${payInfo.providerPaymentId || 'Unknown/Timeout'})` : 'None'}
          </span>
        </div>
      </div>

      {/* Start payment: POST /api/orders/{id}/payments */}
      {isPayable && (
        <form onSubmit={handlePayment} style={{ marginBottom: '1.25rem' }}>
          <fieldset>
            <legend>Start Payment (POST /api/orders/&#123;id&#125;/payments)</legend>
            <div className="token-grid">
              <button
                type="button"
                onClick={() => setCardToken('tok_success_visa')}
                className={`token-btn ${cardToken === 'tok_success_visa' ? 'selected' : ''}`}
              >
                <span className="token-label">🟢 tok_success_visa</span>
                <span className="token-desc">Immediate Success &rarr; CONFIRMED</span>
              </button>
              <button
                type="button"
                onClick={() => setCardToken('tok_decline_funds')}
                className={`token-btn ${cardToken === 'tok_decline_funds' ? 'selected' : ''}`}
              >
                <span className="token-label">🔴 tok_decline_funds</span>
                <span className="token-desc">Decline &rarr; PAYMENT_FAILED</span>
              </button>
              <button
                type="button"
                onClick={() => setCardToken('tok_timeout_visa')}
                className={`token-btn ${cardToken === 'tok_timeout_visa' ? 'selected' : ''}`}
              >
                <span className="token-label">🟡 tok_timeout_visa</span>
                <span className="token-desc">Timeout &rarr; RECONCILIATION</span>
              </button>
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="pay-idemp">
              Payment Idempotency-Key
              <span className="hint">Header: Idempotency-Key</span>
            </label>
            <div className="input-row">
              <input
                type="text"
                id="pay-idemp"
                value={payIdempKey}
                onChange={(e) => setPayIdempKey(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setPayIdempKey('pay-key-' + generateUUID().slice(0, 8))}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-success"
            disabled={loadingAction === 'pay'}
            style={{ width: '100%' }}
          >
            {loadingAction === 'pay' ? 'Processing Payment...' : '💳 Start Payment (POST /payments)'}
          </button>
        </form>
      )}

      {/* Action buttons: Reconcile & Cancel */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {isReconcilable && (
          <button
            type="button"
            onClick={handleReconcile}
            disabled={loadingAction === 'reconcile'}
            className="btn btn-warning"
            title="POST /api/admin/orders/{id}/reconcile"
          >
            <Wrench size={15} />
            <span>{loadingAction === 'reconcile' ? 'Reconciling...' : 'Reconcile Order (POST /reconcile)'}</span>
          </button>
        )}

        {isCancellable && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loadingAction === 'cancel'}
            className="btn btn-danger btn-sm"
            title="POST /api/orders/{id}/cancel"
          >
            <Ban size={14} />
            <span>{loadingAction === 'cancel' ? 'Cancelling...' : 'Cancel Order (POST /cancel)'}</span>
          </button>
        )}
      </div>

      {/* Refund order: POST /api/orders/{id}/refunds */}
      {isRefundable && (
        <form
          onSubmit={handleRefund}
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
            marginTop: '0.5rem'
          }}
        >
          <div className="field">
            <label htmlFor="ref-amount">
              Refund Amount ($)
              <span className="hint">Max: ${Number(order.totalAmount).toFixed(2)}</span>
            </label>
            <input
              type="number"
              id="ref-amount"
              step="0.01"
              min="0.01"
              max={order.totalAmount}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="ref-idemp">
              Refund Idempotency-Key
              <span className="hint">Header: Idempotency-Key</span>
            </label>
            <div className="input-row">
              <input
                type="text"
                id="ref-idemp"
                value={refundIdempKey}
                onChange={(e) => setRefundIdempKey(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setRefundIdempKey('ref-key-' + generateUUID().slice(0, 8))}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={loadingAction === 'refund'}
          >
            <RotateCcw size={14} />
            <span>{loadingAction === 'refund' ? 'Refunding...' : 'Refund Order (POST /refunds)'}</span>
          </button>
        </form>
      )}
    </section>
  );
}
