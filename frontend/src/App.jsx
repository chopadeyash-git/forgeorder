import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import Storefront from './components/Storefront.jsx';
import OrderManager from './components/OrderManager.jsx';
import WebhookSimulator from './components/WebhookSimulator.jsx';
import ApiConsole from './components/ApiConsole.jsx';
import OrdersTable from './components/OrdersTable.jsx';

export default function App() {
  const [products, setProducts] = useState([
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Test Product A',
      price: 100.0,
      taxRate: 0.18,
      availableQuantity: 100,
      reservedQuantity: 0
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Test Product B',
      price: 50.0,
      taxRate: 0.18,
      availableQuantity: 50,
      reservedQuantity: 0
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Test Product C (Low Stock)',
      price: 25.0,
      taxRate: 0.18,
      availableQuantity: 1,
      reservedQuantity: 0
    }
  ]);

  const [activeOrder, setActiveOrder] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logs, setLogs] = useState([]);

  // Logging utility
  const appendLog = useCallback((method, url, status, data, idempKey = null) => {
    const time = new Date().toLocaleTimeString();
    const entry = {
      id: Date.now() + Math.random(),
      time,
      method,
      url,
      status,
      data,
      idempotencyKey: idempKey
    };
    setLogs((prev) => [entry, ...prev.slice(0, 49)]);
  }, []);

  // Fetch catalog products
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
        }
      }
    } catch (err) {
      console.warn('Using fallback products', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts, refreshTrigger]);

  // Read order: GET /api/orders/{id}
  const handleSelectOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      appendLog('GET', `/api/orders/${orderId}`, res.status, data);
      if (res.ok) {
        setActiveOrder(data);
        window.scrollTo({ top: 380, behavior: 'smooth' });
      }
    } catch (err) {
      appendLog('GET', `/api/orders/${orderId}`, 0, err.message);
    }
  };

  // Reconcile order: POST /api/admin/orders/{id}/reconcile
  const handleReconcileOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/reconcile`, { method: 'POST' });
      const text = await res.text();
      appendLog('POST', `/api/admin/orders/${orderId}/reconcile`, res.status, text);

      setRefreshTrigger((prev) => prev + 1);
      if (activeOrder && activeOrder.id === orderId) {
        handleSelectOrder(orderId);
      }
    } catch (err) {
      appendLog('POST', `/api/admin/orders/${orderId}/reconcile`, 0, err.message);
    }
  };

  const handleOrderCreated = (order) => {
    setActiveOrder(order);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleOrderUpdated = (order) => {
    setActiveOrder(order);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleWebhookDelivered = () => {
    setRefreshTrigger((prev) => prev + 1);
    if (activeOrder) {
      handleSelectOrder(activeOrder.id);
    }
  };

  return (
    <div className="container">
      <Header />

      <main className="dashboard-grid">
        {/* 1. Create Order: POST /api/orders */}
        <Storefront
          products={products}
          onOrderCreated={handleOrderCreated}
          appendLog={appendLog}
        />

        {/* 2. Read Order, Start Payment, Cancel, Refund */}
        <OrderManager
          order={activeOrder}
          onOrderUpdated={handleOrderUpdated}
          appendLog={appendLog}
        />

        {/* 3. Payment Webhook: POST /api/webhooks/mock-payment */}
        <WebhookSimulator
          activeOrder={activeOrder}
          onWebhookDelivered={handleWebhookDelivered}
          appendLog={appendLog}
        />

        {/* 4. Real-time API Trace Console */}
        <ApiConsole logs={logs} onClear={() => setLogs([])} />

        {/* 5. List Operations: GET /api/admin/orders */}
        <OrdersTable
          onSelectOrder={handleSelectOrder}
          onReconcileOrder={handleReconcileOrder}
          refreshTrigger={refreshTrigger}
          appendLog={appendLog}
        />
      </main>
    </div>
  );
}
