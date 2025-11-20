import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getProducts as getLocalProducts, upsertProduct, softDeleteProduct } from "@/lib/localDb";
import { notifyProductUpdate, notifyProductDelete } from "@/lib/productSync";
import { ArrowLeft, Plus, Edit2, Trash2, Package, Save, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  name: string;
  price: number;
  pcs_price?: number;
  box_price?: number;
  pcs_per_box?: number;
  description: string | null;
  status: string | null;
  created_at: string;
}

const AddProduct = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [boxPrice, setBoxPrice] = useState("");
  const [pcsPrice, setPcsPrice] = useState("");
  const [pcsPerBox, setPcsPerBox] = useState("24");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = (getLocalProducts() || []).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
      setProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setName("");
    setBoxPrice("");
    setPcsPrice("");
    setPcsPerBox("24");
    setDescription("");
    setEditingId(null);
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    const baseBox = product.box_price ?? product.price;
    const ppb = product.pcs_per_box ?? 24;
    const basePcs = product.pcs_price ?? (baseBox ? baseBox / ppb : 0);
    setBoxPrice((baseBox || 0).toString());
    setPcsPrice(basePcs ? basePcs.toFixed(2) : "");
    setPcsPerBox(String(ppb));
    setDescription(product.description || "");
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const boxValue = parseFloat(boxPrice);
      if (!Number.isFinite(boxValue) || boxValue <= 0) {
        toast({
          title: "Invalid Box Price",
          description: "Please enter a valid box price greater than 0",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const ppbValue = parseInt(pcsPerBox, 10);
      if (!Number.isFinite(ppbValue) || ppbValue <= 0) {
        toast({
          title: "Invalid PCS per Box",
          description: "Please enter a valid number of pcs per box (min 1)",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const pcsValue = parseFloat((boxValue / ppbValue).toFixed(2));

      // Explicitly define each field to ensure they're properly recognized
      const productData = {
        name: name.trim(),
        price: boxValue,
        pcs_price: pcsValue,
        box_price: boxValue,
        pcs_per_box: ppbValue,
        description: description.trim() || null,
        status: "active",
      };

      if (editingId) {
        const updated = upsertProduct({ id: editingId, ...productData } as any);
        notifyProductUpdate(editingId, productData);
        toast({
          title: "Product Updated!",
          description: `${name} has been updated successfully`,
        });
      } else {
        const created = upsertProduct(productData as any);
        notifyProductUpdate(created.id, productData);
        toast({
          title: "Product Added!",
          description: `${name} has been added successfully`,
        });
      }

      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error("Full error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setLoading(true);
    try {
      const productToDelete = products.find(p => p.id === deleteId);
      if (!productToDelete) throw new Error("Product not found");
      
      softDeleteProduct(deleteId);
      
      console.log('AddProduct: Notifying about product delete', deleteId);
      notifyProductDelete(deleteId);
      
      toast({
        title: "Product Deleted",
        description: `${productToDelete.name} has been removed`,
      });
      
      setDeleteId(null);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const activeProducts = products.filter(p => p.status === "active");
  const inactiveProducts = products.filter(p => p.status !== "active");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-warning-light/10">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="h-9 w-9 p-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-warning to-warning/80 rounded-lg sm:rounded-xl flex items-center justify-center">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">Manage Products</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">Add or edit products</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        {/* Add/Edit Product Form */}
        <Card className="border-0 shadow-strong mb-6">
          <CardHeader className="pb-4 sm:pb-6 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              {editingId ? (
                <>
                  <Edit2 className="w-5 h-5" />
                  Edit Product
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add New Product
                </>
              )}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {editingId ? "Update product details" : "Enter product details to add to inventory"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base font-semibold">
                  Product Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Coca Cola 500ml"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 sm:h-10 text-base"
                  required
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="box_price" className="text-sm sm:text-base font-semibold">
                  Box Price (₹) *
                </Label>
                <Input
                  id="box_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 240.00"
                  value={boxPrice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBoxPrice(v);
                    const num = parseFloat(v);
                    const ppbNum = parseInt(pcsPerBox, 10);
                    setPcsPrice(Number.isFinite(num) && num > 0 && Number.isFinite(ppbNum) && ppbNum > 0 ? (num / ppbNum).toFixed(2) : "");
                  }}
                  className="h-11 sm:h-10 text-base"
                  inputMode="decimal"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">PCS price auto-calculated as Box ÷ PCS/Box</p>
              </div>

              {/* PCS per Box */}
              <div className="space-y-2">
                <Label htmlFor="pcs_per_box" className="text-sm sm:text-base font-semibold">
                  PCS per Box *
                </Label>
                <Input
                  id="pcs_per_box"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  placeholder="e.g., 24"
                  value={pcsPerBox}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPcsPerBox(v);
                    const ppbNum = parseInt(v, 10);
                    const boxNum = parseFloat(boxPrice);
                    setPcsPrice(Number.isFinite(boxNum) && boxNum > 0 && Number.isFinite(ppbNum) && ppbNum > 0 ? (boxNum / ppbNum).toFixed(2) : "");
                  }}
                  className="h-11 sm:h-10 text-base"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Set how many pieces are in one box</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pcs_price" className="text-sm sm:text-base font-semibold">
                  PCS Price (₹)
                </Label>
                <Input
                  id="pcs_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pcsPrice}
                  readOnly
                  disabled
                  className="h-11 sm:h-10 text-base"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm sm:text-base font-semibold">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Add any additional details about the product"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-20 text-base resize-none"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
                <Button
                  type="submit"
                  variant={editingId ? "default" : "success"}
                  size="default"
                  className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation"
                  disabled={loading}
                >
                  {editingId ? (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      {loading ? "Updating..." : "Update Product"}
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      {loading ? "Adding..." : "Add Product"}
                    </>
                  )}
                </Button>
                
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={resetForm}
                    className="h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation"
                    disabled={loading}
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Products List */}
        <Card className="border-0 shadow-strong">
          <CardHeader className="pb-4 sm:pb-6 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold">Products</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {activeProducts.length} active products
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-4 sm:px-6 pb-6">
            {products.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No products found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProducts.map((product) => {
                  const ppb = product.pcs_per_box ?? 24;
                  const boxPrice = product.box_price ?? product.price ?? ((product.pcs_price ?? 0) * ppb);
                  const pcsPrice = product.pcs_price ?? ((product.box_price ?? product.price ?? 0) / ppb);
                  return (
                  <Card key={product.id} className="border border-border hover:border-primary/50 transition-colors">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground text-base mb-1">{product.name}</h4>
                          <p className="text-sm text-muted-foreground mb-1">Box: ₹{boxPrice.toFixed(2)} · PCS: ₹{pcsPrice.toFixed(2)} · Pcs/Box: {ppb}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            className="h-9 w-9 touch-manipulation"
                            title="Edit product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteId(product.id)}
                            className="h-9 w-9 text-destructive hover:text-destructive touch-manipulation"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                
                {inactiveProducts.length > 0 && (
                  <>
                    <div className="pt-4 pb-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        Inactive Products ({inactiveProducts.length})
                      </h4>
                    </div>
                {inactiveProducts.map((product) => {
                  const ppb = product.pcs_per_box ?? 24;
                  const boxPrice = product.box_price ?? product.price ?? ((product.pcs_price ?? 0) * ppb);
                  const pcsPrice = product.pcs_price ?? ((product.box_price ?? product.price ?? 0) / ppb);
                  return (
                  <Card key={product.id} className="border border-border opacity-60">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground text-base mb-1">{product.name}</h4>
                          <p className="text-sm text-muted-foreground mb-1">Box: ₹{boxPrice.toFixed(2)} · PCS: ₹{pcsPrice.toFixed(2)} · Pcs/Box: {ppb}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                          )}
                        </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEdit(product)}
                                className="h-9 w-9 touch-manipulation"
                                title="Edit product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setDeleteId(product.id)}
                                className="h-9 w-9 text-destructive hover:text-destructive touch-manipulation"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-md mx-3 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the product as inactive. It will no longer appear in product lists but will be preserved in historical data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="touch-manipulation">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-manipulation"
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddProduct;
