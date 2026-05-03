import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Vehicle, InsertVehicle, Employee, InsertEmployee, Container, InsertContainer, Loan, InsertLoan, LoanPayment, InsertLoanPayment, Customer, InsertCustomer } from "@shared/schema";

// Vehicles
export function useVehicles() {
  return useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
}

export function useCreateVehicle() {
  return useMutation({
    mutationFn: (data: InsertVehicle) => apiRequest("POST", "/api/vehicles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
  });
}

export function useUpdateVehicle() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertVehicle>) =>
      apiRequest("PUT", `/api/vehicles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
  });
}

export function useDeleteVehicle() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
  });
}

// Employees
export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
}

export function useCreateEmployee() {
  return useMutation({
    mutationFn: (data: InsertEmployee) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });
}

export function useUpdateEmployee() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertEmployee>) =>
      apiRequest("PUT", `/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });
}

export function useDeleteEmployee() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });
}

// Containers
export function useContainers() {
  return useQuery<Container[]>({
    queryKey: ["/api/containers"],
  });
}

export function useCreateContainer() {
  return useMutation({
    mutationFn: (data: InsertContainer) => apiRequest("POST", "/api/containers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
    },
  });
}

export function useUpdateContainer() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertContainer>) =>
      apiRequest("PUT", `/api/containers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
    },
  });
}

export function useDeleteContainer() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/containers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
    },
  });
}

// Loans (Darlehen)
export function useLoans() {
  return useQuery<Loan[]>({
    queryKey: ["/api/loans"],
  });
}

export function useCreateLoan() {
  return useMutation({
    mutationFn: (data: InsertLoan) => apiRequest("POST", "/api/loans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
    },
  });
}

export function useUpdateLoan() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertLoan>) =>
      apiRequest("PUT", `/api/loans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
    },
  });
}

export function useDeleteLoan() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/loans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
    },
  });
}

// Loan Payments (Darlehen-Zahlungen)
export function useLoanPayments(loanId: number) {
  return useQuery<LoanPayment[]>({
    queryKey: ["/api/loans", loanId, "payments"],
    queryFn: () => fetch(`/api/loans/${loanId}/payments`).then(res => res.json()),
    enabled: !!loanId,
  });
}

export function useAllLoanPayments() {
  return useQuery<LoanPayment[]>({
    queryKey: ["/api/loan-payments"],
  });
}

export function useCreateLoanPayment() {
  return useMutation({
    mutationFn: (data: InsertLoanPayment) => apiRequest("POST", "/api/loan-payments", data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans", variables.loanId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-payments"] });
    },
  });
}

export function useUpdateLoanPayment() {
  return useMutation({
    mutationFn: ({ id, loanId, ...data }: { id: number; loanId?: number } & Partial<InsertLoanPayment>) =>
      apiRequest("PUT", `/api/loan-payments/${id}`, { ...data, loanId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-payments"] });
      if (variables.loanId) {
        queryClient.invalidateQueries({ queryKey: ["/api/loans", variables.loanId, "payments"] });
      }
    },
  });
}

export function useDeleteLoanPayment() {
  return useMutation({
    mutationFn: ({ id, loanId }: { id: number; loanId?: number }) => 
      apiRequest("DELETE", `/api/loan-payments/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-payments"] });
      if (variables.loanId) {
        queryClient.invalidateQueries({ queryKey: ["/api/loans", variables.loanId, "payments"] });
      }
    },
  });
}

// Customers (Kunden)
export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
}

export function useCreateCustomer() {
  return useMutation({
    mutationFn: (data: InsertCustomer) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
  });
}

export function useUpdateCustomer() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertCustomer>) =>
      apiRequest("PUT", `/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
  });
}

export function useDeleteCustomer() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
  });
}
