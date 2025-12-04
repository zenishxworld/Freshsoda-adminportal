import { useState, useRef, useCallback, useEffect } from "react";
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
  onBoxPriceChange: (value: number) => void;
  onPcsPriceChange: (value: number) => void;
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
  onBoxPriceChange,
  onPcsPriceChange,
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

  // Long press functionality
  const boxIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pcsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentBoxQty, setCurrentBoxQty] = useState(boxQty);
  const [currentPcsQty, setCurrentPcsQty] = useState(pcsQty);

  useEffect(() => {
    setCurrentBoxQty(boxQty);
  }, [boxQty]);

  useEffect(() => {
    setCurrentPcsQty(pcsQty);
  }, [pcsQty]);

  const startBoxHold = useCallback((direction: number) => {
    // Immediate change
    const newValue = Math.max(0, Math.min(availableBoxQty, currentBoxQty + direction));
    setCurrentBoxQty(newValue);
    onBoxQtyChange(newValue);
    
    // Then repeat
    boxIntervalRef.current = setInterval(() => {
      setCurrentBoxQty((prev) => {
        const next = Math.max(0, Math.min(availableBoxQty, prev + direction));
        onBoxQtyChange(next);
        return next;
      });
    }, 150);
  }, [currentBoxQty, availableBoxQty, onBoxQtyChange]);

  const stopBoxHold = useCallback(() => {
    if (boxIntervalRef.current) {
      clearInterval(boxIntervalRef.current);
      boxIntervalRef.current = null;
    }
  }, []);

  const startPcsHold = useCallback((direction: number) => {
    // Immediate change
    const newValue = Math.max(0, Math.min(maxPcsQty, currentPcsQty + direction));
    setCurrentPcsQty(newValue);
    onPcsQtyChange(newValue);
    
    // Then repeat
    pcsIntervalRef.current = setInterval(() => {
      setCurrentPcsQty((prev) => {
        const next = Math.max(0, Math.min(maxPcsQty, prev + direction));
        onPcsQtyChange(next);
        return next;
      });
    }, 150);
  }, [currentPcsQty, maxPcsQty, onPcsQtyChange]);

  const stopPcsHold = useCallback(() => {
    if (pcsIntervalRef.current) {
      clearInterval(pcsIntervalRef.current);
      pcsIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopBoxHold();
      stopPcsHold();
    };
  }, [stopBoxHold, stopPcsHold]);

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
                onMouseDown={() => startBoxHold(-1)}
                onMouseUp={stopBoxHold}
                onMouseLeave={stopBoxHold}
                onTouchStart={() => startBoxHold(-1)}
                onTouchEnd={stopBoxHold}
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
                onMouseDown={() => startBoxHold(1)}
                onMouseUp={stopBoxHold}
                onMouseLeave={stopBoxHold}
                onTouchStart={() => startBoxHold(1)}
                onTouchEnd={stopBoxHold}
                disabled={boxQty >= availableBoxQty}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Price (₹)</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={boxPrice}
                onChange={(e) => {
                  const value = Math.max(0, parseFloat(e.target.value || "0"));
                  onBoxPriceChange(value);
                }}
                min={0}
                step="0.01"
                placeholder="0.00"
              />
            </div>
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
                onMouseDown={() => startPcsHold(-1)}
                onMouseUp={stopPcsHold}
                onMouseLeave={stopPcsHold}
                onTouchStart={() => startPcsHold(-1)}
                onTouchEnd={stopPcsHold}
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
                onMouseDown={() => startPcsHold(1)}
                onMouseUp={stopPcsHold}
                onMouseLeave={stopPcsHold}
                onTouchStart={() => startPcsHold(1)}
                onTouchEnd={stopPcsHold}
                disabled={pcsQty >= maxPcsQty}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Price (₹)</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={pcsPrice}
                onChange={(e) => {
                  const value = Math.max(0, parseFloat(e.target.value || "0"));
                  onPcsPriceChange(value);
                }}
                min={0}
                step="0.01"
                placeholder="0.00"
              />
            </div>
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

