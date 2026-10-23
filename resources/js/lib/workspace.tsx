import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { type WorkspaceData, type WorkspaceProps } from './types';
import { todayInZone } from './time';
import { request } from './http';
import { assertMutation, normalizeWorkspaceData } from './contracts';
export { ActionError, csrfHeaders, request, requestFile } from './http';

type Context = {
  period: string;
  setPeriod: (value: string) => void;
  data: WorkspaceData;
  permissions: string[];
  personUuid?: string;
  run: (action: string, payload: unknown) => Promise<WorkspaceData>;
  notify: (message: string, kind?: 'success' | 'error') => void;
  plantUuid: string;
  timeZone: string;
  addImport: (batch: WorkspaceData['imports'][number]) => void;
  filters: Record<string, string>;
  filter: (changes: Record<string, string | number | undefined>) => void;
};
const WorkspaceContext = createContext<Context>(null!);
export const useWorkspace = () => useContext(WorkspaceContext);
export function useServerSearch() {
  const { filters, filter } = useWorkspace();
  const [search, setSearch] = useState(filters.q ?? '');
  useEffect(() => setSearch(filters.q ?? ''), [filters.q]);
  useEffect(() => {
    if (search === (filters.q ?? '')) return;
    const timer = setTimeout(
      () =>
        filter({
          q: search,
          reports_page: 1,
          equipment_page: 1,
          people_page: 1,
          locations_page: 1,
          orders_page: 1,
          breakdowns_page: 1,
          assignments_page: 1,
          plans_page: 1,
          fuel_page: 1,
          imports_page: 1,
        }),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, filters.q]);
  return [search, setSearch] as const;
}
export function useUnsavedChanges(value: unknown, busy: boolean, enabled = true) {
  const [initial] = useState(() => JSON.stringify(value));
  const dirty = enabled && JSON.stringify(value) !== initial;
  const confirm = () =>
    !busy &&
    (!dirty || window.confirm('Tinggalkan formulir? Perubahan yang belum disimpan akan hilang.'));
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    const stop = router.on('before', (event) => {
      if (!confirm()) event.preventDefault();
    });
    return () => {
      window.removeEventListener('beforeunload', unload);
      stop();
    };
  }, [dirty, busy]);
  return confirm;
}
export function WorkspaceProvider({
  props,
  children,
  onNotify,
}: {
  props: WorkspaceProps;
  children: ReactNode;
  onNotify: Context['notify'];
}) {
  const [data, setData] = useState<WorkspaceData>(props.snapshot);
  useEffect(() => setData(props.snapshot), [props.snapshot]);
  const filters = props.filters ?? {};
  const filter = (changes: Record<string, string | number | undefined>) => {
    router.get(
      `/app/${props.page}`,
      { ...filters, plant: props.plant?.uuid, ...changes },
      { preserveState: true, preserveScroll: true, replace: true },
    );
  };
  async function run(action: string, payload: unknown) {
    const query = new URLSearchParams(filters).toString();
    const next = normalizeWorkspaceData(
      await request<WorkspaceData>(`/workspace/actions/${action}?${query}`, {
        ...(payload as object),
        plant_uuid: props.plant?.uuid,
        context_page: props.page,
      }),
    );
    assertMutation(next, payload);
    setData(next);
    return next;
  }
  return (
    <WorkspaceContext.Provider
      value={{
        period: filters.period ?? todayInZone(props.plant?.timezone ?? '').slice(0, 7),
        setPeriod: (period) =>
          filter({
            period,
            reports_page: 1,
            assignments_page: 1,
            plans_page: 1,
            orders_page: 1,
            breakdowns_page: 1,
            fuel_page: 1,
            imports_page: 1,
          }),
        data,
        permissions: props.permissions ?? [],
        personUuid: props.auth?.person_uuid ?? undefined,
        run,
        notify: onNotify,
        plantUuid: props.plant?.uuid ?? '',
        timeZone: props.plant?.timezone ?? '',
        filters,
        filter,
        addImport: (batch) =>
          setData((current) => ({
            ...current,
            imports: [batch, ...current.imports.filter((b) => b.uuid !== batch.uuid)],
          })),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
