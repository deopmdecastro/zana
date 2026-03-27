import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'zana_cart';

const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeItem = (product, quantity = 1, color = '') => ({
  product_id: product.id,
  product_name: product.name,
  product_image: product.images?.[0] || '',
  price: Number(product.price) || 0,
  quantity: Number(quantity) || 1,
  color: color || '',
});

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') return [];
    const stored = safeParse(window.localStorage.getItem(STORAGE_KEY) || '');
    return Array.isArray(stored) ? stored : [];
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1, color = '') => {
    const normalized = normalizeItem(product, quantity, color);
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.product_id === normalized.product_id && (i.color || '') === (normalized.color || '')
      );
      if (existingIndex === -1) return [...prev, normalized];
      const next = [...prev];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + normalized.quantity,
      };
      return next;
    });
  };

  const updateQuantity = (productId, color = '', nextQuantity) => {
    const qty = Number(nextQuantity) || 0;
    setItems((prev) => {
      if (qty <= 0) {
        return prev.filter((i) => !(i.product_id === productId && (i.color || '') === (color || '')));
      }
      return prev.map((i) => {
        if (i.product_id === productId && (i.color || '') === (color || '')) {
          return { ...i, quantity: qty };
        }
        return i;
      });
    });
  };

  const removeItem = (productId, color = '') => {
    setItems((prev) => prev.filter((i) => !(i.product_id === productId && (i.color || '') === (color || ''))));
  };

  const clearCart = () => setItems([]);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0),
    [items]
  );

  // Back-compat aliases (some components still reference these names)
  const cartItems = items;
  const addToCart = (product) => addItem(product, 1, '');
  const removeFromCart = (id) => setItems((prev) => prev.filter((i) => i.product_id !== id));
  const getCartTotal = () => subtotal;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        subtotal,
        itemCount,
        cartItems,
        addToCart,
        removeFromCart,
        getCartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

