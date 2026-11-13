# Control de Gastos (web)

Versión web de la app Android **ControlGastos**, pensada para usarse en el iPhone como aplicación
instalada (PWA). Funciona sin conexión y guarda los datos en el propio dispositivo.

## Funciones

- Registro de **gastos** e **ingresos** en efectivo o débito.
- Compras con **tarjeta de crédito** y **abonos** a la tarjeta (la deuda se calcula con todo el historial).
- **Categorías** de gasto e ingreso, con color y favoritas.
- **Presupuesto mensual** con alerta al acercarse o superar el límite.
- Gráfica de gastos por categoría.
- **Ajustes**: tema claro/oscuro/sistema, moneda, periodo predeterminado y orden de movimientos.
- **Exportar CSV** compatible con la app Android, vista previa y descarga.
- **Respaldo completo en JSON** para cambiar de dispositivo o no perder los datos.
- Instalable en la pantalla de inicio y utilizable **sin conexión**.

## Requisitos

Solo un navegador moderno. Para publicarla no hace falta servidor ni base de datos: son archivos
estáticos.

## Probar en la computadora

Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000>. El service worker y la instalación PWA necesitan `localhost` o HTTPS;
si abres `index.html` directamente con `file://`, la app funciona pero no se instala ni cachea.

## Publicar en GitHub Pages (gratis)

1. Crea un repositorio en GitHub, por ejemplo `control-gastos`.
2. Sube el contenido de esta carpeta (no la carpeta contenedora) a la rama `main`:

   ```bash
   cd ControlGastosWeb
   git init
   git add .
   git commit -m "Control de Gastos web"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/control-gastos.git
   git push -u origin main
   ```

3. En GitHub entra a **Settings → Pages**.
4. En **Build and deployment → Source** elige **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`. Guarda.
6. En uno o dos minutos la app estará en:

   ```text
   https://TU_USUARIO.github.io/control-gastos/
   ```

El archivo `.nojekyll` ya está incluido para que GitHub Pages sirva todos los archivos tal cual.
El repositorio solo contiene el código: **los movimientos y el presupuesto nunca se suben**, se
guardan en el navegador de cada dispositivo.

## Instalar en el iPhone

1. Abre la URL de GitHub Pages en **Safari** (tiene que ser Safari, no Chrome).
2. Toca el botón **Compartir** (cuadrado con flecha hacia arriba).
3. Elige **Añadir a pantalla de inicio**.
4. Confirma el nombre y toca **Añadir**.

Se abrirá como una app a pantalla completa. La primera visita necesita internet para guardar los
archivos; después funciona sin conexión.

> En iPhone los datos quedan en ese dispositivo y en ese navegador. No se sincronizan entre
> dispositivos. Para pasarlos o hacer una copia usa **Ajustes → Archivos → Respaldo completo** y
> guarda el JSON en iCloud Drive o Archivos.

## Pasar los datos desde la app Android

1. En la app Android abre el menú y elige **Exportar CSV**.
2. Guarda o comparte el archivo (por ejemplo, en Archivos o iCloud Drive).
3. En la web entra a **Ajustes → Archivos → Importar desde la app Android**.
4. Selecciona el CSV y elige:
   - **Agregar**: suma los movimientos a los que ya tengas.
   - **Reemplazar movimientos**: borra los actuales y carga solo los del CSV (categorías y
     presupuestos se conservan).
5. Revisa el aviso con el número de importados y omitidos.

El formato aceptado es el de la app Android:

```text
Fecha,Tipo,Categoría,Forma de pago,Nota,Monto
2026-11-10,Gasto,Alimentación,Efectivo o débito,Súper,125.50
2026-11-11,Ingreso,Salario,Efectivo o débito,Quincena,900
2026-11-11,Gasto,Transporte,Tarjeta de crédito,Gasolina,300
```

También se aceptan archivos separados por punto y coma y encabezados con nombres equivalentes
(`Descripción`, `Importe`, `Medio de pago`, etc.).

## Respaldos

- **Descargar respaldo JSON**: guarda movimientos, categorías, presupuestos y archivos generados.
- **Restaurar respaldo**: reemplaza todos los datos actuales por los del archivo.

Haz un respaldo antes de borrar datos del navegador, cambiar de teléfono o reinstalar la app. Si
borras los datos de Safari, la información local se pierde.

## Estructura

```text
ControlGastosWeb/
├── index.html            Estructura de la app
├── css/styles.css        Estilos claro/oscuro y diseño móvil
├── js/formato.js         Formatos de moneda, fechas y montos
├── js/datos.js           Almacenamiento local, CSV y respaldos
├── js/app.js             Vistas, rutas, formularios y eventos
├── manifest.json         Configuración de la PWA
├── sw.js                 Service worker (uso sin conexión)
├── icons/                Iconos para iPhone, Android y escritorio
├── .nojekyll             Evita el procesado de Jekyll en GitHub Pages
└── README.md
```

## Notas

- Los datos se guardan en `localStorage` bajo la clave `controlgastos.db.v1`.
- Las rutas usan `#/...`, así que GitHub Pages no necesita reglas de reescritura.
- La app Android original no se modifica; esta carpeta es un proyecto independiente.
