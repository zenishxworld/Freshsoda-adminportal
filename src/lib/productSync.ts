/**
 * Product synchronization utility
 * Uses custom events to notify other pages when products are updated
 */

export const PRODUCT_UPDATE_EVENT = 'product-updated';
export const PRODUCT_DELETE_EVENT = 'product-deleted';

/**
 * Notify other pages that a product has been updated
 */
export type ProductUpdateEvent = {
  type: string;
  productId?: string;
  productData?: Record<string, unknown>;
  timestamp: number;
};

export const notifyProductUpdate = (productId: string, productData: Record<string, unknown>) => {
  console.log('Notifying product update:', productId, productData);
  
  const event = new CustomEvent(PRODUCT_UPDATE_EVENT, {
    detail: {
      productId,
      productData,
      timestamp: Date.now()
    }
  });
  
  window.dispatchEvent(event);
  
  // Also use localStorage for cross-tab communication
  const storageEvent: ProductUpdateEvent = {
    type: PRODUCT_UPDATE_EVENT,
    productId,
    productData,
    timestamp: Date.now()
  };
  
  localStorage.setItem('product-update', JSON.stringify(storageEvent));
};

/**
 * Notify other pages that a product has been deleted
 */
export const notifyProductDelete = (productId: string) => {
  console.log('Notifying product delete:', productId);
  
  const event = new CustomEvent(PRODUCT_DELETE_EVENT, {
    detail: {
      productId,
      timestamp: Date.now()
    }
  });
  
  window.dispatchEvent(event);
  
  // Also use localStorage for cross-tab communication
  const storageEvent = {
    type: PRODUCT_DELETE_EVENT,
    productId,
    timestamp: Date.now()
  };
  
  localStorage.setItem('product-delete', JSON.stringify(storageEvent));
};

/**
 * Listen for product updates from other pages
 */
export const listenForProductUpdates = (callback: (event: ProductUpdateEvent) => void) => {
  console.log('Setting up product update listeners');
  
  const handleCustomEvent = (e: CustomEvent) => {
    console.log('Received custom event:', e.type, e.detail);
    const evt: ProductUpdateEvent = {
      type: e.type,
      ...e.detail
    } as ProductUpdateEvent;
    callback(evt);
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'product-update' && e.newValue) {
      try {
        const event = JSON.parse(e.newValue) as ProductUpdateEvent;
        console.log('Received storage event:', event);
        callback(event);
      } catch (error) {
        console.error('Error parsing product update event:', error);
      }
    }
    
    if (e.key === 'product-delete' && e.newValue) {
      try {
        const event = JSON.parse(e.newValue) as ProductUpdateEvent;
        console.log('Received storage event:', event);
        callback(event);
      } catch (error) {
        console.error('Error parsing product delete event:', error);
      }
    }
  };

  // Listen for custom events (same tab)
  window.addEventListener(PRODUCT_UPDATE_EVENT, handleCustomEvent as EventListener);
  window.addEventListener(PRODUCT_DELETE_EVENT, handleCustomEvent as EventListener);
  
  // Listen for storage events (cross tab)
  window.addEventListener('storage', handleStorageChange);

  // Return cleanup function
  return () => {
    console.log('Cleaning up product update listeners');
    window.removeEventListener(PRODUCT_UPDATE_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener(PRODUCT_DELETE_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener('storage', handleStorageChange);
  };
};
