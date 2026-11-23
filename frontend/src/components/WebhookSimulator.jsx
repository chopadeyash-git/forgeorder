import React, { useState, useEffect } from 'react';
import { Bell, Zap, Send, ShieldCheck } from 'lucide-react';

export default function WebhookSimulator({ activeOrder, onWebhookDelivered, appendLog }) {
  const [providerPaymentId, setProviderPaymentId] = useState('');
  const [eventType, setEventType] = useState('PAYMENT_SUCCEEDED');
  const [payload, setPayload] = useState('');
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState(false);

  // Auto-resolve providerPaymentId when order changes
  useEffect(() => {
    const pay = activeOrder?.payment || activeOrder?.paymentSummary;
    if (pay) {
      if (pay.providerPaymentId) {
        setProviderPaymentId(pay.providerPaymentId);
      } else if (pay.idempotencyKey) {
        autoFetchId(pay.idempotencyKey);
      }
    }
  }, [activeOrder?.id, activeOrder?.status]);

  const autoFetchId = async (idempKey) => {
    if (!idempKey) return;
    setFetchingId(true);
    try {
      const res = await fetch(`/api/test/webhooks/gateway-status?idempotencyKey=${encodeURIComponent(idempKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.providerPaymentId) {
          setProviderPaymentId(data.providerPaymentId);
          appendLog('GET', `/api/test/webhooks/gateway-status?idempotencyKey=${idempKey}`, res.status, data);
        }
      }
    } catch (err) {
      console.warn('Could not query gateway status', err);
    } finally {
      setFetchingId(false);
    }
  };

  const handleManualFetch = () => {
    const pay = activeOrder?.payment || activeOrder?.paymentSummary;
    if (pay?.idempotencyKey) {
      autoFetchId(pay.idempotencyKey);
    } else {
      alert('No payment attempt found on the active order. Initiate payment first.');
    }
  };

  // Generate signed payload: POST /api/test/webhooks/simulate
  const handleGeneratePayload = async (e) => {
    e.preventDefault();
    if (!providerPaymentId.trim()) {
      alert('Provider Payment ID is required to generate a signed payload.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/test/webhooks/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerPaymentId: providerPaymentId.trim(),
          eventType
        })
      });
      const data = await res.json();
      appendLog('POST', '/api/test/webhooks/simulate', res.status, data);

      if (res.ok) {
        setPayload(data.payload);
        setSignature(data.signature);
      }
    } catch (err) {
      appendLog('POST', '/api/test/webhooks/simulate', 0, err.message);
    } finally {
      setLoading(false);
    }
  };

  // Deliver signed webhook: POST /api/webhooks/mock-payment
  const handleDeliverWebhook = async () => {
    if (!payload || !signature) {
      alert('Payload and signature are required to deliver the webhook.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/webhooks/mock-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: payload
      });

      appendLog(
        'POST',
        '/api/webhooks/mock-payment',
        res.status,
        res.status === 200 ? 'Webhook acknowledged & processed' : 'Error',
        null
      );

      if (res.ok) {
        onWebhookDelivered();
      }
    } catch (err) {
      appendLog('POST', '/api/webhooks/mock-payment', 0, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" aria-labelledby="heading-webhook">
      <h2 id="heading-webhook" className="card-title">
        <Bell size={18} />
        <span>3. Payment Webhook (POST /api/webhooks/mock-payment)</span>
      </h2>
      <p className="hint" style={{ marginBottom: '1rem' }}>
        Applies a signed asynchronous gateway event with cryptographic HMAC-SHA256 signature verification.
      </p>

      <form onSubmit={handleGeneratePayload}>
        <div className="field">
          <label htmlFor="wh-provider-id">
            Provider Payment ID
            <span className="hint">Gateway ID</span>
          </label>
          <div className="input-row">
            <input
              type="text"
              id="wh-provider-id"
              placeholder="e.g. pay_..."
              value={providerPaymentId}
              onChange={(e) => setProviderPaymentId(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleManualFetch}
              disabled={fetchingId}
              className="btn btn-secondary btn-sm"
              title="Query gateway for active order's Provider ID"
            >
              <Zap size={13} />
              <span>{fetchingId ? 'Querying...' : 'Auto-Fetch ID'}</span>
            </button>
          </div>
          <span className="hint">
            Query gateway by payment idempotency key: <code>GET /api/test/webhooks/gateway-status</code>
          </span>
        </div>

        <div className="field">
          <label htmlFor="wh-event-type">Event Type</label>
          <select
            id="wh-event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="PAYMENT_SUCCEEDED">PAYMENT_SUCCEEDED</option>
            <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-secondary btn-sm"
          disabled={loading}
          style={{ marginBottom: '1rem' }}
        >
          <ShieldCheck size={14} />
          <span>{loading ? 'Signing...' : 'Generate Signed Webhook Payload'}</span>
        </button>
      </form>

      <div className="field">
        <label htmlFor="wh-payload">Signed JSON Payload</label>
        <textarea
          id="wh-payload"
          rows={3}
          readOnly
          value={payload}
          className="mono"
          style={{ fontSize: '0.75rem' }}
        />
      </div>

      <div className="field">
        <label htmlFor="wh-signature">
          HMAC-SHA256 Signature
          <span className="hint">Header: X-Webhook-Signature</span>
        </label>
        <input
          type="text"
          id="wh-signature"
          readOnly
          value={signature}
          className="mono"
          style={{ fontSize: '0.75rem' }}
        />
      </div>

      <button
        type="button"
        onClick={handleDeliverWebhook}
        disabled={loading || !payload || !signature}
        className="btn btn-primary"
        style={{ width: '100%' }}
      >
        <Send size={15} />
        <span>Deliver Webhook (POST /api/webhooks/mock-payment)</span>
      </button>
    </section>
  );
}
