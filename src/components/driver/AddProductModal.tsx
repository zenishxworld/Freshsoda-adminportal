import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, Package } from "lucide-react";
import { Product, DailyStockItem } from "../../lib/supabase";

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product, stock: DailyStockItem) => void;
  availableProducts: Array<{ product: Product; stock: DailyStockItem }>;
}

const AddProductModal = ({ open, onClose, onSelectProduct, availableProducts }: AddProductModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = availableProducts.filter(({ product }) => {
    if (!searchQuery.trim()) return true;
    return product.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectProduct = (product: Product, stock: DailyStockItem) => {
    onSelectProduct(product, stock);
    setSearchQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add Product</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No products found" : "No products available"}
              </div>
            ) : (
              filteredProducts.map(({ product, stock }) => {
                const pcsPerBox = product.pcs_per_box || 24;
                const availablePcs = (stock.boxQty || 0) * pcsPerBox + (stock.pcsQty || 0);

                return (
                  <div
                    key={product.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleSelectProduct(product, stock)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base">{product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Available: {stock.boxQty || 0} Box, {stock.pcsQty || 0} PCS
                            <span className="ml-2">({availablePcs} total PCS)</span>
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductModal;

