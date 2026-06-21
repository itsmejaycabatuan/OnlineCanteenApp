import React, { createContext, useContext, useState } from "react";

const CartContext = createContext<any>(null);

export const CartProvider = ({ children }: any) => {
  const [cart, setCart] = useState<any[]>([]);

  // ✅ ADD TO CART
  const addToCart = (food: any) => {
    const existing = cart.find((item) => item.id === food.id);
    const incomingQuantity = food.quantity ? Number(food.quantity) : 1;

    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === food.id
            ? { ...item, quantity: item.quantity + incomingQuantity }
            : item
        )
      );
    } else {
      setCart([...cart, { ...food, quantity: incomingQuantity }]);
    }
  };

  // ✅ REMOVE ITEM
  const removeFromCart = (id: number) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // ✅ INCREASE QTY
  const increaseQty = (id: number) => {
    setCart(
      cart.map((item) =>
        item.id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  // ✅ DECREASE QTY
  const decreaseQty = (id: number) => {
    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: item.quantity > 1 ? item.quantity - 1 : 1,
            }
          : item
      )
    );
  };
  
const updateNote = (id: string, note: string | undefined) => {
  setCart(
    cart.map((item) =>
      item.id === id ? { ...item, note } : item
    )
  );
};
  // ✅ TOTAL
  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // ⭐ FIX YOU WERE MISSING THIS
  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        increaseQty,
        decreaseQty,
        clearCart, // ⭐ REQUIRED FIX
        total,
        updateNote,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// ✅ HOOK
export const useCart = () => useContext(CartContext);