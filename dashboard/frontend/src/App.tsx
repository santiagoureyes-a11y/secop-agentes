import { useState } from "react";
import { useProcesos } from "./features/procesos/hooks/useProcesos";
import { ProcesosTable } from "./features/procesos/components/ProcesosTable";
import { ProcesoDetail } from "./features/procesos/components/ProcesoDetail";

function App() {
  const { data: procesos, isLoading, error } = useProcesos();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">Procesos SECOP II</h1>
        <p className="text-sm text-zinc-500">
          Detectados por el Agente Scout — aprueba, cotiza y da seguimiento al estado de cada uno.
        </p>
      </header>

      {isLoading && <p className="text-zinc-400">Cargando procesos...</p>}
      {error && <p className="text-red-600">No se pudo conectar con la API.</p>}

      {procesos && <ProcesosTable procesos={procesos} onSeleccionar={setSeleccionado} />}

      {seleccionado && <ProcesoDetail id={seleccionado} onCerrar={() => setSeleccionado(null)} />}
    </div>
  );
}

export default App;
