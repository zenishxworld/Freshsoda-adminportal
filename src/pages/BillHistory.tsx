import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getRoutes as getLocalRoutes, getSalesFor } from "@/lib/localDb";
import { mapRouteName, shouldDisplayRoute } from "@/lib/routeUtils";
import { ArrowLeft, Calendar, Printer, Package, Store } from "lucide-react";

interface SaleRow {
  id: string;
  shop_name: string;
  date: string;
  products_sold: any;
  total_amount: number;
  route_id: string;
  truck_id: string;
  created_at: string;
}

const BillHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [routesMap, setRoutesMap] = useState<Record<string, string>>({});
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [filterRouteId, setFilterRouteId] = useState<string>("");
  // Keep a filtered/mapped list for rendering options, same as StartRoute style
  const [routes, setRoutes] = useState<Array<{ id: string; name: string; displayName: string }>>([]);

  // Preload stored date and route to behave same as ShopBilling/StartRoute
  useEffect(() => {
    const storedDate = localStorage.getItem("currentDate");
    const storedRoute = localStorage.getItem("currentRoute");
    if (storedDate) setSelectedDate(storedDate);
    if (storedRoute) setFilterRouteId(storedRoute);
  }, []);

  useEffect(() => {
    // Preload all active routes to map names and filter hidden ones
    const loadRoutes = async () => {
      const data = getLocalRoutes().filter((r: any) => r.is_active !== false);
      const filtered = (data || []).filter((r: any) => shouldDisplayRoute(r.name));
      const mapped = filtered.map((r: any) => ({ id: r.id, name: r.name, displayName: mapRouteName(r.name) }));
      setRoutes(mapped);
      const map: Record<string, string> = {};
      mapped.forEach((r) => (map[r.id] = r.displayName));
      setRoutesMap(map);
    };
    loadRoutes();
  }, []);

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      try {
        const raw = getSalesFor(selectedDate, filterRouteId) as any[];
        const sorted = [...raw].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        setSales(sorted as any);
      } catch (err: any) {
        toast({ title: "Error", description: err.message || "Failed to load bills", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadSales();
  }, [selectedDate, filterRouteId, toast]);

  const totalBills = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const getRouteName = (routeId: string) => routesMap[routeId] || "Unknown Route";

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const onPrintSelected = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent-light/10">
      {/* Header - Hidden when printing */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="h-9 w-9 p-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-success-green to-accent rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Bill History</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">View all bills created for a day</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filters and Stats */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        <Card className="border-0 shadow-strong">
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-bold">Filters</CardTitle>
            <CardDescription className="text-sm sm:text-base">Choose date to see all bills (works for every route)</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Select Date
                </Label>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label id="route-filter-label" className="text-sm sm:text-base font-semibold">Filter by Route (optional)</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={filterRouteId} onValueChange={(v) => setFilterRouteId(v)}>
                      <SelectTrigger className="h-10 w-full" aria-labelledby="route-filter-label">
                        <SelectValue placeholder="All Routes" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="h-10" onClick={() => setFilterRouteId("")}>Clear</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-base font-semibold">Summary</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-primary-light/20 border">
                    <div className="text-xs text-muted-foreground">Bills</div>
                    <div className="text-lg font-bold text-primary">{totalBills}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-success-green-light/20 border">
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="text-lg font-bold text-success-green">₹{totalRevenue.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bills List */}
            <div className="mt-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-6">Loading bills...</div>
              ) : sales.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">No bills found for the selected date</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {sales.map((sale) => {
                    const items = Array.isArray(sale.products_sold) ? sale.products_sold : (sale.products_sold?.items || []);
                    const totalItems = items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
                    return (
                      <Card key={sale.id} className="border hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">{sale.date} · {formatTime(sale.created_at)}</div>
                              <div className="text-base font-semibold text-foreground">{sale.shop_name}</div>
                              <div className="text-xs text-muted-foreground">{getRouteName(sale.route_id)}</div>
                              <div className="text-xs text-muted-foreground">Items: {totalItems}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-lg font-bold text-success-green">₹{sale.total_amount.toFixed(2)}</div>
                              <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
                                View / Print
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bill details dialog */}
        <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
          <DialogContent className="max-w-2xl print:shadow-none print:border-0 print:bg-white">
            {/* Header inside dialog - hide when printing */}
            <DialogHeader className="print:hidden">
              <DialogTitle>Bill Details</DialogTitle>
              <DialogDescription>Review and print the bill</DialogDescription>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-4">
                {/* Top info and actions - hide on print */}
                <div className="flex items-center justify-between mb-3 print:hidden">
                  <div>
                    <div className="text-sm text-muted-foreground">{selectedSale.date} · {formatTime(selectedSale.created_at)}</div>
                    <div className="text-base font-semibold">{selectedSale.shop_name}</div>
                    <div className="text-xs text-muted-foreground">{getRouteName(selectedSale.route_id)}</div>
                  </div>
                  <Button variant="outline" onClick={onPrintSelected}>
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </Button>
                </div>

                {/* Printable Bill — same layout as ShopBilling */}
                <div className="receipt print:p-0 print:bg-white print:text-black print:font-mono print:w-[58mm] print:mx-0">
                  <Card className="border-0 shadow-strong print:shadow-none print:border-0">
                    <CardContent className="p-6 sm:p-8 print:p-2">
                      {/* Bill Header */}
                      <div className="text-center mb-6 print:mb-3">
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground print:text-lg">BHAVYA ENTERPRICE</h1>
                        <p className="text-sm font-semibold text-foreground print:text-[10px]">Sales Invoice</p>
                        {/* Address */}
                        <div className="mt-1 text-xs text-foreground print:text-[10px]">
                          <p className="leading-tight">Near Bala petrol pump</p>
                          <p className="leading-tight">Jambusar Bharuch road</p>
                        </div>
                        {/* Phone and GSTIN */}
                        <div className="mt-2 text-xs text-foreground print:text-[10px]">
                          <p className="leading-tight">Phone no.: 8866756059</p>
                          <p className="leading-tight">GSTIN: 24EVVPS8220P1ZF</p>
                        </div>
                        {/* Date/Time and Route */}
                        <div className="mt-2 text-xs text-foreground print:text-[10px]">
                          <p className="leading-tight">Date: {new Date(selectedSale.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</p>
                          <p className="font-semibold text-primary">Route: {getRouteName(selectedSale.route_id)}</p>
                        </div>
                      </div>

                      {/* Shop Details */}
                      <div className="mb-6 print:mb-3 pb-3 border-t border-b border-dashed">
                        <div className="flex items-center gap-2 mb-1">
                          <Store className="w-5 h-5 text-primary print:w-4 print:h-4" />
                          <span className="font-semibold text-foreground print:text-[11px]">Shop:</span>
                        </div>
                        <p className="text-lg font-bold text-foreground pl-7 print:text-sm">{selectedSale.shop_name}</p>
                        {!Array.isArray(selectedSale.products_sold) && selectedSale.products_sold?.shop_address && (
                          <p className="text-xs text-muted-foreground pl-7 mt-1 print:text-[10px]">Address/Village: {selectedSale.products_sold.shop_address}</p>
                        )}
                        {!Array.isArray(selectedSale.products_sold) && selectedSale.products_sold?.shop_phone && (
                          <p className="text-xs text-muted-foreground pl-7 print:text-[10px]">Phone: {selectedSale.products_sold.shop_phone}</p>
                        )}
                      </div>

                      {/* Products Table */}
                      <div className="mb-6 print:mb-3">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-foreground border-dashed">
                              <th className="text-left py-2 font-bold text-foreground print:text-[11px] print:py-1">Item</th>
                              <th className="text-center py-2 font-bold text-foreground print:text-[11px] print:py-1">Qty</th>
                              <th className="text-right py-2 font-bold text-foreground print:text-[11px] print:py-1">Rate</th>
                              <th className="text-right py-2 font-bold text-foreground print:text-[11px] print:py-1">Amt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(selectedSale.products_sold) ? selectedSale.products_sold : (selectedSale.products_sold?.items || [])).map((item: any, index: number) => (
                              <tr key={index} className="border-b border-border">
                                <td className="py-3 text-foreground print:text-[11px] print:py-1">{item.productName || item.name}</td>
                                <td className="py-3 text-center text-foreground print:text-[11px] print:py-1">{item.quantity} {item.unit === 'box' ? 'Box' : item.unit === 'pcs' ? 'pcs' : ''}</td>
                                <td className="py-3 text-right text-foreground print:text-[11px] print:py-1">₹{(item.price ?? 0).toFixed(2)}</td>
                                <td className="py-3 text-right font-semibold text-foreground print:text-[11px] print:py-1">₹{(item.total ?? (item.quantity * (item.price ?? 0))).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Total Section */}
                      <div className="border-t border-foreground border-dashed pt-3 print:pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-lg font-bold text-foreground print:text-sm">TOTAL:</span>
                          <span className="text-2xl font-bold text-primary print:text-base">₹{selectedSale.total_amount.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground text-right print:text-[10px]">
                          Items: {(Array.isArray(selectedSale.products_sold) ? selectedSale.products_sold : (selectedSale.products_sold?.items || [])).reduce((sum: number, it: any) => sum + (it.quantity || 0), 0)}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-6 pt-3 border-t border-dashed text-center print:mt-4 print:pt-2">
                        <p className="text-sm font-semibold text-foreground print:text-[10px]">Thank you for your business!</p>
                        <p className="text-xs text-muted-foreground mt-1 print:text-[9px]">Have a great day!</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Portal: Render print-only receipt at document body level (same as ShopBilling) */}
                {createPortal(
                  <div id="print-receipt-container" style={{ display: 'none' }}>
                    <div className="receipt-58mm">
                      {/* Bill Header */}
                      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                        <h1 style={{ margin: '0', fontSize: '12px', fontWeight: 'bold' }}>BHAVYA ENTERPRICE</h1>
                        <p style={{ margin: '0', fontSize: '9px', fontWeight: 600 }}>Sales Invoice</p>
                        {/* Address */}
                        <div style={{ marginTop: '2px', fontSize: '8px' }}>
                          <p style={{ margin: 0, lineHeight: '1.1' }}>Near Bala petrol pump</p>
                          <p style={{ margin: 0, lineHeight: '1.1' }}>Jambusar Bharuch road</p>
                        </div>
                        {/* Phone and GSTIN */}
                        <div style={{ marginTop: '2px', fontSize: '8px' }}>
                          <p style={{ margin: 0, lineHeight: '1.1' }}>Phone: 8866756059</p>
                          <p style={{ margin: 0, lineHeight: '1.1' }}>GSTIN: 24EVVPS8220P1ZF</p>
                        </div>
                        {/* Date/Time and Route */}
                        <div style={{ marginTop: '2px', fontSize: '8px' }}>
                          <p style={{ margin: 0 }}>Date: {selectedSale ? new Date(selectedSale.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : ''}</p>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>Route: {getRouteName(selectedSale!.route_id)}</p>
                        </div>
                      </div>

                      {/* Shop Details */}
                      <div style={{ marginBottom: '4px', paddingBottom: '2px', borderTop: '1px dashed black', borderBottom: '1px dashed black', paddingTop: '2px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 600, margin: 0 }}>Shop: {selectedSale?.shop_name}</p>
                        {!Array.isArray(selectedSale?.products_sold) && (selectedSale as any)?.products_sold?.shop_address && (
                          <p style={{ fontSize: '8px', margin: 0 }}>Addr: {(selectedSale as any).products_sold.shop_address}</p>
                        )}
                        {!Array.isArray(selectedSale?.products_sold) && (selectedSale as any)?.products_sold?.shop_phone && (
                          <p style={{ fontSize: '8px', margin: 0 }}>Ph: {(selectedSale as any).products_sold.shop_phone}</p>
                        )}
                      </div>

                      {/* Products Table */}
                      <div style={{ marginBottom: '4px' }}>
                        <table style={{ width: '100%', fontSize: '8px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px dashed black' }}>
                              <th style={{ textAlign: 'left', padding: '1px 0', fontSize: '8px' }}>Item</th>
                              <th style={{ textAlign: 'center', padding: '1px 0', fontSize: '8px' }}>Qty</th>
                              <th style={{ textAlign: 'right', padding: '1px 0', fontSize: '8px' }}>Rate</th>
                              <th style={{ textAlign: 'right', padding: '1px 0', fontSize: '8px' }}>Amt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(selectedSale.products_sold) ? selectedSale.products_sold : (selectedSale.products_sold?.items || [])).map((item: any, index: number) => (
                              <tr key={index}>
                                <td style={{ padding: '1px 0', fontSize: '8px' }}>{item.productName || item.name}</td>
                                <td style={{ padding: '1px 0', textAlign: 'center', fontSize: '8px' }}>{item.quantity} {item.unit === 'box' ? 'Box' : item.unit === 'pcs' ? 'pcs' : ''}</td>
                                <td style={{ padding: '1px 0', textAlign: 'right', fontSize: '8px' }}>₹{(item.price ?? 0).toFixed(2)}</td>
                                <td style={{ padding: '1px 0', textAlign: 'right', fontSize: '8px', fontWeight: 600 }}>₹{(item.total ?? (item.quantity * (item.price ?? 0))).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Total Section */}
                      <div style={{ borderTop: '1px dashed black', paddingTop: '2px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>TOTAL:</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{selectedSale?.total_amount.toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: '8px', textAlign: 'right' }}>
                          Items: {(Array.isArray(selectedSale!.products_sold) ? selectedSale!.products_sold : (selectedSale!.products_sold?.items || [])).reduce((sum: number, it: any) => sum + (it.quantity || 0), 0)}
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={{ marginTop: '4px', paddingTop: '2px', borderTop: '1px dashed black', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', fontWeight: 600, margin: 0 }}>Thank you for your business!</p>
                        <p style={{ fontSize: '8px', margin: 0 }}>Have a great day!</p>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background-color: #fff;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }

          /* Set page size for 58mm roll printer */
          @page {
            size: 58mm auto;
            margin: 0mm;
          }

          html, body {
            width: 58mm !important;
          }

          /* Hide all body children except our print container */
          body > *:not(#print-receipt-container) {
            display: none !important;
          }

          /* Show the print container */
          #print-receipt-container {
            display: block !important;
            position: relative !important;
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-sizing: border-box !important;
          }

          .receipt-58mm {
            display: block !important;
            width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            background: white !important;
            color: #000 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }

          .receipt-58mm * {
            color: #000 !important;
            border-color: #000 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .receipt-58mm p { margin: 0 !important; }

          .receipt-58mm h1 {
            font-size: 12px !important;
            font-weight: bold !important;
            margin: 2px 0 !important;
            text-align: center !important;
          }

          .receipt-58mm table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin: 2px 0 !important;
          }

          .receipt-58mm th,
          .receipt-58mm td {
            padding: 1px 2px !important;
            font-size: 9px !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }

          .receipt-58mm th {
            font-weight: bold !important;
            border-bottom: 1px dashed black !important;
          }

          /* Column widths to avoid overflow */
          .receipt-58mm th:nth-child(1), .receipt-58mm td:nth-child(1) { width: 52% !important; }
          .receipt-58mm th:nth-child(2), .receipt-58mm td:nth-child(2) { width: 14% !important; }
          .receipt-58mm th:nth-child(3), .receipt-58mm td:nth-child(3) { width: 16% !important; }
          .receipt-58mm th:nth-child(4), .receipt-58mm td:nth-child(4) { width: 18% !important; }

          .receipt {
            width: 58mm !important;
            margin: 0 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            color: #000 !important;
          }

          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BillHistory;