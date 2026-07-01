# Fórmula de cotización — Interventoría (factor multiplicador)

Transcrito y limpiado de `FACTOR MULTIPLICADOR - Oferta Económica.csv` (compartido por el usuario,
2026-06-27). Esta es la metodología real que usa Verde Ecológico para calcular cuánto cotizar en procesos
de interventoría — el Agente Financiero debe replicar esta lógica, no inventar una propia.

## Estructura del cálculo

### 1. Personal profesional (Administración)
Por cada rol: `cantidad × sueldo básico mensual con prestaciones × % de dedicación × meses de duración`

Ejemplo de roles típicos: Director de interventoría (ingeniero civil o arquitecto), interventor(es)
residente(s) junior, profesional con licencia SST. Suma = **Total costos personal profesional**.

### 2. Prestaciones sociales
Valor global (GLB) calculado sobre el personal profesional, multiplicado por la duración en meses.

### 3. Costos de perfeccionamiento (impuestos y pólizas)
Valor global fijo para el contrato.

### 4. Otros costos administrativos directos
Lista de ítems C1 a C8: arriendo de oficina/servicios públicos, papelería, equipos y mantenimiento de
oficina, dotación y EPP, transporte, asesoría legal/tributaria, asesoría ambiental, asesorías técnicas.
Cada uno con su valor unitario × duración en meses.

### 5. Subtotal de costos directos
Suma de las categorías anteriores.

### 6. Utilidad e imprevistos
Se aplican como porcentajes sobre el subtotal de costos directos.

**Confirmado (2026-06-27): el % de utilidad e imprevistos NO es un valor fijo** — varía según el proceso
(la plantilla trae 3%/1% como ejemplo de un caso puntual, no como constante de negocio). El Agente
Financiero debe recibir estos porcentajes como **parámetro de entrada por proceso** (con un valor sugerido
por defecto, pero editable), no hardcodearlos en el código.

### 7. IVA
19% sobre (costos directos + utilidad + imprevistos).

### 8. Costo total de la interventoría
`Costos directos + Utilidad + Imprevistos + IVA` = valor final a cotizar en la oferta económica.

## Regla de negocio ya confirmada (no viene en esta plantilla, pero aplica al resultado final)
El valor final a cotizar no debe superar un **18% de descuento sobre el presupuesto oficial** del proceso
(ver `CLAUDE.md` sección 5) — el Agente Financiero debe validar que el resultado de esta fórmula quede
dentro de ese límite antes de recomendarlo.
