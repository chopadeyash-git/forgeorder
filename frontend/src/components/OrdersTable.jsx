import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Eye, Wrench } from 'lucide-react';

export default function OrdersTable({
  onSelectOrder,
  onReconcileOrder,
  refreshTrigger,
  appendLog
}) {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const url = statusFilter === 'ALL'
      ? '/api/admin/orders'
      : `/api/admin/orders?status=${statusFilter}`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.warn('Failed to fetch orders table', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, refreshTrigger]);

  useEffect(() => {
    let timer;
    if (autoRefresh) {
      timer = setInterval(fetchOrders, 3000);
    }
    return () => clearInterval(timer);
  }, [autoRefresh, statusFilter]);

  return (
    <section className="card full-width" aria-labelledby="heading-orders">
      <div className="section-header">
        <h2 id="heading-orders" className="card-title" style={{ marginBottom: 0 }}>
          <Database size={18} />
          <span>5. List Operations (GET /api/admin/orders)</span>
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            htmlFor="status-filter"
            style={{ width: 'auto', gap: '0.4rem', fontWeight: 'normal', marginBottom: 0 }}
          >
            <span>Status:</span>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 'auto', padding: '0.35rem 0.65rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="CREATED">CREATED</option>
              <option value="INVENTORY_RESERVED">INVENTORY_RESERVED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="FULFILLED">FULFILLED</option>
              <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
              <option value="RECONCILIATION_REQUIRED">RECONCILIATION_REQUIRED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </label>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <label
            style={{
              width: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              marginBottom: 0
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span>Auto-refresh (3s)</span>
          </label>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th scope="col">Order ID</th>
              <th scope="col">Status</th>
              <th scope="col">Total</th>
              <th scope="col">Quantity</th>
              <th scope="col">Payment</th>
              <th scope="col">Created</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted"
                  style={{ textAlign: 'center', padding: '2rem' }}
                >
                  {loading ? 'Loading orders...' : 'No orders found matching status filter.'}
                </td>
              </tr>
            ) : (
              orders.map((ord) => {
                const shortId = ord.id ? ord.id.slice(0, 8) + '...' : 'N/A';
                const created = ord.createdAt
                  ? new Date(ord.createdAt).toLocaleTimeString()
                  : 'N/A';
                const payInfo = ord.payment || ord.paymentSummary;

                return (
                  <tr key={ord.id}>
                    <td className="mono" title={ord.id}>
                      {shortId}
                    </td>
                    <td>
                      <span className={`badge badge-${ord.status}`}>{ord.status}</span>
                    </td>
                    <td>${Number(ord.totalAmount).toFixed(2)}</td>
                    <td>Qty: {ord.quantity}</td>
                    <td>
                      {payInfo ? (
                        <span style={{ fontSize: '0.8rem' }}>
                          {payInfo.status}{' '}
                          {payInfo.providerPaymentId && (
                            <span className="text-muted">({payInfo.providerPaymentId.slice(0, 8)}...)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </td>
                    <td className="text-muted">{created}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => onSelectOrder(ord.id)}
                          className="btn btn-secondary btn-sm"
                          title="Read order: GET /api/orders/{id}"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>

                        {ord.status === 'RECONCILIATION_REQUIRED' && (
                          <button
                            type="button"
                            onClick={() => onReconcileOrder(ord.id)}
                            className="btn btn-warning btn-sm"
                            title="POST /api/admin/orders/{id}/reconcile"
                          >
                            <Wrench size={12} />
                            <span>Reconcile</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
