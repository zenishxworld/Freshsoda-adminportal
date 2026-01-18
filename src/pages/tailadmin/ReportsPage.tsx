import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DailySummary } from './reports/DailySummary';
import { RouteSummary } from './reports/RouteSummary';
import { ProductSummary } from './reports/ProductSummary';
import { SalesReport } from './reports/SalesReport';
import { DiscountedSales } from './reports/DiscountedSales';

export const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState<string>('daily');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">View and analyze business reports</p>
      </div>
      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full gap-1 bg-gray-100 p-1">
            <TabsTrigger
              value="daily"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              Daily Summary
            </TabsTrigger>
            <TabsTrigger
              value="route"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              Route Summary
            </TabsTrigger>
            <TabsTrigger
              value="product"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              Product Summary
            </TabsTrigger>
            <TabsTrigger
              value="sales"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              Sales Report
            </TabsTrigger>
            <TabsTrigger
              value="discounts"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              Discounted Sales
            </TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><DailySummary /></TabsContent>
          <TabsContent value="route"><RouteSummary /></TabsContent>
          <TabsContent value="product"><ProductSummary /></TabsContent>
          <TabsContent value="sales"><SalesReport /></TabsContent>
          <TabsContent value="discounts"><DiscountedSales /></TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
