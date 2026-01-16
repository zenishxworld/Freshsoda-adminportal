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
  onAddProduct: (product: Product, stock: DailyStockItem, boxQty: number, pcsQty: number) => void;
  availableProducts: Array<{ product: Product; stock: DailyStockItem }>;
}

const AddProductModal = ({ open, onClose, onAddProduct, availableProducts }: AddProductModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ product: Product; stock: DailyStockItem } | null>(null);
  const [unitMode, setUnitMode] = useState<"box" | "pcs">("box");
  const [quantity, setQuantity] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = availableProducts.filter(({ product }) => {
    if (!searchQuery.trim()) return true;
    return product.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const resetModal = () => {
    setSearchQuery("");
    setSelectedProduct(null);
    setUnitMode("box");
    setQuantity(0);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleSelectProduct = (product: Product, stock: DailyStockItem) => {
    setSelectedProduct({ product, stock });
    setQuantity(0);
    setUnitMode("box");
  };

  const handleBackToSearch = () => {
    setSelectedProduct(null);
    setQuantity(0);
  };

  const adjustQuantity = (delta: number) => {
    if (!selectedProduct) return;

    const { stock, product } = selectedProduct;
    const pcsPerBox = product.pcs_per_box || 24;

    let maxQty = 0;
    if (unitMode === "box") {
      maxQty = stock.boxQty || 0;
    } else {
      // For pcs, allow using boxes too (auto-cut)
      maxQty = (stock.boxQty || 0) * pcsPerBox + (stock.pcsQty || 0);
    }

    setQuantity((prev) => Math.max(0, Math.min(maxQty, prev + delta)));
  };

  const handleQuantityChange = (value: string) => {
    if (!selectedProduct) return;

    const sanitized = value.replace(/[^0-9]/g, "").replace(/^0+/, "") || "0";
    const numValue = parseInt(sanitized) || 0;

    const { stock, product } = selectedProduct;
    const pcsPerBox = product.pcs_per_box || 24;

    let maxQty = 0;
    if (unitMode === "box") {
      maxQty = stock.boxQty || 0;
    } else {
      maxQty = (stock.boxQty || 0) * pcsPerBox + (stock.pcsQty || 0);
    }

    setQuantity(Math.max(0, Math.min(maxQty, numValue)));
  };

  const handleAddToCart = () => {
    if (!selectedProduct || quantity <= 0) return;

    const { product, stock } = selectedProduct;
    const boxQty = unitMode === "box" ? quantity : 0;
    const pcsQty = unitMode === "pcs" ? quantity : 0;

    onAddProduct(product, stock, boxQty, pcsQty);
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

  // Calculate prices
  const currentPrice = selectedProduct
    ? (unitMode === "box"
      ? (selectedProduct.product.box_price || selectedProduct.product.price || 0)
      : (selectedProduct.product.pcs_price || ((selectedProduct.product.box_price || selectedProduct.product.price || 0) / (selectedProduct.product.pcs_per_box || 24))))
    : 0;

  const totalAmount = quantity * currentPrice;

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
                    <p>{searchQuery ? "No matching products matched" : "No products available"}</p>
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
            /* Quantity Selection View */
            <div className="flex-1 flex flex-col">

              {/* Stats Card */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-md border border-border mb-6 flex items-center justify-between">
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
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Price / {unitMode}</p>
                  <p className="text-xl font-bold text-primary">₹{currentPrice.toFixed(2)}</p>
                </div>
              </div>

              {/* Unit Selection Content */}
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-1 shadow-md border border-border flex mb-8">
                <button
                  onClick={() => { setUnitMode("box"); setQuantity(0); }}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2",
                    unitMode === "box"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Box className="w-4 h-4" />
                  Box Unit
                </button>
                <button
                  onClick={() => { setUnitMode("pcs"); setQuantity(0); }}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2",
                    unitMode === "pcs"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  Pieces Unit
                </button>
              </div>

              {/* Quantity Controls */}
              <div className="flex flex-col items-center justify-center gap-4 mb-6">
                <div className="flex items-center justify-center gap-6 w-full">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-16 w-16 rounded-2xl border-2 bg-white dark:bg-zinc-800 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shadow-md active:scale-95"
                    onClick={() => adjustQuantity(-1)}
                    disabled={quantity <= 0}
                  >
                    <Minus className="w-8 h-8" />
                  </Button>

                  <div className="w-32 text-center">
                    <Input
                      type="text"
                      value={String(quantity)}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      className="text-center h-16 text-4xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 p-0"
                      inputMode="numeric"
                    />
                    <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wide">
                      {unitMode === "box" ? "Boxes" : "Pieces"}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-16 w-16 rounded-2xl border-2 bg-white dark:bg-zinc-800 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shadow-md active:scale-95"
                    onClick={() => adjustQuantity(1)}
                  >
                    <Plus className="w-8 h-8" />
                  </Button>
                </div>

                <div className="text-center">
                  <Badge variant="outline" className={cn(
                    "font-normal",
                    quantity >= (unitMode === "box"
                      ? (selectedProduct.stock.boxQty || 0)
                      : ((selectedProduct.stock.boxQty || 0) * (selectedProduct.product.pcs_per_box || 24) + (selectedProduct.stock.pcsQty || 0)))
                      ? "border-destructive/50 text-destructive bg-destructive/5"
                      : "text-muted-foreground border-transparent"
                  )}>
                    Max Available: {unitMode === "box"
                      ? selectedProduct.stock.boxQty || 0
                      : (selectedProduct.stock.boxQty || 0) * (selectedProduct.product.pcs_per_box || 24) + (selectedProduct.stock.pcsQty || 0)
                    }
                  </Badge>
                </div>
              </div>

              {/* Footer Total & Action */}
              <div className="mt-auto">
                <div className="flex items-center justify-between mb-4 px-1">
                  <span className="text-base font-medium text-muted-foreground">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
                  onClick={handleAddToCart}
                  disabled={quantity <= 0}
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

