/* ==========================================================================
   Capa de datos.
   Sustituye a SQLite + SharedPreferences de la app Android.
   Guarda todo en localStorage como un único documento JSON versionado.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var CLAVE = 'controlgastos.v1';
  var VERSION = 1;

  // Mismos colores que la app Android (CategoriasActivity.COLORES).
  var COLORES = [
    '#16A34A', // Verde
    '#2563EB', // Azul
    '#EA580C', // Naranja
    '#DC2626', // Rojo
    '#7C3AED', // Morado
    '#DB2777', // Rosa
    '#CA8A04', // Amarillo
    '#64748B'  // Gris
  ];

  var COLOR_GRIS = '#64748B';

  // Categorías iniciales (BaseDatos.sembrarCategorias).
  var SEMILLAS = [
    { nombre: 'Alimentación', tipo: 'GASTO', color: '#EA580C', favorita: true },
    { nombre: 'Transporte', tipo: 'GASTO', color: '#2563EB', favorita: true },
    { nombre: 'Hogar', tipo: 'GASTO', color: '#7C3AED', favorita: false },
    { nombre: 'Salud', tipo: 'GASTO', color: '#DC2626', favorita: false },
    { nombre: 'Educación', tipo: 'GASTO', color: '#0F766E', favorita: false },
    { nombre: 'Ocio', tipo: 'GASTO', color: '#DB2777', favorita: false },
    { nombre: 'Otros gastos', tipo: 'GASTO', color: '#64748B', favorita: false },
    { nombre: 'Salario', tipo: 'INGRESO', color: '#16A34A', favorita: true },
    { nombre: 'Beca', tipo: 'INGRESO', color: '#2563EB', favorita: true },
    { nombre: 'Ventas', tipo: 'INGRESO', color: '#CA8A04', favorita: false },
    { nombre: 'Otros ingresos', tipo: 'INGRESO', color: '#64748B', favorita: false }
  ];

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function normalizar(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function documentoVacio() {
    return {
      version: VERSION,
      seq: { categoria: 0, movimiento: 0, exportacion: 0 },
      categorias: [],
      movimientos: [],
      presupuestos: [],
      exportaciones: []
    };
  }

  /**
   * Crea el repositorio sobre un almacén con getItem/setItem
   * (localStorage en el navegador, o un doble en las pruebas).
   */
  function crearRepositorio(almacen) {
    var db = null;

    function dbValida(objeto) {
      return objeto && typeof objeto === 'object' &&
        Array.isArray(objeto.categorias) &&
        Array.isArray(objeto.movimientos) &&
        Array.isArray(objeto.presupuestos);
    }

    function sembrar() {
      var nueva = documentoVacio();
      SEMILLAS.forEach(function (semilla) {
        nueva.seq.categoria += 1;
        nueva.categorias.push({
          id: nueva.seq.categoria,
          nombre: semilla.nombre,
          tipo: semilla.tipo,
          color: semilla.color,
          favorita: semilla.favorita
        });
      });
      return nueva;
    }

    function cargar() {
      if (db) return db;
      var crudo = null;
      try {
        crudo = almacen ? almacen.getItem(CLAVE) : null;
      } catch (e) {
        crudo = null;
      }
      if (crudo) {
        try {
          var leido = JSON.parse(crudo);
          if (dbValida(leido)) {
            if (!leido.seq) leido.seq = { categoria: 0, movimiento: 0, exportacion: 0 };
            if (!Array.isArray(leido.exportaciones)) leido.exportaciones = [];
            db = leido;
            recalcularSecuencias();
            return db;
          }
        } catch (e) {
          // Documento corrupto: se reemplaza por uno nuevo con las semillas.
        }
      }
      db = sembrar();
      guardar();
      return db;
    }

    function recalcularSecuencias() {
      function maximo(lista) {
        return lista.reduce(function (max, item) {
          return Math.max(max, Number(item.id) || 0);
        }, 0);
      }
      db.seq.categoria = Math.max(Number(db.seq.categoria) || 0, maximo(db.categorias));
      db.seq.movimiento = Math.max(Number(db.seq.movimiento) || 0, maximo(db.movimientos));
      db.seq.exportacion = Math.max(Number(db.seq.exportacion) || 0,
        maximo(db.exportaciones || []));
    }

    function guardar() {
      if (!db) return;
      try {
        almacen.setItem(CLAVE, JSON.stringify(db));
      } catch (e) {
        var error = new Error('No se pudieron guardar los datos. El almacenamiento del navegador está lleno o bloqueado.');
        error.causa = e;
        throw error;
      }
    }

    function nuevoId(tabla) {
      db.seq[tabla] = (Number(db.seq[tabla]) || 0) + 1;
      return db.seq[tabla];
    }

    // ------------------------------------------------------------------
    // Categorías
    // ------------------------------------------------------------------

    function contarMovimientosCategoria(categoriaId) {
      var id = Number(categoriaId);
      return cargar().movimientos.filter(function (m) {
        return Number(m.categoriaId) === id;
      }).length;
    }

    function obtenerCategorias(tipo) {
      var lista = cargar().categorias.filter(function (c) {
        return !tipo || c.tipo === tipo;
      });
      lista.sort(function (a, b) {
        if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1;
        if (Boolean(a.favorita) !== Boolean(b.favorita)) return a.favorita ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      });
      return clonar(lista);
    }

    function obtenerCategoria(id) {
      var encontrada = cargar().categorias.find(function (c) {
        return Number(c.id) === Number(id);
      });
      return encontrada ? clonar(encontrada) : null;
    }

    function nombreCategoriaRepetido(nombre, tipo, exceptoId) {
      var buscado = normalizar(nombre);
      return cargar().categorias.some(function (c) {
        return normalizar(c.nombre) === buscado && c.tipo === tipo &&
          Number(c.id) !== Number(exceptoId);
      });
    }

    function insertarCategoria(categoria) {
      cargar();
      var tipo = categoria.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO';
      var nombre = String(categoria.nombre || '').trim();
      if (!nombre) return -1;
      if (nombreCategoriaRepetido(nombre, tipo, -1)) return -1;

      var coloresValidos = COLORES.indexOf(categoria.color) !== -1;
      var nueva = {
        id: nuevoId('categoria'),
        nombre: nombre,
        tipo: tipo,
        color: coloresValidos ? categoria.color : COLOR_GRIS,
        favorita: Boolean(categoria.favorita)
      };
      db.categorias.push(nueva);
      guardar();
      return nueva.id;
    }

    function actualizarCategoria(categoria) {
      cargar();
      var existente = db.categorias.find(function (c) {
        return Number(c.id) === Number(categoria.id);
      });
      if (!existente) return 0;

      var tipo = categoria.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO';
      var nombre = String(categoria.nombre || '').trim();
      if (!nombre) return 0;
      if (nombreCategoriaRepetido(nombre, tipo, categoria.id)) return -1;

      existente.nombre = nombre;
      existente.tipo = tipo;
      existente.color = COLORES.indexOf(categoria.color) !== -1 ? categoria.color : COLOR_GRIS;
      existente.favorita = Boolean(categoria.favorita);
      guardar();
      return 1;
    }

    function eliminarCategoria(id) {
      cargar();
      if (contarMovimientosCategoria(id) > 0) return 0;
      var antes = db.categorias.length;
      db.categorias = db.categorias.filter(function (c) {
        return Number(c.id) !== Number(id);
      });
      if (db.categorias.length === antes) return 0;
      guardar();
      return 1;
    }

    // ------------------------------------------------------------------
    // Movimientos
    // ------------------------------------------------------------------

    function normalizarMovimiento(movimiento) {
      var tipo = movimiento.tipo === 'INGRESO' ? 'INGRESO'
        : movimiento.tipo === 'ABONO_TARJETA' ? 'ABONO_TARJETA' : 'GASTO';
      var esGasto = tipo === 'GASTO';
      return {
        tipo: tipo,
        monto: Math.round(Number(movimiento.monto) * 100) / 100,
        categoriaId: tipo === 'ABONO_TARJETA' || !movimiento.categoriaId
          ? null
          : Number(movimiento.categoriaId),
        fecha: String(movimiento.fecha || ''),
        nota: String(movimiento.nota === null || movimiento.nota === undefined
          ? '' : movimiento.nota).trim(),
        medioPago: esGasto && movimiento.medioPago === 'TARJETA' ? 'TARJETA' : 'EFECTIVO'
      };
    }

    function insertarMovimiento(movimiento) {
      cargar();
      var datos = normalizarMovimiento(movimiento);
      if (!(datos.monto > 0) || !datos.fecha) return -1;
      datos.id = nuevoId('movimiento');
      db.movimientos.push(datos);
      guardar();
      return datos.id;
    }

    function actualizarMovimiento(movimiento) {
      cargar();
      var existente = db.movimientos.find(function (m) {
        return Number(m.id) === Number(movimiento.id);
      });
      if (!existente) return 0;
      var datos = normalizarMovimiento(movimiento);
      if (!(datos.monto > 0) || !datos.fecha) return 0;
      existente.tipo = datos.tipo;
      existente.monto = datos.monto;
      existente.categoriaId = datos.categoriaId;
      existente.fecha = datos.fecha;
      existente.nota = datos.nota;
      existente.medioPago = datos.medioPago;
      guardar();
      return 1;
    }

    function eliminarMovimiento(id) {
      cargar();
      var antes = db.movimientos.length;
      db.movimientos = db.movimientos.filter(function (m) {
        return Number(m.id) !== Number(id);
      });
      if (db.movimientos.length === antes) return 0;
      guardar();
      return 1;
    }

    function completarMovimiento(movimiento) {
      var copia = clonar(movimiento);
      var categoria = copia.categoriaId
        ? db.categorias.find(function (c) { return Number(c.id) === Number(copia.categoriaId); })
        : null;
      copia.categoriaNombre = categoria ? categoria.nombre : '';
      copia.categoriaColor = categoria ? categoria.color : 0;
      return copia;
    }

    function obtenerMovimiento(id) {
      cargar();
      var encontrado = db.movimientos.find(function (m) {
        return Number(m.id) === Number(id);
      });
      return encontrado ? completarMovimiento(encontrado) : null;
    }

    function comparar(a, b, ordenMonto) {
      if (ordenMonto) {
        if (b.monto !== a.monto) return b.monto - a.monto;
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return b.id - a.id;
      }
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return b.id - a.id;
    }

    /**
     * Consulta con filtros, equivalente a BaseDatos.obtenerMovimientos.
     */
    function obtenerMovimientos(filtros) {
      cargar();
      var opciones = filtros || {};
      var desde = opciones.desde || '0000-01-01';
      var hasta = opciones.hasta || '9999-12-31';
      var categoriaId = Number(opciones.categoriaId) || -1;
      var tipo = opciones.tipo || null;
      var soloTarjeta = Boolean(opciones.soloTarjeta);
      var ordenMonto = Boolean(opciones.ordenMonto);

      var lista = db.movimientos.filter(function (m) {
        if (m.fecha < desde || m.fecha > hasta) return false;
        if (soloTarjeta) {
          return (m.tipo === 'GASTO' && m.medioPago === 'TARJETA') || m.tipo === 'ABONO_TARJETA';
        }
        if (tipo && m.tipo !== tipo) return false;
        if (categoriaId > 0 && Number(m.categoriaId) !== categoriaId) return false;
        return true;
      });

      lista.sort(function (a, b) { return comparar(a, b, ordenMonto); });
      return lista.map(completarMovimiento);
    }

    function suma(lista) {
      return lista.reduce(function (total, m) { return total + Number(m.monto || 0); }, 0);
    }

    function totalPorTipo(tipo, desde, hasta) {
      cargar();
      return suma(db.movimientos.filter(function (m) {
        return m.tipo === tipo && m.fecha >= desde && m.fecha <= hasta;
      }));
    }

    function totalGastosPorMedio(medio, desde, hasta) {
      cargar();
      return suma(db.movimientos.filter(function (m) {
        return m.tipo === 'GASTO' && m.medioPago === medio &&
          m.fecha >= desde && m.fecha <= hasta;
      }));
    }

    function totalGastosEfectivo(desde, hasta) {
      return totalGastosPorMedio('EFECTIVO', desde, hasta);
    }

    function totalGastosTarjeta(desde, hasta) {
      return totalGastosPorMedio('TARJETA', desde, hasta);
    }

    function totalAbonosTarjeta(desde, hasta) {
      cargar();
      return suma(db.movimientos.filter(function (m) {
        return m.tipo === 'ABONO_TARJETA' && m.fecha >= desde && m.fecha <= hasta;
      }));
    }

    /** Deuda acumulada: compras con tarjeta menos abonos, en todo el historial. */
    function deudaTarjeta() {
      cargar();
      return db.movimientos.reduce(function (total, m) {
        if (m.tipo === 'GASTO' && m.medioPago === 'TARJETA') return total + m.monto;
        if (m.tipo === 'ABONO_TARJETA') return total - m.monto;
        return total;
      }, 0);
    }

    function gastosEfectivoPorCategoria(desde, hasta, limite) {
      cargar();
      var agrupado = {};
      db.movimientos.forEach(function (m) {
        if (m.tipo !== 'GASTO' || m.medioPago !== 'EFECTIVO') return;
        if (m.fecha < desde || m.fecha > hasta) return;
        var id = Number(m.categoriaId) || 0;
        if (!agrupado[id]) agrupado[id] = 0;
        agrupado[id] += m.monto;
      });

      var lista = Object.keys(agrupado).map(function (id) {
        var categoria = db.categorias.find(function (c) {
          return Number(c.id) === Number(id);
        });
        return {
          categoriaId: Number(id),
          nombre: categoria ? categoria.nombre : 'Sin categoría',
          color: categoria ? categoria.color : COLOR_GRIS,
          total: agrupado[id]
        };
      });
      lista.sort(function (a, b) { return b.total - a.total; });
      if (limite > 0) lista = lista.slice(0, limite);
      return lista;
    }

    // ------------------------------------------------------------------
    // Presupuestos
    // ------------------------------------------------------------------

    function obtenerPresupuesto(periodoISO) {
      var encontrado = cargar().presupuestos.find(function (p) {
        return p.periodo === periodoISO;
      });
      return encontrado ? Number(encontrado.monto) : -1;
    }

    function guardarPresupuesto(periodoISO, monto) {
      cargar();
      var valor = Number(monto);
      if (!isFinite(valor) || valor < 0) return false;
      var existente = db.presupuestos.find(function (p) {
        return p.periodo === periodoISO;
      });
      if (existente) {
        existente.monto = valor;
      } else {
        db.presupuestos.push({ periodo: periodoISO, monto: valor });
      }
      guardar();
      return true;
    }

    function eliminarPresupuesto(periodoISO) {
      cargar();
      var antes = db.presupuestos.length;
      db.presupuestos = db.presupuestos.filter(function (p) {
        return p.periodo !== periodoISO;
      });
      if (db.presupuestos.length === antes) return 0;
      guardar();
      return 1;
    }

    // ------------------------------------------------------------------
    // Archivos exportados (historial)
    // ------------------------------------------------------------------

    function listarExportaciones() {
      return clonar(cargar().exportaciones).sort(function (a, b) {
        return b.fecha - a.fecha;
      });
    }

    function obtenerExportacion(id) {
      var encontrada = cargar().exportaciones.find(function (e) {
        return Number(e.id) === Number(id);
      });
      return encontrada ? clonar(encontrada) : null;
    }

    function guardarExportacion(nombre, contenido) {
      cargar();
      var registro = {
        id: nuevoId('exportacion'),
        nombre: nombre,
        fecha: Date.now(),
        bytes: new Blob([contenido]).size,
        contenido: contenido
      };
      db.exportaciones.push(registro);
      // Se conservan las 20 exportaciones más recientes.
      if (db.exportaciones.length > 20) {
        db.exportaciones.sort(function (a, b) { return b.fecha - a.fecha; });
        db.exportaciones = db.exportaciones.slice(0, 20);
      }
      guardar();
      return registro.id;
    }

    function eliminarExportacion(id) {
      cargar();
      var antes = db.exportaciones.length;
      db.exportaciones = db.exportaciones.filter(function (e) {
        return Number(e.id) !== Number(id);
      });
      if (db.exportaciones.length === antes) return 0;
      guardar();
      return 1;
    }

    // ------------------------------------------------------------------
    // Importación / respaldo
    // ------------------------------------------------------------------

    /**
     * Parser CSV con soporte para comillas, comas y saltos de línea internos.
     */
    function parseCSV(texto) {
      var limpio = String(texto || '').replace(/^\uFEFF/, '');

      // Se detecta el separador en la primera línea: punto y coma solo si no hay comas.
      var primeraLinea = limpio.split('\n')[0] || '';
      var delimitador = primeraLinea.indexOf(',') === -1 && primeraLinea.indexOf(';') !== -1
        ? ';'
        : ',';

      var filas = [];
      var fila = [];
      var campo = '';
      var entreComillas = false;

      for (var i = 0; i < limpio.length; i++) {
        var c = limpio[i];
        if (entreComillas) {
          if (c === '"') {
            if (limpio[i + 1] === '"') {
              campo += '"';
              i++;
            } else {
              entreComillas = false;
            }
          } else {
            campo += c;
          }
        } else if (c === '"') {
          entreComillas = true;
        } else if (c === delimitador) {
          fila.push(campo);
          campo = '';
        } else if (c === '\n') {
          fila.push(campo);
          filas.push(fila);
          fila = [];
          campo = '';
        } else if (c === '\r') {
          // Se ignora; el salto real es \n.
        } else {
          campo += c;
        }
      }
      if (campo !== '' || fila.length > 0) {
        fila.push(campo);
        filas.push(fila);
      }
      return filas.filter(function (f) {
        return f.some(function (valor) { return valor.trim() !== ''; });
      });
    }

    function indiceColumna(encabezados, alias) {
      for (var i = 0; i < encabezados.length; i++) {
        var titulo = normalizar(encabezados[i]);
        for (var j = 0; j < alias.length; j++) {
          if (titulo === alias[j]) return i;
        }
      }
      return -1;
    }

    function aISO(fechaTexto) {
      var texto = String(fechaTexto || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
      var conBarras = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
      if (conBarras) {
        var dia = parseInt(conBarras[1], 10);
        var mes = parseInt(conBarras[2], 10);
        var anio = parseInt(conBarras[3], 10);
        if (mes > 12 && dia <= 12) {
          var cambio = dia; dia = mes; mes = cambio;
        }
        if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
          return anio + '-' + (mes < 10 ? '0' : '') + mes + '-' + (dia < 10 ? '0' : '') + dia;
        }
      }
      return '';
    }

    /**
     * Importa el CSV que exporta la app Android.
     * @param {string} texto contenido del archivo
     * @param {object} opciones { reemplazar: boolean }
     */
    function importarCSV(texto, opciones) {
      cargar();
      var opc = opciones || {};
      var filas = parseCSV(texto);
      if (!filas.length) {
        return { importados: 0, omitidos: 0, categoriasCreadas: 0 };
      }

      var encabezados = filas[0];
      var indiceFecha = indiceColumna(encabezados, ['fecha']);
      var indiceMonto = indiceColumna(encabezados, ['monto', 'importe', 'cantidad']);
      var tieneEncabezado = indiceFecha !== -1 && indiceMonto !== -1;

      var columnas;
      if (tieneEncabezado) {
        columnas = {
          fecha: indiceFecha,
          tipo: indiceColumna(encabezados, ['tipo']),
          categoria: indiceColumna(encabezados, ['categoria']),
          medio: indiceColumna(encabezados, ['forma de pago', 'medio de pago', 'medio pago', 'forma pago']),
          nota: indiceColumna(encabezados, ['nota', 'notas', 'descripcion']),
          monto: indiceMonto
        };
      } else {
        columnas = { fecha: 0, tipo: 1, categoria: 2, medio: 3, nota: 4, monto: 5 };
      }

      var cuerpo = tieneEncabezado ? filas.slice(1) : filas;
      if (opc.reemplazar) {
        db.movimientos = [];
      }

      var importados = 0;
      var omitidos = 0;
      var categoriasCreadas = 0;
      var cacheCategorias = {};

      function buscarOCrearCategoria(nombre, tipo) {
        var llave = tipo + '|' + normalizar(nombre);
        if (cacheCategorias[llave]) return cacheCategorias[llave];

        var encontrada = db.categorias.find(function (c) {
          return c.tipo === tipo && normalizar(c.nombre) === normalizar(nombre);
        });
        if (encontrada) {
          cacheCategorias[llave] = encontrada.id;
          return encontrada.id;
        }
        if (!nombre) return null;

        var nueva = {
          id: nuevoId('categoria'),
          nombre: String(nombre).trim(),
          tipo: tipo,
          color: COLOR_GRIS,
          favorita: false
        };
        db.categorias.push(nueva);
        cacheCategorias[llave] = nueva.id;
        categoriasCreadas++;
        return nueva.id;
      }

      cuerpo.forEach(function (fila) {
        function valor(indice) {
          return indice >= 0 && indice < fila.length ? fila[indice] : '';
        }

        var fecha = aISO(valor(columnas.fecha));
        var monto = raiz.Formato.parseMonto(valor(columnas.monto));
        if (!fecha || !(monto > 0)) {
          omitidos++;
          return;
        }

        var tipoCrudo = normalizar(valor(columnas.tipo));
        var tipo;
        if (tipoCrudo.indexOf('abono') !== -1) {
          tipo = 'ABONO_TARJETA';
        } else if (tipoCrudo.indexOf('ingreso') !== -1) {
          tipo = 'INGRESO';
        } else {
          tipo = 'GASTO';
        }

        var medioCrudo = normalizar(valor(columnas.medio));
        var medio = tipo === 'GASTO' && medioCrudo.indexOf('tarjeta') !== -1 ? 'TARJETA' : 'EFECTIVO';

        var categoriaId = null;
        if (tipo !== 'ABONO_TARJETA') {
          categoriaId = buscarOCrearCategoria(valor(columnas.categoria), tipo);
        }

        var nota = String(valor(columnas.nota) || '').trim();
        db.seq.movimiento += 1;
        db.movimientos.push({
          id: db.seq.movimiento,
          tipo: tipo,
          monto: Math.round(monto * 100) / 100,
          categoriaId: categoriaId,
          fecha: fecha,
          nota: nota,
          medioPago: medio
        });
        importados++;
      });

      guardar();
      return { importados: importados, omitidos: omitidos, categoriasCreadas: categoriasCreadas };
    }

    function exportarRespaldo() {
      cargar();
      return {
        version: VERSION,
        generado: new Date().toISOString(),
        seq: clonar(db.seq),
        categorias: clonar(db.categorias),
        movimientos: clonar(db.movimientos),
        presupuestos: clonar(db.presupuestos),
        exportaciones: clonar(db.exportaciones)
      };
    }

    /**
     * Restaura un respaldo JSON. Siempre reemplaza el contenido actual.
     * Devuelve un resumen o lanza un Error si el archivo no es válido.
     */
    function restaurarRespaldo(objeto) {
      if (!dbValida(objeto)) {
        throw new Error('El archivo no es un respaldo válido de Control de Gastos.');
      }
      if (objeto.version && Number(objeto.version) > VERSION) {
        throw new Error('El respaldo pertenece a una versión más nueva de la aplicación.');
      }

      var nuevo = documentoVacio();
      nuevo.categorias = clonar(objeto.categorias);
      nuevo.movimientos = clonar(objeto.movimientos);
      nuevo.presupuestos = clonar(objeto.presupuestos);
      nuevo.exportaciones = Array.isArray(objeto.exportaciones) ? clonar(objeto.exportaciones) : [];
      nuevo.seq = objeto.seq && typeof objeto.seq === 'object'
        ? clonar(objeto.seq)
        : { categoria: 0, movimiento: 0, exportacion: 0 };

      db = nuevo;
      recalcularSecuencias();
      guardar();
      return {
        categorias: db.categorias.length,
        movimientos: db.movimientos.length,
        presupuestos: db.presupuestos.length
      };
    }

    /** Borra todo y vuelve a las categorías iniciales. */
    function restablecerTodo() {
      db = sembrar();
      guardar();
    }

    function borrarTodo() {
      db = documentoVacio();
      db.seq = { categoria: 0, movimiento: 0, exportacion: 0 };
      guardar();
    }

    function resumen() {
      cargar();
      return {
        categorias: db.categorias.length,
        movimientos: db.movimientos.length,
        presupuestos: db.presupuestos.length,
        exportaciones: db.exportaciones.length,
        bytes: (JSON.stringify(db) || '').length
      };
    }

    function exportarCSV() {
      cargar();
      var movimientos = obtenerMovimientos({
        desde: '0000-01-01',
        hasta: '9999-12-31',
        ordenMonto: false
      });

      function escapar(valor) {
        var texto = valor === null || valor === undefined ? '' : String(valor);
        if (/[",\n\r]/.test(texto)) {
          return '"' + texto.replace(/"/g, '""') + '"';
        }
        return texto;
      }

      function tipoLegible(m) {
        if (m.tipo === 'ABONO_TARJETA') return 'Abono a tarjeta';
        return m.tipo === 'GASTO' ? 'Gasto' : 'Ingreso';
      }

      function medioLegible(m) {
        return m.tipo === 'GASTO' && m.medioPago === 'TARJETA'
          ? 'Tarjeta de crédito'
          : 'Efectivo o débito';
      }

      var lineas = ['Fecha,Tipo,Categoría,Forma de pago,Nota,Monto'];
      movimientos.forEach(function (m) {
        lineas.push([
          escapar(m.fecha),
          escapar(tipoLegible(m)),
          escapar(m.categoriaNombre || ''),
          escapar(medioLegible(m)),
          escapar(m.nota || ''),
          m.monto.toFixed(2)
        ].join(','));
      });
      return '\uFEFF' + lineas.join('\r\n') + '\r\n';
    }

    return {
      CLAVE: CLAVE,
      COLORES: COLORES,
      cargar: cargar,
      recargar: function () { db = null; return cargar(); },
      guardar: guardar,
      resumen: resumen,
      obtenerCategorias: obtenerCategorias,
      obtenerCategoria: obtenerCategoria,
      insertarCategoria: insertarCategoria,
      actualizarCategoria: actualizarCategoria,
      eliminarCategoria: eliminarCategoria,
      contarMovimientosCategoria: contarMovimientosCategoria,
      insertarMovimiento: insertarMovimiento,
      actualizarMovimiento: actualizarMovimiento,
      eliminarMovimiento: eliminarMovimiento,
      obtenerMovimiento: obtenerMovimiento,
      obtenerMovimientos: obtenerMovimientos,
      totalPorTipo: totalPorTipo,
      totalGastosEfectivo: totalGastosEfectivo,
      totalGastosTarjeta: totalGastosTarjeta,
      totalAbonosTarjeta: totalAbonosTarjeta,
      deudaTarjeta: deudaTarjeta,
      gastosEfectivoPorCategoria: gastosEfectivoPorCategoria,
      obtenerPresupuesto: obtenerPresupuesto,
      guardarPresupuesto: guardarPresupuesto,
      eliminarPresupuesto: eliminarPresupuesto,
      listarExportaciones: listarExportaciones,
      obtenerExportacion: obtenerExportacion,
      guardarExportacion: guardarExportacion,
      eliminarExportacion: eliminarExportacion,
      exportarCSV: exportarCSV,
      importarCSV: importarCSV,
      exportarRespaldo: exportarRespaldo,
      restaurarRespaldo: restaurarRespaldo,
      restablecerTodo: restablecerTodo,
      borrarTodo: borrarTodo,
      parseCSV: parseCSV
    };
  }

  var Datos;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      Datos = crearRepositorio(localStorage);
    }
  } catch (e) {
    Datos = null;
  }

  raiz.Datos = Datos;
  raiz.crearRepositorio = crearRepositorio;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { crearRepositorio: crearRepositorio, COLORES: COLORES, SEMILLAS: SEMILLAS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
