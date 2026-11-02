import { useState } from 'react';
import { Button, Select, Input } from '../components';
import { useAuth } from '../context/AuthContext';
import { BarChart3, TrendingUp, Package, DollarSign, Download, Calendar } from 'lucide-react';

export default function Reports() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission('analytics:read');

  const [dateRange, setDateRange] = useState('30');
  const [reportType, setReportType] = useState('overview');

  if (!canRead) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500">View business insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Date Range"
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: '365', label: 'Last year' },
            ]}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          />
          <Select
            label="Report Type"
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'sales', label: 'Sales Report' },
              { value: 'inventory', label: 'Inventory Report' },
              { value: 'suppliers', label: 'Supplier Report' },
            ]}
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          />
          <Input
            label="Custom Date Range"
            type="date"
            placeholder="Select date"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">$45,231</p>
              <p className="text-sm text-green-600 mt-1">+12.5% from last period</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">1,234</p>
              <p className="text-sm text-green-600 mt-1">+8.2% from last period</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Products Sold</p>
              <p className="text-2xl font-bold text-gray-900">5,678</p>
              <p className="text-sm text-green-600 mt-1">+15.3% from last period</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Order Value</p>
              <p className="text-2xl font-bold text-gray-900">$36.67</p>
              <p className="text-sm text-red-600 mt-1">-2.1% from last period</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h2>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <p>Chart visualization would be rendered here</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          <div className="space-y-4">
            {[
              { name: 'Product A', sales: 234, revenue: 5678 },
              { name: 'Product B', sales: 189, revenue: 4321 },
              { name: 'Product C', sales: 156, revenue: 3890 },
              { name: 'Product D', sales: 134, revenue: 3210 },
              { name: 'Product E', sales: 98, revenue: 2345 },
            ].map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-sm text-gray-500">{product.sales} units sold</p>
                </div>
                <p className="font-semibold text-gray-900">${product.revenue.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Report Table */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Detailed Report</h2>
          <Button variant="ghost" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Report
          </Button>
        </div>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-400">Detailed report table would be rendered here</p>
        </div>
      </div>
    </div>
  );
}
