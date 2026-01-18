import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, Package, Plus, Minus, ChevronLeft, ShoppingCart, Box, Layers } from "lucide-react";
import { Product, DailyStockItem } from "../../lib/supabase";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onAddProduct: (product: Product, stock: DailyStockItem, boxQty: number, pcsQty: number, boxPrice: number, pcsPrice: number) => void;
  availableProducts: Array<{ product: Product; stock: DailyStockItem }>;
}

const AddProductModal = ({ open, onClose, onAddProduct, availableProducts }: AddProductModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ product: Product; stock: DailyStockItem } | null>(null);
  const [boxQty, setBoxQty] = useState<number>(0);
  const [pcsQty, setPcsQty] = useState<number>(0);
  const [boxPrice, setBoxPrice] = useState<number>(0);
  const [pcsPrice, setPcsPrice] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = availableProducts.filter(({ product }) => {
    if (!searchQuery.trim()) return true;
    return product.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const resetModal = () => {
    setSearchQuery("");
    setSelectedProduct(null);
    setBoxQty(0);
    setPcsQty(0);
    setBoxPrice(0);
    setPcsPrice(0);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleSelectProduct = (product: Product, stock: DailyStockItem) => {
    setSelectedProduct({ product, stock });
    setBoxQty(0);
    setPcsQty(0);
    // Initialize prices from product
    const initialBoxPrice = product.box_price || product.price || 0;
    const initialPcsPrice = product.pcs_price || (initialBoxPrice / (product.pcs_per_box || 24));
    setBoxPrice(initialBoxPrice);
    setPcsPrice(initialPcsPrice);
  };

  const handleBackToSearch = () => {
    setSelectedProduct(null);
    setBoxQty(0);
    setPcsQty(0);
    setBoxPrice(0);
    setPcsPrice(0);
  };

  const adjustBoxQty = (delta: number) => {
    if (!selectedProduct) return;
    const maxBoxQty = selectedProduct.stock.boxQty || 0;
    setBoxQty((prev) => Math.max(0, Math.min(maxBoxQty, prev + delta)));
  };

  const adjustPcsQty = (delta: number) => {
    if (!selectedProduct) return;
    const pcsPerBox = selectedProduct.product.pcs_per_box || 24;
    // Max pcs = available pcs + (boxes that can be cut * pcs_per_box)
    const maxPcsQty = (selectedProduct.stock.boxQty || 0) * pcsPerBox + (selectedProduct.stock.pcsQty || 0);
    setPcsQty((prev) => Math.max(0, Math.min(maxPcsQty, prev + delta)));
  };

  const handleBoxQtyChange = (value: string) => {
    if (!selectedProduct) return;
    const sanitized = value.replace(/[^0-9]/g, "").replace(/^0+/, "") || "0";
    const numValue = parseInt(sanitized) || 0;
    const maxBoxQty = selectedProduct.stock.boxQty || 0;
    setBoxQty(Math.max(0, Math.min(maxBoxQty, numValue)));
  };

  const handlePcsQtyChange = (value: string) => {
    if (!selectedProduct) return;
    const sanitized = value.replace(/[^0-9]/g, "").replace(/^0+/, "") || "0";
    const numValue = parseInt(sanitized) || 0;
    const pcsPerBox = selectedProduct.product.pcs_per_box || 24;
    const maxPcsQty = (selectedProduct.stock.boxQty || 0) * pcsPerBox + (selectedProduct.stock.pcsQty || 0);
    setPcsQty(Math.max(0, Math.min(maxPcsQty, numValue)));
  };

  const handleBoxPriceChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const numValue = parseFloat(sanitized) || 0;
    setBoxPrice(Math.max(0, numValue));
  };

  const handlePcsPriceChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const numValue = parseFloat(sanitized) || 0;
    setPcsPrice(Math.max(0, numValue));
  };

  const handleAddToCart = () => {
    if (!selectedProduct || (boxQty <= 0 && pcsQty <= 0)) return;
    onAddProduct(selectedProduct.product, selectedProduct.stock, boxQty, pcsQty, boxPrice, pcsPrice);
    handleClose();
  };

  // Autofocus search when modal opens
  useEffect(() => {
    if (open && !selectedProduct && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open, selectedProduct]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      resetModal();
    }
  }, [open]);

  // Calculate total amount using editable prices
  const totalAmount = (boxQty * boxPrice) + (pcsQty * pcsPrice);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-none shadow-2xl bg-background">

        {/* Header Section */}
        <div className="bg-primary px-6 py-5 text-primary-foreground">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-3">
              {selectedProduct && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToSearch}
                  className="h-8 w-8 -ml-2 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <DialogTitle className="text-xl font-bold tracking-tight">
                {selectedProduct ? "Add Quantity" : "Select Product"}
              </DialogTitle>
            </div>
            <p className="text-primary-foreground/80 text-sm font-medium pl-1">
              {selectedProduct
                ? selectedProduct.product.name
                : "Choose items to add to bill"}
            </p>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900 flex-1 overflow-hidden flex flex-col min-h-[400px]">
          {!selectedProduct ? (
            /* Product Selection View */
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 bg-white dark:bg-zinc-800 border-border shadow-sm focus-visible:ring-primary/20 text-base"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto -mx-2 px-2 pb-2 space-y-2.5">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                    <Package className="w-12 h-12 opacity-20" />
                    <p>{searchQuery ? "No matching products found" : "No products available"}</p>
                  </div>
                ) : (
                  filteredProducts.map(({ product, stock }) => (
                    <Card
                      key={product.id}
                      className="group cursor-pointer bg-white dark:bg-zinc-800 hover:border-primary/50 hover:shadow-md transition-all duration-200 border-border shadow-sm active:scale-[0.98]"
                      onClick={() => handleSelectProduct(product, stock)}
                    >
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <Package className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="px-1.5 py-0 h-5 text-xs font-normal text-muted-foreground bg-muted/60">
                                <Box className="w-3 h-3 mr-1" />
                                {stock.boxQty || 0} Box
                              </Badge>
                              <Badge variant="secondary" className="px-1.5 py-0 h-5 text-xs font-normal text-muted-foreground bg-muted/60">
                                <Layers className="w-3 h-3 mr-1" />
                                {stock.pcsQty || 0} Pcs
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground/50">
                          <Plus className="w-5 h-5" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Quantity Selection View - Now with BOTH Box and Pieces */
            <div className="flex-1 flex flex-col">

              {/* Stats Card */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-md border border-border mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Available Stock</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold">{selectedProduct.stock.boxQty || 0}</span>
                      <span className="text-xs text-muted-foreground">Box</span>
                    </div>
                    <div className="h-8 w-px bg-border/60"></div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold">{selectedProduct.stock.pcsQty || 0}</span>
                      <span className="text-xs text-muted-foreground">Pcs</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Box / Pcs Price</p>
                  <p className="text-lg font-bold text-primary">₹{boxPrice.toFixed(0)} / ₹{pcsPrice.toFixed(2)}</p>
                </div>
              </div>

              {/* Dual Quantity Inputs */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Box Quantity */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-md border border-border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Box className="w-5 h-5 text-primary" />
                    <span className="text-sm font-bold text-foreground">Boxes</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-2 bg-white dark:bg-zinc-700 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
                      onClick={() => adjustBoxQty(-1)}
                      disabled={boxQty <= 0}
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                    <Input
                      type="text"
                      value={String(boxQty)}
                      onChange={(e) => handleBoxQtyChange(e.target.value)}
                      className="text-center w-16 h-12 text-2xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 p-0"
                      inputMode="numeric"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-2 bg-white dark:bg-zinc-700 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
                      onClick={() => adjustBoxQty(1)}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Max: {selectedProduct.stock.boxQty || 0}
                  </p>
                </div>

                {/* Pieces Quantity */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-md border border-border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <span className="text-sm font-bold text-foreground">Pieces</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-2 bg-white dark:bg-zinc-700 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
                      onClick={() => adjustPcsQty(-1)}
                      disabled={pcsQty <= 0}
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                    <Input
                      type="text"
                      value={String(pcsQty)}
                      onChange={(e) => handlePcsQtyChange(e.target.value)}
                      className="text-center w-16 h-12 text-2xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 p-0"
                      inputMode="numeric"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-2 bg-white dark:bg-zinc-700 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95"
                      onClick={() => adjustPcsQty(1)}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Max: {(selectedProduct.stock.boxQty || 0) * (selectedProduct.product.pcs_per_box || 24) + (selectedProduct.stock.pcsQty || 0)}
                  </p>
                </div>
              </div>

              {/* Price Editing Section */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Box Price */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Box className="w-3 h-3" />
                    Box Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="text"
                      value={boxPrice > 0 ? boxPrice.toString() : ""}
                      onChange={(e) => handleBoxPriceChange(e.target.value)}
                      placeholder="0.00"
                      className="pl-7 h-10 text-base font-semibold"
                      inputMode="decimal"
                    />
                  </div>
                </div>

                {/* Pcs Price */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Pcs Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="text"
                      value={pcsPrice > 0 ? pcsPrice.toString() : ""}
                      onChange={(e) => handlePcsPriceChange(e.target.value)}
                      placeholder="0.00"
                      className="pl-7 h-10 text-base font-semibold"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              {(boxQty > 0 || pcsQty > 0) && (
                <div className="bg-muted/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>Adding:</span>
                    {boxQty > 0 && <Badge variant="secondary" className="font-semibold">{boxQty} Box</Badge>}
                    {boxQty > 0 && pcsQty > 0 && <span>+</span>}
                    {pcsQty > 0 && <Badge variant="secondary" className="font-semibold">{pcsQty} Pcs</Badge>}
                  </div>
                </div>
              )}

              {/* Footer Total & Action */}
              <div className="mt-auto">
                <div className="flex items-center justify-between mb-4 px-1">
                  <span className="text-base font-medium text-muted-foreground">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
                  onClick={handleAddToCart}
                  disabled={boxQty <= 0 && pcsQty <= 0}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
              </div>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductModal;


