import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { SocketProvider } from './context/SocketContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileTabBar } from './components/common/MobileTabBar';
import { ProductTable } from './components/products/ProductTable';
import { ProductDrawer } from './components/products/ProductDrawer';
import { RestockModal } from './components/products/RestockModal';
import { CreateProductModal } from './components/products/CreateProductModal';
import { POSScreen } from './components/billing/POSScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { MovementsScreen } from './components/movements/MovementsScreen';
import { ReconcileScreen } from './components/reconcile/ReconcileScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';

function MainLayout() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);
  const [openNewProduct, setOpenNewProduct] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        onOpenNewProduct={() => setOpenNewProduct(true)}
        onOpenRestock={(p) => setRestockProduct(p)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-16 lg:pb-6">
        <Sidebar />

        <main className="flex-1 p-4 lg:p-6 min-w-0">
          <Routes>
            <Route
              path="/"
              element={
                <ProductTable
                  onSelectProduct={(p) => setSelectedProduct(p)}
                  onOpenRestock={(p) => setRestockProduct(p)}
                  onOpenNewProduct={() => setOpenNewProduct(true)}
                />
              }
            />
            <Route path="/pos" element={<POSScreen />} />
            <Route
              path="/dashboard"
              element={<DashboardScreen onOpenRestock={(p) => setRestockProduct(p)} />}
            />
            <Route path="/movements" element={<MovementsScreen />} />
            <Route path="/reconcile" element={<ReconcileScreen />} />
            <Route path="/reports" element={<ReportsScreen />} />
          </Routes>
        </main>
      </div>

      <MobileTabBar />

      {/* Global Modals & Drawers */}
      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onOpenRestock={(p) => {
            setSelectedProduct(null);
            setRestockProduct(p);
          }}
        />
      )}

      {restockProduct && (
        <RestockModal
          product={restockProduct}
          onClose={() => setRestockProduct(null)}
          onSuccess={() => {}}
        />
      )}

      {openNewProduct && (
        <CreateProductModal
          onClose={() => setOpenNewProduct(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SocketProvider>
          <BrowserRouter>
            <MainLayout />
          </BrowserRouter>
        </SocketProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
