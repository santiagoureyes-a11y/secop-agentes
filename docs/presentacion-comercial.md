# Agentes para procesos de contratación pública (SECOP II)

## El problema

Participar en SECOP II hoy es manual y lento:
- Alguien tiene que revisar uno por uno los procesos publicados para ver cuáles aplican.
- Decidir cuánto cotizar se hace "a ojo" o con experiencia, sin un análisis sistemático del histórico de adjudicaciones.
- Armar los documentos de cada propuesta (carta de presentación, oferta económica, anexos) se repite manualmente proceso tras proceso.
- No hay un solo lugar donde ver en qué va cada proceso, cuándo cierra, y qué pasó al final.

Esto le cuesta tiempo a la persona que hoy lo hace y hace que se alcancen a revisar menos oportunidades de las que realmente existen.

## La solución: 3 agentes + 1 tablero de control

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   AGENTE     │ --> │   AGENTE     │ --> │   AGENTE     │ --> │   TABLERO     │
│   SCOUT      │     │  FINANCIERO  │     │  DOCUMENTAL  │     │  DE CONTROL   │
│ (busca)      │     │ (cotiza)     │     │ (redacta)    │     │ (da seguimiento)│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 1. Agente Scout — encuentra las oportunidades
Revisa automáticamente los procesos publicados en SECOP II y filtra solo los que de verdad le interesan a la empresa: por tipo de servicio/producto, ubicación y rango de presupuesto. En vez de revisar todo manualmente, la persona solo ve una lista corta y priorizada de procesos que valen la pena.

### 2. Agente Financiero — recomienda cuánto cotizar
Para cada proceso que interesa, mira cuánto se ha pagado en procesos similares en el pasado (entidades, montos, modalidades) y recomienda un valor a cotizar que busca el mejor balance entre **ganar el proceso** y **tener buen margen**. También avisa si el precio sugerido es riesgoso (muy bajo para ser sostenible, o poco competitivo).

### 3. Agente Documental — prepara los papeles
Con los documentos básicos de la empresa ya cargados una sola vez (RUT, Cámara de Comercio, RUP, certificaciones), este agente arma la carta de presentación, la oferta económica y los anexos que pida cada proceso específico — dejando todo listo para revisar y radicar.

### 4. Tablero de control — para no perder de vista nada
Una sola pantalla donde se ve cada proceso, en qué etapa está, cuánto se cotizó, y las fechas importantes (cierre, audiencia, adjudicación, vencimiento de garantías). Así nunca se pierde una fecha límite ni se pierde el hilo de qué pasó con cada propuesta enviada.

## Un detalle importante: el control siempre lo tiene la persona

SECOP II pide verificación de seguridad (como cuando un sitio te pide "no soy un robot") antes de mostrar el detalle completo de un proceso, y de nuevo antes de enviar una oferta. Esto es intencional por parte del Estado, así que el sistema **no intenta saltárselo** — sería arriesgar la cuenta de la empresa.

En la práctica esto significa:
- Los agentes hacen todo el trabajo pesado (buscar, analizar, calcular precio, armar documentos) **antes** de que alguien tenga que entrar a la plataforma.
- La persona solo entra a SECOP II en dos momentos puntuales: para confirmar la lista de procesos encontrados, y para dar clic final de "enviar" cuando todo ya está listo.
- Nada se envía ni se compromete sin que un humano lo apruebe primero — hay dos puntos de aprobación explícitos en el tablero antes de cotizar y antes de radicar.

Esto no es una limitación del producto: es justamente lo que hace que sea seguro de usar y vender, porque la empresa nunca pierde el control sobre una decisión que la compromete legalmente.

## Qué ya existe hoy (no es solo una idea)

- El **Agente Scout** ya está construido y probado contra los datos reales y públicos de SECOP II.
- El **Tablero de control** ya está construido y funcionando, con ejemplos reales de procesos, mostrando los distintos estados (por revisar, cotizado, listo para radicar, adjudicado, rechazado) y los botones de aprobación.
- Faltan por calibrar con los datos reales de cada empresa: el Agente Financiero (reglas de margen propias) y el Agente Documental (plantillas con los documentos legales de la empresa).

## Por qué esto es un producto, no un proyecto de una sola vez

El sistema está diseñado en dos partes desde el principio:
- Lo que es **genérico**: el motor de búsqueda, el cálculo financiero, el tablero — funciona igual para cualquier empresa que participe en SECOP II.
- Lo que es **específico de cada cliente**: su perfil (qué tipo de procesos le interesan), sus documentos legales, sus reglas de margen.

Eso significa que una vez funciona bien para una empresa, se puede ofrecer a otras empresas del mismo sector con un trabajo de configuración mucho menor que construirlo desde cero.
