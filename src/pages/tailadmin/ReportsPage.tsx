import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DailySummary } from './reports/DailySummary';
import { RouteSummary } from './reports/RouteSummary';
import { DriverSummary } from './reports/DriverSummary';
import { ProductSummary } from './reports/ProductSummary';
import { SalesReport } from './reports/SalesReport';

export const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState<string>('daily');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">View and analyze business reports</p>
      </div>
      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="daily">Daily Summary</TabsTrigger>
            <TabsTrigger value="route">Route Summary</TabsTrigger>
            <TabsTrigger value="driver">Driver Summary</TabsTrigger>
            <TabsTrigger value="product">Product Summary</TabsTrigger>
            <TabsTrigger value="sales">Sales Report</TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><DailySummary /></TabsContent>
          <TabsContent value="route"><RouteSummary /></TabsContent>
          <TabsContent value="driver"><DriverSummary /></TabsContent>
          <TabsContent value="product"><ProductSummary /></TabsContent>
          <TabsContent value="sales"><SalesReport /></TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
