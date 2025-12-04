import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Plus, Minus, X } from "lucide-react";
import { Product, DailyStockItem } from "../../lib/supabase";

interface ProductQuantityCardProps {
  product: Product;
  stock: DailyStockItem;
  boxQty: number;
  pcsQty: number;
  onBoxQtyChange: (value: number) => void;
  onPcsQtyChange: (value: number) => void;
  onRemove: () => void;
  boxPrice: number;
  pcsPrice: number;
  totalAmount: number;
}

const ProductQuantityCard = ({
  product,
  stock,
  boxQty,
  pcsQty,
  onBoxQtyChange,
  onPcsQtyChange,
  onRemove,
  boxPrice,
  pcsPrice,
  totalAmount,
}: ProductQuantityCardProps) => {
  const pcsPerBox = product.pcs_per_box || 24;
  const availableBoxQty = stock.boxQty || 0;
  const availablePcsQty = stock.pcsQty || 0;
  const totalAvailablePcs = (availableBoxQty * pcsPerBox) + availablePcsQty;
  const currentTotalPcs = (boxQty * pcsPerBox) + pcsQty;
  const maxPcsQty = totalAvailablePcs - (boxQty * pcsPerBox);

  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-base mb-1">{product.name}</h4>
            <p className="text-xs text-muted-foreground">
              Available: {availableBoxQty} Box, {availablePcsQty} PCS
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Box Quantity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Unit: Box</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => onBoxQtyChange(Math.max(0, boxQty - 1))}
                disabled={boxQty === 0}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                className="w-20 text-center h-9"
                value={boxQty}
                onChange={(e) => {
                  const value = Math.max(0, Math.min(availableBoxQty, parseInt(e.target.value || "0", 10)));
                  onBoxQtyChange(value);
                }}
                min={0}
                max={availableBoxQty}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => onBoxQtyChange(Math.min(availableBoxQty, boxQty + 1))}
                disabled={boxQty >= availableBoxQty}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">₹{boxPrice.toFixed(2)} per box</p>
          </div>

          {/* PCS Quantity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Unit: 1 pcs</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => onPcsQtyChange(Math.max(0, pcsQty - 1))}
                disabled={pcsQty === 0}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                className="w-20 text-center h-9"
                value={pcsQty}
                onChange={(e) => {
                  const value = Math.max(0, Math.min(maxPcsQty, parseInt(e.target.value || "0", 10)));
                  onPcsQtyChange(value);
                }}
                min={0}
                max={maxPcsQty}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => onPcsQtyChange(Math.min(maxPcsQty, pcsQty + 1))}
                disabled={pcsQty >= maxPcsQty}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">₹{pcsPrice.toFixed(2)} per pcs</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <span className="text-sm font-medium">Line Total:</span>
          <span className="text-lg font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductQuantityCard;

