import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Printer, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BillPreviewProps {
  bill: {
    shopName: string;
    shopAddress?: string;
    shopPhone?: string;
    routeName: string;
    date: string;
    items: Array<{
      productId: string;
      productName: string;
      boxQty: number;
      pcsQty: number;
      rate: number;
      amount: number;
    }>;
    totalAmount: number;
  };
  onBack: () => void;
}

const BillPreview = ({ bill, onBack }: BillPreviewProps) => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-success-green-light/10">
      {/* Header - Hidden when printing */}
      <header className="bg-white backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-9 w-9 p-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-success-green to-accent rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">
                    Bill Preview
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">
                    Review and print the bill
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        <Card className="border-0 shadow-strong print:shadow-none print:border-0">
          <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6 print:hidden">
            <CardTitle className="text-xl sm:text-2xl font-bold text-success-green-dark">
              Bill Generated!
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-700">
              Review and print the bill
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 print:p-0">
            {/* Action Buttons - Hidden when printing */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6 print:hidden">
              <Button
                onClick={handlePrint}
                variant="success"
                size="default"
                className="flex-1 h-11 text-base font-semibold"
              >
                <Printer className="w-5 h-5 mr-2" />
                Print Bill
              </Button>
              <Button
                onClick={onBack}
                variant="outline"
                size="default"
                className="h-11 px-6"
              >
                Edit Bill
              </Button>
            </div>

            {/* Bill Content */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 print:p-4 print:border-0">
              {/* Company Header */}
              <div className="text-center mb-6 print:mb-4">
                <h2 className="text-2xl font-bold mb-1">BHAVYA ENTERPRICE</h2>
                <p className="text-sm text-gray-600">Sales Invoice</p>
              </div>

              {/* Shop Details */}
              <div className="border-t border-b py-4 mb-6 print:mb-4">
                <p className="font-semibold text-base mb-1">
                  Shop: {bill.shopName}
                </p>
                {bill.shopAddress && (
                  <p className="text-sm text-gray-600">
                    Address: {bill.shopAddress}
                  </p>
                )}
                {bill.shopPhone && (
                  <p className="text-sm text-gray-600">
                    Phone: {bill.shopPhone}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Route: {bill.routeName}
                </p>
                <p className="text-sm text-gray-600">
                  Date:{" "}
                  {new Date(bill.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Items Table */}
              <div className="mb-6 print:mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-semibold">Item</th>
                      <th className="text-center py-2 font-semibold">Qty</th>
                      <th className="text-right py-2 font-semibold">Rate</th>
                      <th className="text-right py-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{item.productName}</td>
                        <td className="text-center py-2">
                          {item.boxQty > 0 && `${item.boxQty} Box`}
                          {item.boxQty > 0 && item.pcsQty > 0 && ", "}
                          {item.pcsQty > 0 && `${item.pcsQty} pcs`}
                        </td>
                        <td className="text-right py-2">
                          ₹{item.rate.toFixed(2)}
                        </td>
                        <td className="text-right py-2 font-semibold">
                          ₹{item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">
                    TOTAL:
                  </span>
                  <span className="text-2xl font-bold text-success-green-dark">
                    ₹{bill.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          body > *:not(main) { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:p-4 { padding: 1rem !important; }
          .print\\:mb-4 { margin-bottom: 1rem !important; }
        }
      `}</style>
    </div>
  );
};

export default BillPreview;
