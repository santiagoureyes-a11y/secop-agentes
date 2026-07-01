import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as procesosApi from "../api";
import type { EstadoProceso } from "../../../types/proceso";

const PROCESOS_KEY = ["procesos"];

export function useProcesos() {
  return useQuery({ queryKey: PROCESOS_KEY, queryFn: procesosApi.listarProcesos });
}

export function useProceso(id: string | null) {
  return useQuery({
    queryKey: [...PROCESOS_KEY, id],
    queryFn: () => procesosApi.obtenerProceso(id!),
    enabled: Boolean(id),
  });
}

export function useArchivosDescargados(id: string | null) {
  return useQuery({
    queryKey: [...PROCESOS_KEY, id, "archivos"],
    queryFn: () => procesosApi.listarArchivosDescargados(id!),
    enabled: Boolean(id),
  });
}

export function useActualizarEstado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoProceso }) =>
      procesosApi.actualizarEstadoProceso(id, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROCESOS_KEY }),
  });
}
