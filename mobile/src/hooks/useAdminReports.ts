import { useCallback } from 'react';
import api from '@/lib/api';
import type {
  ReportFilters,
  VisitorReportRow,
  StaffVisitReportRow,
  SosReportRow,
} from '@/types';
import { objectsToCsv, downloadCsv } from '@/utils/csvExport';

// ---------------------------------------------------------------------------
// useAdminReports
// ---------------------------------------------------------------------------

export function useAdminReports() {
  const fetchVisitorReport = useCallback(
    async (
      filters: ReportFilters
    ): Promise<{ visitors: VisitorReportRow[]; total: number }> => {
      const params = buildParams(filters);
      const { data } = await api.get<{ visitors: VisitorReportRow[]; total: number }>(
        '/admin/reports/visitors',
        { params }
      );
      return { visitors: data.visitors ?? [], total: data.total ?? 0 };
    },
    []
  );

  const fetchStaffReport = useCallback(
    async (
      filters: ReportFilters
    ): Promise<{ visits: StaffVisitReportRow[]; total: number }> => {
      const params = buildParams(filters);
      const { data } = await api.get<{ visits: StaffVisitReportRow[]; total: number }>(
        '/admin/reports/staff',
        { params }
      );
      return { visits: data.visits ?? [], total: data.total ?? 0 };
    },
    []
  );

  const fetchSosReport = useCallback(
    async (
      filters: ReportFilters
    ): Promise<{ alerts: SosReportRow[]; total: number }> => {
      const params = buildParams(filters);
      const { data } = await api.get<{ alerts: SosReportRow[]; total: number }>(
        '/admin/reports/sos',
        { params }
      );
      return { alerts: data.alerts ?? [], total: data.total ?? 0 };
    },
    []
  );

  const exportToCsv = useCallback(
    async (data: object[], filename: string): Promise<void> => {
      const csv = objectsToCsv(data as Record<string, unknown>[]);
      await downloadCsv(csv, filename);
    },
    []
  );

  return {
    fetchVisitorReport,
    fetchStaffReport,
    fetchSosReport,
    exportToCsv,
  };
}

// ---------------------------------------------------------------------------
// Helper: build query params from filters (omit undefined/null values)
// ---------------------------------------------------------------------------

function buildParams(filters: ReportFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.fromDate) params['fromDate'] = filters.fromDate;
  if (filters.toDate) params['toDate'] = filters.toDate;
  if (filters.buildingId) params['buildingId'] = filters.buildingId;
  if (filters.guardId) params['guardId'] = filters.guardId;
  if (filters.flatId) params['flatId'] = filters.flatId;
  if (filters.staffCategory) params['staffCategory'] = filters.staffCategory;
  if (filters.status) params['status'] = filters.status;
  if (filters.page !== undefined) params['page'] = filters.page;
  if (filters.limit !== undefined) params['limit'] = filters.limit;
  return params;
}
