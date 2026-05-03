import { z } from 'zod';
import { 
  insertMaterialSchema, insertCostVariableSchema, insertPlanningSettingsSchema, insertQuoteSchema,
  insertVehicleSchema, insertEmployeeSchema, insertContainerSchema, insertTripSchema, insertLoanSchema, insertLoanPaymentSchema, insertCustomerSchema,
  insertSalesPriceSchema, insertSalesFixedPriceSchema,
  materials, costVariables, planningSettings, quotes, vehicles, employees, containers, trips, loans, loanPayments, customers, salesPrices, salesFixedPrices
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  vehicles: {
    list: {
      method: 'GET' as const,
      path: '/api/vehicles',
      responses: { 200: z.array(z.custom<typeof vehicles.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vehicles',
      input: insertVehicleSchema,
      responses: { 201: z.custom<typeof vehicles.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/vehicles/:id',
      input: insertVehicleSchema.partial(),
      responses: { 200: z.custom<typeof vehicles.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/vehicles/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees',
      responses: { 200: z.array(z.custom<typeof employees.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees',
      input: insertEmployeeSchema,
      responses: { 201: z.custom<typeof employees.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employees/:id',
      input: insertEmployeeSchema.partial(),
      responses: { 200: z.custom<typeof employees.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/employees/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  containers: {
    list: {
      method: 'GET' as const,
      path: '/api/containers',
      responses: { 200: z.array(z.custom<typeof containers.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/containers',
      input: insertContainerSchema,
      responses: { 201: z.custom<typeof containers.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/containers/:id',
      input: insertContainerSchema.partial(),
      responses: { 200: z.custom<typeof containers.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/containers/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  materials: {
    list: {
      method: 'GET' as const,
      path: '/api/materials',
      responses: { 200: z.array(z.custom<typeof materials.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/materials',
      input: insertMaterialSchema,
      responses: { 201: z.custom<typeof materials.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/materials/:id',
      input: insertMaterialSchema.partial(),
      responses: { 200: z.custom<typeof materials.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/materials/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  costVariables: {
    list: {
      method: 'GET' as const,
      path: '/api/cost-variables',
      responses: { 200: z.array(z.custom<typeof costVariables.$inferSelect>()) },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/cost-variables/:id',
      input: insertCostVariableSchema.partial(),
      responses: { 200: z.custom<typeof costVariables.$inferSelect>(), 404: errorSchemas.notFound },
    },
    create: {
      method: 'POST' as const,
      path: '/api/cost-variables',
      input: insertCostVariableSchema,
      responses: { 201: z.custom<typeof costVariables.$inferSelect>(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/cost-variables/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  settings: {
    get: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: { 200: z.custom<typeof planningSettings.$inferSelect>() },
    },
    update: {
      method: 'POST' as const,
      path: '/api/settings',
      input: insertPlanningSettingsSchema.partial(),
      responses: { 200: z.custom<typeof planningSettings.$inferSelect>() },
    },
  },
  quotes: {
    list: {
      method: 'GET' as const,
      path: '/api/quotes',
      responses: { 200: z.array(z.custom<typeof quotes.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/quotes',
      input: insertQuoteSchema,
      responses: { 201: z.custom<typeof quotes.$inferSelect>(), 400: errorSchemas.validation },
    },
  },
  trips: {
    list: {
      method: 'GET' as const,
      path: '/api/trips',
      responses: { 200: z.array(z.custom<typeof trips.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/trips',
      input: insertTripSchema,
      responses: { 201: z.custom<typeof trips.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/trips/:id',
      input: insertTripSchema.partial(),
      responses: { 200: z.custom<typeof trips.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/trips/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  loans: {
    list: {
      method: 'GET' as const,
      path: '/api/loans',
      responses: { 200: z.array(z.custom<typeof loans.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/loans',
      input: insertLoanSchema,
      responses: { 201: z.custom<typeof loans.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/loans/:id',
      input: insertLoanSchema.partial(),
      responses: { 200: z.custom<typeof loans.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/loans/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  loanPayments: {
    list: {
      method: 'GET' as const,
      path: '/api/loans/:loanId/payments',
      responses: { 200: z.array(z.custom<typeof loanPayments.$inferSelect>()) },
    },
    listAll: {
      method: 'GET' as const,
      path: '/api/loan-payments',
      responses: { 200: z.array(z.custom<typeof loanPayments.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/loan-payments',
      input: insertLoanPaymentSchema,
      responses: { 201: z.custom<typeof loanPayments.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/loan-payments/:id',
      input: insertLoanPaymentSchema.partial(),
      responses: { 200: z.custom<typeof loanPayments.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/loan-payments/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  customers: {
    list: {
      method: 'GET' as const,
      path: '/api/customers',
      responses: { 200: z.array(z.custom<typeof customers.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/customers',
      input: insertCustomerSchema,
      responses: { 201: z.custom<typeof customers.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/customers/:id',
      input: insertCustomerSchema.partial(),
      responses: { 200: z.custom<typeof customers.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/customers/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  salesPrices: {
    list: {
      method: 'GET' as const,
      path: '/api/sales-prices',
      responses: { 200: z.array(z.custom<typeof salesPrices.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sales-prices',
      input: insertSalesPriceSchema,
      responses: { 201: z.custom<typeof salesPrices.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/sales-prices/:id',
      input: insertSalesPriceSchema.partial(),
      responses: { 200: z.custom<typeof salesPrices.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sales-prices/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  salesFixedPrices: {
    list: {
      method: 'GET' as const,
      path: '/api/sales-fixed-prices',
      responses: { 200: z.array(z.custom<typeof salesFixedPrices.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sales-fixed-prices',
      input: insertSalesFixedPriceSchema,
      responses: { 201: z.custom<typeof salesFixedPrices.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/sales-fixed-prices/:id',
      input: insertSalesFixedPriceSchema.partial(),
      responses: { 200: z.custom<typeof salesFixedPrices.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sales-fixed-prices/:id',
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
