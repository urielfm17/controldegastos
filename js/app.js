/* ==========================================================================
   Control de Gastos — interfaz, rutas y eventos.
   ========================================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // Almacenamiento y preferencias
  // ------------------------------------------------------------------------

  var almacenDisponible = true;
  var memoria = (function () {
    var datos = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null; },
      setItem: function (k, v) { datos[k] = String(v); },
      removeItem: function (k) { delete datos[k]; }
    };
  })();

  var DB;
  try {
    localStorage.setItem('controlgastos.prueba', '1');
    localStorage.removeItem('controlgastos.prueba');
  } catch (e) {
    almacenDisponible = false;
  }

  if (almacenDisponible && typeof Datos !== 'undefined' && Datos) {
    // Se reutiliza la instancia global para que solo haya una fuente de datos.
    DB = Datos;
  } else {
    DB = crearRepositorio(almacenDisponible ? localStorage : memoria);
  }

  var PREF_KEY = 'controlgastos.prefs.v1';
  var PREF_DEFECTO = {
    moneda: 'MXN',
    periodo: 'MES',
    tema: 'SISTEMA',
    orden: 'FECHA',
    umbral: 80,
    avisoOculto: false
  };

  var Prefs = {
    leer: function () {
      try {
        var crudo = localStorage.getItem(PREF_KEY);
        if (!crudo) return Object.assign({}, PREF_DEFECTO);
        var leido = JSON.parse(crudo);
        return Object.assign({}, PREF_DEFECTO, leido && typeof leido === 'object' ? leido : {});
      } catch (e) {
        return Object.assign({}, PREF_DEFECTO);
      }
    },
    get: function (clave) {
      return this.leer()[clave];
    },
    set: function (clave, valor) {
      var actual = this.leer();
      actual[clave] = valor;
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(actual));
      } catch (e) {
        // Si no hay almacenamiento, la preferencia dura solo la sesión.
      }
    },
    restablecer: function () {
      try {
        localStorage.removeItem(PREF_KEY);
      } catch (e) { /* sin almacenamiento */ }
    }
  };

  if (!almacenDisponible) {
    // Se conservan las preferencias en memoria durante la sesión.
    var prefMemoria = Object.assign({}, PREF_DEFECTO);
    Prefs.leer = function () { return Object.assign({}, prefMemoria); };
    Prefs.get = function (clave) { return prefMemoria[clave]; };
    Prefs.set = function (clave, valor) { prefMemoria[clave] = valor; };
    Prefs.restablecer = function () { prefMemoria = Object.assign({}, PREF_DEFECTO); };
  }

  // ------------------------------------------------------------------------
  // Utilidades de interfaz
  // ------------------------------------------------------------------------

  function $(selector, contexto) {
    return (contexto || document).querySelector(selector);
  }

  function $$(selector, contexto) {
    return Array.prototype.slice.call((contexto || document).querySelectorAll(selector));
  }

  function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function moneda(valor) {
    return Formato.moneda(valor, Prefs.get('moneda'));
  }

  function simboloMoneda() {
    var codigo = Prefs.get('moneda');
    if (codigo === 'USD') return 'US$';
    if (codigo === 'EUR') return '€';
    return '$';
  }

  var SVG = {
    editar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l.9 12.5h9.2L17.5 7M10 10.5v6M14 10.5v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ver: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12S6 6.5 12 6.5 21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    descargar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0 4.2-4.2M12 15l-4.2-4.2M5 19.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    compartir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 12v7.5h14V12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var temporizadorToast = null;
  function toast(mensaje) {
    var elemento = $('#toast');
    elemento.textContent = mensaje;
    elemento.classList.add('visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () {
      elemento.classList.remove('visible');
    }, 2600);
  }

  function guardarConAviso(accion) {
    try {
      return accion();
    } catch (e) {
      toast(e && e.message ? e.message : 'No se pudieron guardar los datos.');
      return null;
    }
  }

  // ------------------------------------------------------------------------
  // Tema
  // ------------------------------------------------------------------------

  var consultaOscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function aplicarTema() {
    var tema = Prefs.get('tema');
    var oscuro = tema === 'OSCURO' || (tema === 'SISTEMA' && consultaOscuro && consultaOscuro.matches);
    document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light');

    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuro ? '#0B1220' : '#F8FAFC');
  }

  if (consultaOscuro) {
    var alCambiarTemaSistema = function () {
      if (Prefs.get('tema') === 'SISTEMA') aplicarTema();
    };
    if (consultaOscuro.addEventListener) consultaOscuro.addEventListener('change', alCambiarTemaSistema);
    else if (consultaOscuro.addListener) consultaOscuro.addListener(alCambiarTemaSistema);
  }

  // ------------------------------------------------------------------------
  // Estado de la pantalla
  // ------------------------------------------------------------------------

  var hoy = Formato.mesActual();
  var estado = {
    vista: 'inicio',
    inicioAnio: hoy[0],
    inicioMes: hoy[1],
    presuAnio: hoy[0],
    presuMes: hoy[1],
    filtros: null,
    editor: null,
    volverA: '#/inicio',
    modalCategoria: null,
    ultimaRuta: null
  };

  function filtrosIniciales() {
    return {
      periodo: Prefs.get('periodo') || 'MES',
      tipo: 'TODOS',
      categoriaId: 0
    };
  }
  estado.filtros = filtrosIniciales();

  // ------------------------------------------------------------------------
  // Rutas
  // ------------------------------------------------------------------------

  function rutaActual() {
    var crudo = location.hash.replace(/^#\/?/, '');
    if (!crudo) crudo = 'inicio';
    var partes = crudo.split('?');
    var camino = partes[0].replace(/\/+$/, '');
    var segmentos = camino.split('/').filter(Boolean);
    return {
      vista: segmentos[0] || 'inicio',
      segmentos: segmentos,
      params: new URLSearchParams(partes[1] || '')
    };
  }

  function ir(destino) {
    if (location.hash === destino) {
      render();
      return;
    }
    location.hash = destino;
  }

  function abrirEditor(id, tipo, medioPago) {
    estado.volverA = location.hash || '#/inicio';
    if (id) {
      ir('#/editor/' + id);
    } else {
      var parametros = new URLSearchParams();
      if (tipo) parametros.set('tipo', tipo);
      if (medioPago) parametros.set('medio', medioPago);
      var cadena = parametros.toString();
      ir('#/editor/nuevo' + (cadena ? '?' + cadena : ''));
    }
  }

  // ------------------------------------------------------------------------
  // Cabecera y navegación
  // ------------------------------------------------------------------------

  function configurarCabecera(info) {
    $('#titulo-vista').textContent = info.titulo;
    document.title = info.titulo + ' · Control de Gastos';
    $('#btn-atras').hidden = !info.atras;
    $('#btn-accion').hidden = !info.accion;
    $('#btn-accion').setAttribute('aria-label', info.accionEtiqueta || 'Agregar');
    $('#btn-atras').setAttribute('aria-label', 'Atrás');
  }

  function marcarNavegacion(vista) {
    $$('.nav-item').forEach(function (enlace) {
      var destino = enlace.getAttribute('data-nav');
      var activo = destino === vista ||
        (vista === 'archivos' && destino === 'ajustes');
      enlace.classList.toggle('activo', activo);
      if (activo) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    });
  }

  // ------------------------------------------------------------------------
  // Dibujos reutilizables
  // ------------------------------------------------------------------------

  function iconoMovimiento(movimiento) {
    if (movimiento.tipo === 'ABONO_TARJETA') {
      return { texto: '−', fondo: 'var(--azul)' };
    }
    var color = movimiento.categoriaColor || '#2563EB';
    return {
      texto: movimiento.tipo === 'GASTO' ? '−' : '+',
      fondo: color
    };
  }

  function textoNota(movimiento) {
    var nota = (movimiento.nota || '').trim();
    if (movimiento.tipo === 'GASTO' && movimiento.medioPago === 'TARJETA') {
      return nota ? 'Tarjeta de crédito · ' + nota : 'Tarjeta de crédito';
    }
    if (!nota) {
      return movimiento.tipo === 'ABONO_TARJETA' ? 'Pago desde tu saldo' : 'Sin nota';
    }
    return nota;
  }

  function filaMovimiento(movimiento, conBorrar) {
    var icono = iconoMovimiento(movimiento);
    var esGasto = movimiento.tipo === 'GASTO';
    var esAbono = movimiento.tipo === 'ABONO_TARJETA';
    var colorMonto = esAbono ? 'var(--azul)' : (esGasto ? 'var(--rojo)' : 'var(--verde)');
    var signo = esGasto || esAbono ? '−' : '+';
    var nombre = esAbono ? 'Abono a tarjeta' : (movimiento.categoriaNombre || 'Sin categoría');

    return '' +
      '<div class="mov" data-accion="editar-movimiento" data-id="' + movimiento.id + '" role="button" tabindex="0">' +
        '<span class="mov-icono" style="background:' + esc(icono.fondo) + '">' + icono.texto + '</span>' +
        '<div class="mov-info">' +
          '<div class="mov-cat">' + esc(nombre) + '</div>' +
          '<div class="mov-nota">' + esc(textoNota(movimiento)) + '</div>' +
          '<div class="mov-fecha">' + esc(Formato.fechaCorta(movimiento.fecha)) + '</div>' +
        '</div>' +
        '<div class="mov-monto" style="color:' + colorMonto + '">' +
          signo + esc(moneda(movimiento.monto)) +
        '</div>' +
        (conBorrar
          ? '<button type="button" class="mov-borrar" data-accion="borrar-movimiento" data-id="' +
            movimiento.id + '" aria-label="Eliminar movimiento">' + SVG.borrar + '</button>'
          : '') +
      '</div>';
  }

  function listaMovimientos(movimientos, conBorrar) {
    if (!movimientos.length) return '';
    return '<div class="lista' + (conBorrar ? '' : ' lista-apretada') + '">' +
      movimientos.map(function (m) { return filaMovimiento(m, conBorrar); }).join('') +
      '</div>';
  }

  function barraGrafica(resumen) {
    if (!resumen.length) {
      return '<p class="vacio">Registra gastos de tu saldo este mes para ver la gráfica</p>';
    }
    var maximo = resumen.reduce(function (max, r) { return Math.max(max, r.total); }, 0);
    var filas = resumen.map(function (r) {
      var porcentaje = maximo > 0 ? Math.max(4, Math.round(r.total * 100 / maximo)) : 0;
      return '' +
        '<div class="barra-fila">' +
          '<span class="barra-nombre" title="' + esc(r.nombre) + '">' + esc(r.nombre) + '</span>' +
          '<span class="barra-pista"><span class="barra-relleno" style="width:' + porcentaje +
            '%;background:' + esc(r.color) + '"></span></span>' +
          '<span class="barra-monto">' + esc(moneda(r.total)) + '</span>' +
        '</div>';
    });
    return '<div class="grafica">' + filas.join('') + '</div>';
  }

  // ------------------------------------------------------------------------
  // Modal
  // ------------------------------------------------------------------------

  var elementoEnfocadoAntes = null;

  function abrirModal(opciones) {
    var fondo = $('#modal-fondo');
    elementoEnfocadoAntes = document.activeElement;

    $('#modal-titulo').textContent = opciones.titulo || '';
    $('#modal-cuerpo').innerHTML = opciones.html || '';

    var acciones = $('#modal-acciones');
    acciones.innerHTML = '';
    (opciones.botones || []).forEach(function (definicion) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'btn ' + (definicion.clase || 'btn-contorno');
      boton.textContent = definicion.texto;
      boton.addEventListener('click', function () {
        var resultado = definicion.onClick ? definicion.onClick() : true;
        if (resultado !== false && definicion.cerrar !== false) cerrarModal();
      });
      acciones.appendChild(boton);
    });

    fondo.hidden = false;
    document.body.style.overflow = 'hidden';

    var enfocable = $('#modal-cuerpo input, #modal-cuerpo select, #modal-cuerpo textarea, #modal-acciones button');
    if (enfocable) {
      setTimeout(function () { enfocable.focus(); }, 60);
    }
    if (opciones.alAbrir) opciones.alAbrir();
  }

  function cerrarModal() {
    $('#modal-fondo').hidden = true;
    document.body.style.overflow = '';
    $('#modal-cuerpo').innerHTML = '';
    $('#modal-acciones').innerHTML = '';
    if (elementoEnfocadoAntes && elementoEnfocadoAntes.focus) {
      try { elementoEnfocadoAntes.focus(); } catch (e) { /* ignore */ }
    }
  }

  function confirmar(opciones) {
    return new Promise(function (resolver) {
      var respondido = false;
      function responder(valor) {
        if (respondido) return;
        respondido = true;
        estado.alCerrarModal = null;
        resolver(valor);
      }
      abrirModal({
        titulo: opciones.titulo || 'Confirmar',
        html: '<p>' + esc(opciones.mensaje || '') + '</p>',
        botones: [
          {
            texto: opciones.textoCancelar || 'Cancelar',
            clase: 'btn-contorno',
            onClick: function () { responder(false); }
          },
          {
            texto: opciones.textoOk || 'Aceptar',
            clase: opciones.peligro ? 'btn-peligro' : 'btn-primario',
            onClick: function () { responder(true); }
          }
        ],
        alAbrir: function () {
          var fondo = $('#modal-fondo');
          fondo.dataset.confirmar = '1';
        }
      });
      estado.alCerrarModal = function () { responder(false); };
    });
  }

  // Cierra el modal al tocar el fondo o presionar Escape.
  $('#modal-fondo').addEventListener('click', function (evento) {
    if (evento.target === this) {
      cerrarModal();
      if (estado.alCerrarModal) {
        var aviso = estado.alCerrarModal;
        estado.alCerrarModal = null;
        aviso();
      }
    }
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && !$('#modal-fondo').hidden) {
      cerrarModal();
      if (estado.alCerrarModal) {
        var aviso = estado.alCerrarModal;
        estado.alCerrarModal = null;
        aviso();
      }
    }
  });

  // ------------------------------------------------------------------------
  // Vista: Inicio
  // ------------------------------------------------------------------------

  function avisoInstalacion() {
    var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var instalada = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!esIOS || instalada || Prefs.get('avisoOculto')) return '';

    return '' +
      '<div class="aviso mt-8">' +
        '<strong>Úsala como app en tu iPhone:</strong> ' +
        '<button type="button" class="enlace-btn" data-accion="ayuda-instalar">ver cómo instalarla</button> ' +
        '<button type="button" class="enlace-btn" data-accion="ocultar-aviso">ocultar</button>' +
      '</div>';
  }

  function renderInicio() {
    var rango = Formato.rangoMes(estado.inicioAnio, estado.inicioMes);
    var periodo = Formato.periodo(estado.inicioAnio, estado.inicioMes);
    var ingresos = DB.totalPorTipo('INGRESO', rango[0], rango[1]);
    var gastosEfectivo = DB.totalGastosEfectivo(rango[0], rango[1]);
    var comprasTarjeta = DB.totalGastosTarjeta(rango[0], rango[1]);
    var abonosTarjeta = DB.totalAbonosTarjeta(rango[0], rango[1]);
    var saldo = ingresos - gastosEfectivo - abonosTarjeta;
    var deuda = Math.max(0, DB.deudaTarjeta());
    var presupuesto = DB.obtenerPresupuesto(periodo);
    var umbral = Number(Prefs.get('umbral')) || 80;
    var resumen = DB.gastosEfectivoPorCategoria(rango[0], rango[1], 6);
    var ultimos = DB.obtenerMovimientos({
      desde: rango[0],
      hasta: rango[1],
      ordenMonto: Prefs.get('orden') === 'MONTO'
    }).slice(0, 5);

    var html = avisoInstalacion();

    html += '<div class="mes-selector">' +
      '<button type="button" class="btn-mes" data-accion="inicio-mes-ant" aria-label="Mes anterior">‹</button>' +
      '<h2 class="mes-titulo">' + esc(Formato.mesLargo(estado.inicioAnio, estado.inicioMes)) + '</h2>' +
      '<button type="button" class="btn-mes" data-accion="inicio-mes-sig" aria-label="Mes siguiente">›</button>' +
      '</div>';

    html += '<section class="card-saldo">' +
      '<div class="saldo-etiqueta">Saldo del mes</div>' +
      '<div class="saldo-monto">' + esc(moneda(saldo)) + '</div>' +
      '<div class="saldo-columnas">' +
        '<div class="saldo-col"><div class="etiqueta">Ingresos</div><div class="valor">' +
          esc(moneda(ingresos)) + '</div></div>' +
        '<div class="saldo-col"><div class="etiqueta">Gastos de tu saldo</div><div class="valor">' +
          esc(moneda(gastosEfectivo)) + '</div></div>' +
      '</div>' +
      '</section>';

    // Presupuesto
    html += '<section class="card">' +
      '<div class="card-fila">' +
        '<h3 class="card-titulo">Presupuesto</h3>' +
        '<span class="fuerte">' + (presupuesto < 0 ? '—' : esc(moneda(presupuesto))) + '</span>' +
      '</div>';

    if (presupuesto < 0) {
      html += '<p class="mudo chico mt-8" style="margin-bottom:0">Sin presupuesto definido</p>' +
        '<div class="progress"><span></span></div>';
    } else {
      var porcentaje = presupuesto <= 0 ? 100 : Math.round(gastosEfectivo * 100 / presupuesto);
      var color;
      var alerta;
      if (gastosEfectivo > presupuesto) {
        color = 'var(--rojo)';
        alerta = 'Superaste tu presupuesto por ' + moneda(gastosEfectivo - presupuesto);
      } else if (porcentaje >= umbral) {
        color = 'var(--ambar)';
        alerta = 'Cuidado: ya usaste el ' + porcentaje + '% del presupuesto';
      } else {
        color = 'var(--verde)';
        alerta = 'Vas bien: has usado el ' + porcentaje + '% del presupuesto';
      }
      html += '<p class="mudo chico mt-8" style="margin-bottom:0">' +
          esc(moneda(gastosEfectivo)) + ' de ' + esc(moneda(presupuesto)) + '</p>' +
        '<div class="progress"><span style="width:' + Math.min(100, Math.max(0, porcentaje)) +
          '%;background:' + color + '"></span></div>' +
        '<div class="alerta" style="color:' + color + '">' + esc(alerta) + '</div>';
    }
    html += '</section>';

    // Tarjeta de crédito
    html += '<section class="card">' +
      '<div class="card-fila">' +
        '<h3 class="card-titulo">Tarjeta de crédito</h3>' +
        '<div style="text-align:right">' +
          '<div class="mudo chico">Deuda actual</div>' +
          '<div class="fuerte" style="color:' + (deuda > 0 ? 'var(--rojo)' : 'var(--verde)') + '">' +
            esc(moneda(deuda)) + '</div>' +
        '</div>' +
      '</div>' +
      '<p class="mudo chico mt-8" style="margin-bottom:0">Compras con tarjeta: ' +
        esc(moneda(comprasTarjeta)) + ' · Abonos: ' + esc(moneda(abonosTarjeta)) + '</p>' +
      '<p class="mudo chico" style="margin-bottom:0">Las compras con tarjeta se controlan aparte: no afectan tu saldo ni tu presupuesto. Los abonos sí descuentan de tu saldo.</p>' +
      '<div class="botonera">' +
        '<button type="button" class="btn btn-contorno btn-chico" data-accion="nuevo-abono">Abonar</button>' +
        '<button type="button" class="btn btn-contorno btn-chico" data-accion="ver-tarjeta">Ver movimientos</button>' +
      '</div>' +
      '</section>';

    // Gráfica
    html += '<section class="card">' +
      '<h3 class="card-titulo">Gastos de tu saldo por categoría</h3>' +
      barraGrafica(resumen) +
      '</section>';

    // Últimos movimientos
    html += '<div class="seccion-titulo">' +
      '<span>Últimos movimientos</span>' +
      '<button type="button" class="enlace-btn" data-accion="ir-movimientos">Ver todos</button>' +
      '</div>';
    html += ultimos.length
      ? listaMovimientos(ultimos, false)
      : '<p class="vacio">Aún no hay movimientos este mes. Usa el botón + para registrar el primero.</p>';

    html += '<div class="botonera mt-16">' +
      '<button type="button" class="btn btn-contorno" data-accion="ir-archivos">Archivos y exportación</button>' +
      '</div>';

    return {
      titulo: 'Control de Gastos',
      atras: false,
      accion: 'nuevo',
      accionEtiqueta: 'Agregar movimiento',
      html: html
    };
  }

  // ------------------------------------------------------------------------
  // Vista: Movimientos
  // ------------------------------------------------------------------------

  function renderMovimientos() {
    var tipo = estado.filtros.tipo;
    var categorias = DB.obtenerCategorias(null);
    var rango = Formato.rangoPeriodo(estado.filtros.periodo);

    var filtroTarjeta = tipo === 'TARJETA';
    var filtroAbonos = tipo === 'ABONO_TARJETA';
    var tipoConsulta = tipo === 'GASTO' ? 'GASTO'
      : tipo === 'INGRESO' ? 'INGRESO'
      : filtroAbonos ? 'ABONO_TARJETA'
      : null;

    if (filtroTarjeta || filtroAbonos) {
      estado.filtros.categoriaId = 0;
    }

    var movimientos = DB.obtenerMovimientos({
      tipo: tipoConsulta,
      categoriaId: estado.filtros.categoriaId,
      desde: rango[0],
      hasta: rango[1],
      ordenMonto: Prefs.get('orden') === 'MONTO',
      soloTarjeta: filtroTarjeta
    });

    var opcionesPeriodo = [
      ['SEMANA', 'Semana actual'],
      ['MES', 'Mes actual'],
      ['TODO', 'Todo el historial']
    ];
    var opcionesTipo = [
      ['TODOS', 'Todos'],
      ['GASTO', 'Gastos'],
      ['INGRESO', 'Ingresos'],
      ['TARJETA', 'Tarjeta'],
      ['ABONO_TARJETA', 'Abonos']
    ];

    var selectsPeriodo = opcionesPeriodo.map(function (op) {
      return '<option value="' + op[0] + '"' +
        (estado.filtros.periodo === op[0] ? ' selected' : '') + '>' + op[1] + '</option>';
    }).join('');

    var selectsTipo = opcionesTipo.map(function (op) {
      return '<option value="' + op[0] + '"' +
        (tipo === op[0] ? ' selected' : '') + '>' + op[1] + '</option>';
    }).join('');

    var selectsCategoria = '<option value="0">Todas las categorías</option>' +
      categorias.map(function (c) {
        return '<option value="' + c.id + '"' +
          (Number(estado.filtros.categoriaId) === Number(c.id) ? ' selected' : '') + '>' +
          esc(c.nombre) + ' (' + (c.tipo === 'GASTO' ? 'gasto' : 'ingreso') + ')</option>';
      }).join('');

    var html = '' +
      '<div class="filtros">' +
        '<div class="campo"><label for="filtro-periodo">Periodo</label>' +
          '<select class="select" id="filtro-periodo" data-filtro="periodo">' + selectsPeriodo + '</select></div>' +
        '<div class="campo"><label for="filtro-tipo">Tipo</label>' +
          '<select class="select" id="filtro-tipo" data-filtro="tipo">' + selectsTipo + '</select></div>' +
        '<div class="campo campo-ancho"><label for="filtro-categoria">Categoría</label>' +
          '<select class="select" id="filtro-categoria" data-filtro="categoriaId"' +
            (filtroTarjeta || filtroAbonos ? ' disabled' : '') + '>' + selectsCategoria + '</select></div>' +
      '</div>' +
      '<p class="mudo chico mt-8">' +
        (movimientos.length === 0 ? 'Sin resultados' : movimientos.length + ' movimiento(s)') +
        ' · Toca uno para editarlo.</p>';

    html += movimientos.length
      ? listaMovimientos(movimientos, true)
      : '<p class="vacio">No hay movimientos con estos filtros.</p>';

    return {
      titulo: 'Movimientos',
      atras: false,
      accion: 'nuevo',
      accionEtiqueta: 'Agregar movimiento',
      html: html
    };
  }

  // ------------------------------------------------------------------------
  // Vista: Categorías
  // ------------------------------------------------------------------------

  function renderCategorias() {
    var categorias = DB.obtenerCategorias(null);

    var html = '';
    if (!categorias.length) {
      html += '<p class="vacio">Aún no hay categorías. Usa el botón + para crear una.</p>';
    } else {
      html += '<div class="lista">' + categorias.map(function (categoria) {
        var movimientos = DB.contarMovimientosCategoria(categoria.id);
        var tipo = categoria.tipo === 'GASTO' ? 'Gasto' : 'Ingreso';
        var color = categoria.tipo === 'GASTO' ? 'var(--rojo)' : 'var(--verde)';
        return '' +
          '<div class="cat" data-accion="editar-categoria" data-id="' + categoria.id + '" role="button" tabindex="0">' +
            '<span class="cat-punto" style="background:' + esc(categoria.color) + '"></span>' +
            '<div class="cat-info">' +
              '<div class="cat-nombre">' + (categoria.favorita ? '★ ' : '') + esc(categoria.nombre) + '</div>' +
              '<div class="cat-detalle" style="color:' + color + '">' + tipo + ' · ' +
                movimientos + ' movimiento(s)</div>' +
            '</div>' +
            '<div class="cat-acciones">' +
              '<button type="button" class="mini-btn" data-accion="editar-categoria" data-id="' +
                categoria.id + '" aria-label="Editar categoría">' + SVG.editar + '</button>' +
              '<button type="button" class="mini-btn peligro" data-accion="borrar-categoria" data-id="' +
                categoria.id + '" aria-label="Eliminar categoría">' + SVG.borrar + '</button>' +
            '</div>' +
          '</div>';
      }).join('') + '</div>';
    }

    html += '<p class="mudo chico mt-12">Las categorías se usan para clasificar los movimientos y la gráfica del resumen.</p>';

    return {
      titulo: 'Categorías',
      atras: false,
      accion: 'categoria',
      accionEtiqueta: 'Nueva categoría',
      html: html
    };
  }

  // ------------------------------------------------------------------------
  // Vista: Presupuesto
  // ------------------------------------------------------------------------

  function renderPresupuesto() {
    var periodo = Formato.periodo(estado.presuAnio, estado.presuMes);
    var rango = Formato.rangoMes(estado.presuAnio, estado.presuMes);
    var gastado = DB.totalGastosEfectivo(rango[0], rango[1]);
    var presupuesto = DB.obtenerPresupuesto(periodo);
    var umbral = Number(Prefs.get('umbral')) || 80;

    var html = '<div class="mes-selector">' +
      '<button type="button" class="btn-mes" data-accion="presu-mes-ant" aria-label="Mes anterior">‹</button>' +
      '<h2 class="mes-titulo">' + esc(Formato.mesLargo(estado.presuAnio, estado.presuMes)) + '</h2>' +
      '<button type="button" class="btn-mes" data-accion="presu-mes-sig" aria-label="Mes siguiente">›</button>' +
      '</div>';

    html += '<form id="form-presupuesto" novalidate>' +
      '<div class="card">' +
        '<h3 class="card-titulo">Presupuesto del mes</h3>' +
        '<p class="mudo chico mt-8" style="margin-bottom:0">Gastado de tu saldo: <strong>' +
          esc(moneda(gastado)) + '</strong></p>';

    if (presupuesto < 0) {
      html += '<p class="mudo chico" style="margin-bottom:0">Este mes todavía no tiene un presupuesto.</p>' +
        '<div class="progress"><span></span></div>';
    } else {
      var diferencia = presupuesto - gastado;
      html += '<p class="mudo chico" style="margin-bottom:0;color:' +
          (diferencia >= 0 ? 'var(--verde)' : 'var(--rojo)') + '">' +
          (diferencia >= 0
            ? 'Disponible: ' + esc(moneda(diferencia))
            : 'Excedido: ' + esc(moneda(Math.abs(diferencia)))) +
        '</p>';

      var porcentaje = presupuesto <= 0 ? 100 : Math.round(gastado * 100 / presupuesto);
      var color;
      var alerta;
      if (gastado > presupuesto) {
        color = 'var(--rojo)';
        alerta = 'Superaste tu presupuesto por ' + moneda(gastado - presupuesto);
      } else if (porcentaje >= umbral) {
        color = 'var(--ambar)';
        alerta = 'Cuidado: ya usaste el ' + porcentaje + '% del presupuesto';
      } else {
        color = 'var(--verde)';
        alerta = 'Vas bien: has usado el ' + porcentaje + '% del presupuesto';
      }
      html += '<div class="progress"><span style="width:' + Math.min(100, Math.max(0, porcentaje)) +
          '%;background:' + color + '"></span></div>' +
        '<div class="alerta" style="color:' + color + '">' + esc(alerta) + '</div>';
    }

    html += '<div class="campo"><label for="presupuesto-monto">Límite de gasto de tu saldo</label>' +
        '<input class="input" id="presupuesto-monto" type="text" inputmode="decimal" ' +
          'placeholder="0.00" value="' +
          (presupuesto < 0 ? '' : presupuesto.toFixed(2)) + '">' +
        '<div class="texto-error" id="error-presupuesto" hidden></div>' +
      '</div>' +
      '<button type="submit" class="btn btn-primario btn-bloque mt-16">Guardar presupuesto</button>';

    if (presupuesto >= 0) {
      html += '<button type="button" class="btn btn-peligro btn-bloque mt-12" data-accion="quitar-presupuesto">' +
        'Quitar presupuesto</button>';
    }

    html += '</div></form>';

    html += '<div class="aviso mt-12">El límite aplica solo al mes mostrado y suma únicamente los gastos pagados con efectivo o débito. Las compras con tarjeta se controlan aparte. La alerta se activa al superar el umbral configurado en Ajustes.</div>';

    return {
      titulo: 'Presupuesto',
      atras: false,
      accion: null,
      html: html
    };
  }

  // ------------------------------------------------------------------------
  // Vista: Ajustes
  // ------------------------------------------------------------------------

  function renderAjustes() {
    var prefs = Prefs.leer();
    var resumen = DB.resumen();

    function opciones(lista, valor) {
      return lista.map(function (op) {
        return '<option value="' + op[0] + '"' +
          (valor === op[0] ? ' selected' : '') + '>' + op[1] + '</option>';
      }).join('');
    }

    var html = '<section class="card">' +
      '<h3 class="card-titulo">Preferencias</h3>' +

      '<div class="campo"><label for="pref-moneda">Moneda</label>' +
        '<select class="select" id="pref-moneda" data-pref="moneda">' +
          opciones([['MXN', 'Peso mexicano (MXN)'], ['USD', 'Dólar estadounidense (USD)'], ['EUR', 'Euro (EUR)']], prefs.moneda) +
        '</select>' +
        '<p class="ayuda">Ejemplo: ' + esc(moneda(1234.5)) + '</p></div>' +

      '<div class="campo"><label for="pref-periodo">Periodo predeterminado</label>' +
        '<select class="select" id="pref-periodo" data-pref="periodo">' +
          opciones([['SEMANA', 'Semana actual'], ['MES', 'Mes actual'], ['TODO', 'Todo el historial']], prefs.periodo) +
        '</select></div>' +

      '<div class="campo"><label for="pref-tema">Tema de la aplicación</label>' +
        '<select class="select" id="pref-tema" data-pref="tema">' +
          opciones([['CLARO', 'Claro'], ['OSCURO', 'Oscuro'], ['SISTEMA', 'Sistema']], prefs.tema) +
        '</select></div>' +

      '<div class="campo"><label for="pref-orden">Orden de los movimientos</label>' +
        '<select class="select" id="pref-orden" data-pref="orden">' +
          opciones([['FECHA', 'Fecha más reciente'], ['MONTO', 'Mayor importe']], prefs.orden) +
        '</select></div>' +

      '<div class="campo"><label for="pref-umbral">Umbral de alerta del presupuesto: ' +
        '<strong id="valor-umbral">' + Number(prefs.umbral) + '%</strong></label>' +
        '<input class="rango" id="pref-umbral" type="range" min="50" max="100" step="5" ' +
          'value="' + Number(prefs.umbral) + '" data-pref-rango="umbral">' +
        '<p class="ayuda">La alerta cambia de color al alcanzar este porcentaje.</p></div>' +

      '<p class="ayuda">Los cambios se guardan automáticamente y se conservan al cerrar la aplicación.</p>' +
      '<button type="button" class="btn btn-contorno btn-bloque mt-12" data-accion="restablecer-prefs">' +
        'Restablecer valores</button>' +
      '</section>';

    html += '<section class="card">' +
      '<h3 class="card-titulo">Datos</h3>' +
      '<div class="fila-info"><span>Movimientos</span><span class="valor">' + resumen.movimientos + '</span></div>' +
      '<div class="fila-info"><span>Categorías</span><span class="valor">' + resumen.categorias + '</span></div>' +
      '<div class="fila-info"><span>Presupuestos</span><span class="valor">' + resumen.presupuestos + '</span></div>' +
      '<div class="fila-info"><span>Espacio usado</span><span class="valor">' + esc(Formato.tamanoLegible(resumen.bytes)) + '</span></div>' +
      '<button type="button" class="btn btn-primario btn-bloque mt-16" data-accion="ir-archivos">' +
        'Archivos, respaldo e importación</button>' +
      '<button type="button" class="btn btn-peligro btn-bloque mt-12" data-accion="borrar-todo">' +
        'Borrar todos los datos</button>' +
      '</section>';

    html += '<section class="card">' +
      '<h3 class="card-titulo">Instalar en el iPhone</h3>' +
      '<p class="mudo chico">Abre esta página en <strong>Safari</strong>, toca el botón Compartir y elige ' +
        '<strong>Añadir a pantalla de inicio</strong>. Así se abre a pantalla completa y funciona sin internet.</p>' +
      '<button type="button" class="btn btn-contorno btn-bloque mt-12" data-accion="ayuda-instalar">' +
        'Ver instrucciones paso a paso</button>' +
      '</section>';

    html += '<section class="card">' +
      '<h3 class="card-titulo">Acerca de</h3>' +
      '<p class="mudo chico">Control de Gastos · versión web 1.0<br>Funciona sin conexión y guarda los datos ' +
        'solo en este dispositivo.</p>' +
      (almacenDisponible ? '' :
        '<p class="alerta" style="color:var(--error)">Este navegador bloqueó el almacenamiento local. ' +
        'Los datos se perderán al cerrar la página; usa el respaldo JSON.</p>') +
      '</section>';

    return {
      titulo: 'Ajustes',
      atras: false,
      accion: null,
      html: html
    };
  }

  // ------------------------------------------------------------------------
  // Vista: Archivos y exportación
  // ------------------------------------------------------------------------

  function renderArchivos() {
    var exportaciones = DB.listarExportaciones();

    var html = '<section class="card">' +
      '<h3 class="card-titulo">Exportar movimientos</h3>' +
      '<p class="mudo chico">Genera un archivo CSV con todos los movimientos. Puedes abrirlo en Excel ' +
        'u otra hoja de cálculo, compartirlo o guardarlo en Archivos.</p>' +
      '<button type="button" class="btn btn-primario btn-bloque mt-12" data-accion="generar-csv">' +
        'Generar archivo CSV</button>' +
      '</section>';

    html += '<section class="card">' +
      '<h3 class="card-titulo">Respaldo completo</h3>' +
      '<p class="mudo chico">El respaldo JSON guarda movimientos, categorías, presupuestos y archivos. ' +
        'Úsalo para no perder los datos o para pasarlos a otro dispositivo.</p>' +
      '<button type="button" class="btn btn-contorno btn-bloque mt-12" data-accion="descargar-respaldo">' +
        'Descargar respaldo JSON</button>' +
      '<form id="form-restaurar" class="mt-12">' +
        '<label class="campo-etiqueta" for="archivo-respaldo">Restaurar respaldo</label>' +
        '<input class="input" id="archivo-respaldo" type="file" accept=".json,application/json">' +
        '<p class="ayuda">Restaurar reemplaza todos los datos actuales.</p>' +
        '<button type="submit" class="btn btn-contorno btn-bloque mt-8">Restaurar respaldo</button>' +
      '</form>' +
      '</section>';

    html += '<section class="card">' +
      '<h3 class="card-titulo">Importar desde la app Android</h3>' +
      '<p class="mudo chico">Exporta el CSV desde la app Android (menú <strong>Exportar CSV</strong>) y ' +
        'cárgalo aquí. También puedes importar cualquier CSV con las columnas del formato.</p>' +
      '<form id="form-importar">' +
        '<div class="campo"><label for="archivo-csv">Archivo CSV</label>' +
          '<input class="input" id="archivo-csv" type="file" accept=".csv,text/csv"></div>' +
        '<div class="campo"><span class="campo-etiqueta">Modo de importación</span>' +
          '<label class="fila-info" style="align-items:center;padding:8px 0;cursor:pointer">' +
            '<span><strong>Agregar</strong><br><span class="mudo chico">Suma los movimientos a los existentes</span></span>' +
            '<input type="radio" name="modo-importacion" value="agregar" checked>' +
          '</label>' +
          '<label class="fila-info" style="align-items:center;padding:8px 0;cursor:pointer">' +
            '<span><strong>Reemplazar movimientos</strong><br><span class="mudo chico">Borra los movimientos actuales</span></span>' +
            '<input type="radio" name="modo-importacion" value="reemplazar">' +
          '</label>' +
        '</div>' +
        '<button type="submit" class="btn btn-contorno btn-bloque">Importar CSV</button>' +
      '</form>' +
      '</section>';

    html += '<div class="seccion-titulo"><span>Archivos generados</span></div>';

    if (!exportaciones.length) {
      html += '<p class="vacio">Todavía no has generado archivos.</p>';
    } else {
      html += '<div class="lista lista-apretada">' + exportaciones.map(function (archivo) {
        return '' +
          '<div class="archivo">' +
            '<span class="archivo-icono">CSV</span>' +
            '<div class="archivo-info">' +
              '<div class="archivo-nombre">' + esc(archivo.nombre) + '</div>' +
              '<div class="archivo-detalle">' + esc(Formato.fechaHoraArchivo(archivo.fecha)) +
                ' · ' + esc(Formato.tamanoLegible(archivo.bytes)) + '</div>' +
            '</div>' +
            '<button type="button" class="mini-btn" data-accion="ver-csv" data-id="' + archivo.id +
              '" aria-label="Vista previa">' + SVG.ver + '</button>' +
            '<button type="button" class="mini-btn" data-accion="descargar-csv" data-id="' + archivo.id +
              '" aria-label="Descargar">' + SVG.descargar + '</button>' +
            '<button type="button" class="mini-btn" data-accion="compartir-csv" data-id="' + archivo.id +
              '" aria-label="Compartir">' + SVG.compartir + '</button>' +
            '<button type="button" class="mini-btn peligro" data-accion="borrar-csv" data-id="' + archivo.id +
              '" aria-label="Eliminar archivo">' + SVG.borrar + '</button>' +
          '</div>';
      }).join('') + '</div>';
    }

    html += '<div class="aviso mt-16">Los archivos se guardan en el historial de esta app (máximo 20). ' +
      'Además, cada descarga queda en la app Archivos de tu iPhone. Un CSV generado permanece aunque ' +
      'cierres la aplicación.</div>';

    return {
      titulo: 'Archivos y exportación',
      atras: true,
      accion: null,
      html: html
    };
  }

  // ------------------------------------------------------------------------
  // Vista: Editor de movimiento
  // ------------------------------------------------------------------------

  function cargarEditor(ruta) {
    var id = ruta.segmentos[1] && ruta.segmentos[1] !== 'nuevo'
      ? Number(ruta.segmentos[1])
      : null;

    if (id) {
      var movimiento = DB.obtenerMovimiento(id);
      if (!movimiento) {
        toast('El movimiento ya no existe.');
        ir('#/movimientos');
        return null;
      }
      return {
        id: movimiento.id,
        tipo: movimiento.tipo,
        medioPago: movimiento.medioPago,
        monto: movimiento.monto.toFixed(2),
        categoriaId: movimiento.categoriaId,
        fecha: movimiento.fecha,
        nota: movimiento.nota || ''
      };
    }

    var tipo = ruta.params.get('tipo') || 'GASTO';
    if (['GASTO', 'INGRESO', 'ABONO_TARJETA'].indexOf(tipo) === -1) tipo = 'GASTO';
    var medio = ruta.params.get('medio') === 'TARJETA' ? 'TARJETA' : 'EFECTIVO';

    return {
      id: null,
      tipo: tipo,
      medioPago: tipo === 'GASTO' ? medio : 'EFECTIVO',
      monto: '',
      categoriaId: null,
      fecha: Formato.hoyISO(),
      nota: ''
    };
  }

  function renderEditor(ruta) {
    if (!estado.editor) {
      var cargado = cargarEditor(ruta);
      if (!cargado) return null;
      estado.editor = cargado;
    }
    var editor = estado.editor;
    var esGasto = editor.tipo === 'GASTO';
    var esIngreso = editor.tipo === 'INGRESO';
    var esAbono = editor.tipo === 'ABONO_TARJETA';

    var categorias = esAbono ? [] : DB.obtenerCategorias(esIngreso ? 'INGRESO' : 'GASTO');
    if (!esAbono && categorias.length) {
      var existe = categorias.some(function (c) {
        return Number(c.id) === Number(editor.categoriaId);
      });
      if (!existe) editor.categoriaId = categorias[0].id;
    }

    var html = '<form id="form-movimiento" novalidate>' +
      '<div class="campo"><span class="campo-etiqueta">Tipo</span>' +
        '<div class="segmento" role="group" aria-label="Tipo de movimiento">' +
          '<button type="button" data-accion="tipo-movimiento" data-tipo="GASTO" class="' +
            (esGasto ? 'activo' : '') + '">Gasto</button>' +
          '<button type="button" data-accion="tipo-movimiento" data-tipo="INGRESO" class="' +
            (esIngreso ? 'activo' : '') + '">Ingreso</button>' +
          '<button type="button" data-accion="tipo-movimiento" data-tipo="ABONO_TARJETA" class="' +
            (esAbono ? 'activo' : '') + '">Abono</button>' +
        '</div></div>' +

      '<div class="campo"><label for="editor-monto">Monto</label>' +
        '<div class="monto-caja"><span class="monto-signo">' + esc(simboloMoneda()) + '</span>' +
          '<input id="editor-monto" type="text" inputmode="decimal" placeholder="0.00" ' +
            'value="' + esc(editor.monto) + '" autocomplete="off"></div>' +
        '<div class="texto-error" id="error-monto" hidden></div>' +
      '</div>' +

      '<div class="campo" id="campo-medio"' + (esGasto ? '' : ' hidden') + '>' +
        '<span class="campo-etiqueta">Forma de pago</span>' +
        '<div class="segmento" role="group" aria-label="Forma de pago">' +
          '<button type="button" data-accion="medio-movimiento" data-medio="EFECTIVO" class="' +
            (editor.medioPago !== 'TARJETA' ? 'activo' : '') + '">Efectivo o débito</button>' +
          '<button type="button" data-accion="medio-movimiento" data-medio="TARJETA" class="' +
            (editor.medioPago === 'TARJETA' ? 'activo' : '') + '">Tarjeta de crédito</button>' +
        '</div></div>' +

      '<div class="campo" id="campo-categoria"' + (esAbono ? ' hidden' : '') + '>' +
        '<label for="editor-categoria">Categoría</label>' +
        (categorias.length
          ? '<select class="select" id="editor-categoria">' + categorias.map(function (c) {
              return '<option value="' + c.id + '"' +
                (Number(c.id) === Number(editor.categoriaId) ? ' selected' : '') + '>' +
                esc(c.nombre) + '</option>';
            }).join('') + '</select>'
          : '<div class="aviso">No hay categorías de este tipo. ' +
              '<button type="button" class="enlace-btn" data-accion="nueva-categoria-editor">Crear una</button></div>') +
        '<div class="texto-error" id="error-categoria" hidden></div>' +
      '</div>' +

      '<div class="campo"><label for="editor-fecha">Fecha</label>' +
        '<input class="input" id="editor-fecha" type="date" value="' + esc(editor.fecha) + '" required></div>' +

      '<div class="campo"><label for="editor-nota">Nota (opcional)</label>' +
        '<input class="input" id="editor-nota" type="text" maxlength="200" ' +
          'placeholder="Ej. Comida del día, pago de transporte..." value="' + esc(editor.nota) + '"></div>';

    if (esAbono) {
      html += '<div class="aviso mt-12">El abono reduce tu saldo disponible y la deuda de la tarjeta.</div>';
    }

    html += '<button type="submit" class="btn btn-primario btn-bloque mt-24">' +
      (editor.id ? 'Guardar cambios' : 'Guardar movimiento') + '</button>';

    if (editor.id) {
      html += '<button type="button" class="btn btn-peligro btn-bloque mt-12" ' +
        'data-accion="borrar-movimiento-editor">Eliminar movimiento</button>';
    }

    html += '</form>';

    return {
      titulo: editor.id ? 'Editar movimiento' : 'Nuevo movimiento',
      atras: true,
      accion: null,
      html: html
    };
  }

  function sincronizarEditor() {
    if (!estado.editor) return;
    var monto = $('#editor-monto');
    var fecha = $('#editor-fecha');
    var nota = $('#editor-nota');
    var categoria = $('#editor-categoria');
    if (monto) estado.editor.monto = monto.value;
    if (fecha) estado.editor.fecha = fecha.value || estado.editor.fecha;
    if (nota) estado.editor.nota = nota.value;
    if (categoria) estado.editor.categoriaId = Number(categoria.value) || null;
  }

  function guardarMovimiento(evento) {
    evento.preventDefault();
    if (!estado.editor) return;

    sincronizarEditor();
    var editor = estado.editor;
    var errorMonto = $('#error-monto');
    var errorCategoria = $('#error-categoria');
    var monto = Formato.parseMonto(editor.monto);

    errorMonto.hidden = true;
    if (errorCategoria) errorCategoria.hidden = true;

    if (monto <= 0) {
      errorMonto.textContent = 'Ingresa un monto mayor a cero.';
      errorMonto.hidden = false;
      $('#editor-monto').focus();
      return;
    }

    var esAbono = editor.tipo === 'ABONO_TARJETA';
    var categoriaId = esAbono ? null : Number(editor.categoriaId);
    if (!esAbono && !categoriaId) {
      if (errorCategoria) {
        errorCategoria.textContent = 'Selecciona una categoría.';
        errorCategoria.hidden = false;
      } else {
        toast('Selecciona una categoría.');
      }
      return;
    }
    if (!editor.fecha) {
      toast('Selecciona una fecha.');
      return;
    }

    var datos = {
      tipo: editor.tipo,
      monto: monto,
      categoriaId: categoriaId,
      fecha: editor.fecha,
      nota: editor.nota,
      medioPago: editor.tipo === 'GASTO' ? editor.medioPago : 'EFECTIVO'
    };

    var resultado;
    if (editor.id) {
      datos.id = editor.id;
      resultado = guardarConAviso(function () { return DB.actualizarMovimiento(datos); });
    } else {
      resultado = guardarConAviso(function () { return DB.insertarMovimiento(datos); });
    }

    if (resultado) {
      toast('Movimiento guardado');
      estado.editor = null;
      ir(estado.volverA || '#/inicio');
    } else if (resultado !== null) {
      toast('No se pudo guardar el movimiento.');
    }
  }

  // ------------------------------------------------------------------------
  // Categorías: diálogo
  // ------------------------------------------------------------------------

  function abrirCategoriaModal(categoria) {
    estado.modalCategoria = categoria
      ? { id: categoria.id, nombre: categoria.nombre, tipo: categoria.tipo,
          color: categoria.color, favorita: Boolean(categoria.favorita) }
      : { id: null, nombre: '', tipo: 'GASTO', color: DB.COLORES[0], favorita: false };

    var modal = estado.modalCategoria;

    var colores = DB.COLORES.map(function (color) {
      return '<button type="button" class="color-op' + (color === modal.color ? ' seleccionado' : '') +
        '" data-accion="color-categoria" data-color="' + color +
        '" aria-label="Color ' + color + '" style="--color:' + color + '"><span></span></button>';
    }).join('');

    var html = '' +
      '<div class="campo" style="margin-top:0"><label for="cat-nombre">Nombre</label>' +
        '<input class="input" id="cat-nombre" type="text" maxlength="40" placeholder="Ej. Alimentación" value="' +
          esc(modal.nombre) + '">' +
        '<div class="texto-error" id="error-cat-nombre" hidden></div></div>' +

      '<div class="campo"><span class="campo-etiqueta">Tipo</span>' +
        '<div class="segmento" role="group" aria-label="Tipo de categoría">' +
          '<button type="button" data-accion="tipo-categoria" data-tipo="GASTO" class="' +
            (modal.tipo === 'GASTO' ? 'activo' : '') + '">Gasto</button>' +
          '<button type="button" data-accion="tipo-categoria" data-tipo="INGRESO" class="' +
            (modal.tipo === 'INGRESO' ? 'activo' : '') + '">Ingreso</button>' +
        '</div></div>' +

      '<div class="campo"><span class="campo-etiqueta">Color</span>' +
        '<div class="colores">' + colores + '</div></div>' +

      '<label class="fila-info" style="align-items:center;padding:12px 0;cursor:pointer">' +
        '<span><strong>Marcar como categoría favorita</strong><br>' +
          '<span class="mudo chico">Aparece primero al registrar movimientos</span></span>' +
        '<input id="cat-favorita" type="checkbox"' + (modal.favorita ? ' checked' : '') + '>' +
      '</label>';

    abrirModal({
      titulo: categoria ? 'Editar categoría' : 'Nueva categoría',
      html: html,
      botones: [
        { texto: 'Cancelar', clase: 'btn-contorno' },
        {
          texto: 'Guardar',
          clase: 'btn-primario',
          onClick: guardarCategoriaModal
        }
      ]
    });
  }

  function guardarCategoriaModal() {
    var modal = estado.modalCategoria;
    if (!modal) return true;

    var nombre = ($('#cat-nombre').value || '').trim();
    var error = $('#error-cat-nombre');
    if (!nombre) {
      error.textContent = 'Escribe un nombre para la categoría.';
      error.hidden = false;
      $('#cat-nombre').focus();
      return false;
    }

    var datos = {
      id: modal.id,
      nombre: nombre,
      tipo: modal.tipo,
      color: modal.color,
      favorita: $('#cat-favorita').checked
    };

    var resultado = guardarConAviso(function () {
      return modal.id ? DB.actualizarCategoria(datos) : DB.insertarCategoria(datos);
    });

    if (resultado === -1) {
      error.textContent = 'Ya existe una categoría con ese nombre y tipo.';
      error.hidden = false;
      return false;
    }
    if (!resultado) {
      toast('No se pudo guardar la categoría.');
      return false;
    }

    toast('Categoría guardada');
    estado.modalCategoria = null;
    render();
    return true;
  }

  // ------------------------------------------------------------------------
  // Acciones de datos
  // ------------------------------------------------------------------------

  function borrarMovimiento(id, desdeEditor) {
    confirmar({
      titulo: 'Eliminar movimiento',
      mensaje: '¿Seguro que deseas eliminar este movimiento?',
      textoOk: 'Eliminar',
      peligro: true
    }).then(function (aceptado) {
      if (!aceptado) return;
      var resultado = guardarConAviso(function () { return DB.eliminarMovimiento(id); });
      if (resultado) {
        toast('Movimiento eliminado');
        if (desdeEditor) {
          estado.editor = null;
          ir(estado.volverA || '#/inicio');
        } else {
          render();
        }
      }
    });
  }

  function borrarCategoria(id) {
    var categoria = DB.obtenerCategoria(id);
    if (!categoria) return;
    var movimientos = DB.contarMovimientosCategoria(id);
    if (movimientos > 0) {
      toast('No se puede eliminar: tiene ' + movimientos + ' movimiento(s).');
      return;
    }

    confirmar({
      titulo: 'Eliminar categoría',
      mensaje: '¿Eliminar la categoría "' + categoria.nombre + '"?',
      textoOk: 'Eliminar',
      peligro: true
    }).then(function (aceptado) {
      if (!aceptado) return;
      var resultado = guardarConAviso(function () { return DB.eliminarCategoria(id); });
      if (resultado) {
        toast('Categoría eliminada');
        render();
      }
    });
  }

  function generarCSV() {
    var resumen = DB.resumen();
    if (!resumen.movimientos) {
      toast('Todavía no hay movimientos para exportar.');
      return;
    }
    var contenido = DB.exportarCSV();
    var ahora = new Date();
    var marca = ahora.getFullYear() +
      ('0' + (ahora.getMonth() + 1)).slice(-2) +
      ('0' + ahora.getDate()).slice(-2) + '_' +
      ('0' + ahora.getHours()).slice(-2) +
      ('0' + ahora.getMinutes()).slice(-2) +
      ('0' + ahora.getSeconds()).slice(-2);
    var nombre = 'movimientos_' + marca + '.csv';

    guardarConAviso(function () { DB.guardarExportacion(nombre, contenido); });
    descargar(nombre, contenido, 'text/csv;charset=utf-8');
    toast('Archivo creado: ' + nombre);
    render();
  }

  function descargar(nombre, contenido, tipoMime) {
    var blob = new Blob([contenido], { type: tipoMime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function compartir(nombre, contenido, tipoMime) {
    var archivo;
    try {
      archivo = new File([contenido], nombre, { type: tipoMime || 'text/csv;charset=utf-8' });
    } catch (e) {
      archivo = null;
    }
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: nombre }).catch(function () {
        // El usuario canceló o el navegador lo rechazó: no se hace nada.
      });
    } else {
      descargar(nombre, contenido, tipoMime);
      toast('Se descargó el archivo para que puedas compartirlo.');
    }
  }

  function descargarRespaldo() {
    var respaldo = DB.exportarRespaldo();
    var contenido = JSON.stringify(respaldo, null, 2);
    var ahora = new Date();
    var marca = ahora.getFullYear() +
      ('0' + (ahora.getMonth() + 1)).slice(-2) +
      ('0' + ahora.getDate()).slice(-2) + '_' +
      ('0' + ahora.getHours()).slice(-2) +
      ('0' + ahora.getMinutes()).slice(-2);
    var nombre = 'respaldo_control_gastos_' + marca + '.json';
    descargar(nombre, contenido, 'application/json;charset=utf-8');
    toast('Respaldo descargado');
  }

  function leerArchivoTexto(archivo) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onload = function () { resolver(String(lector.result || '')); };
      lector.onerror = function () { rechazar(new Error('No se pudo leer el archivo.')); };
      lector.readAsText(archivo, 'UTF-8');
    });
  }

  function importarCSV(evento) {
    evento.preventDefault();
    var entrada = $('#archivo-csv');
    var archivo = entrada && entrada.files ? entrada.files[0] : null;
    if (!archivo) {
      toast('Selecciona un archivo CSV.');
      return;
    }
    var modo = $('input[name="modo-importacion"]:checked');
    var reemplazar = modo && modo.value === 'reemplazar';

    leerArchivoTexto(archivo).then(function (texto) {
      var continuar = reemplazar
        ? confirmar({
            titulo: 'Reemplazar movimientos',
            mensaje: 'Se borrarán los movimientos actuales y se cargarán los del CSV. ' +
              'Las categorías y presupuestos se conservan. ¿Continuar?',
            textoOk: 'Importar',
            peligro: true
          })
        : Promise.resolve(true);

      return continuar.then(function (aceptado) {
        if (!aceptado) return;
        var resultado;
        try {
          resultado = DB.importarCSV(texto, { reemplazar: reemplazar });
        } catch (e) {
          toast(e.message || 'No se pudo importar el archivo.');
          return;
        }
        toast('Importados: ' + resultado.importados +
          ' · Omitidos: ' + resultado.omitidos +
          (resultado.categoriasCreadas ? ' · Categorías nuevas: ' + resultado.categoriasCreadas : ''));
        render();
      });
    }).catch(function (e) {
      toast(e.message || 'No se pudo leer el archivo.');
    });
  }

  function restaurarRespaldo(evento) {
    evento.preventDefault();
    var entrada = $('#archivo-respaldo');
    var archivo = entrada && entrada.files ? entrada.files[0] : null;
    if (!archivo) {
      toast('Selecciona un archivo de respaldo.');
      return;
    }

    leerArchivoTexto(archivo).then(function (texto) {
      var objeto;
      try {
        objeto = JSON.parse(texto);
      } catch (e) {
        toast('El archivo no contiene un JSON válido.');
        return;
      }

      confirmar({
        titulo: 'Restaurar respaldo',
        mensaje: 'Se reemplazarán todos los datos actuales por los del respaldo. ¿Continuar?',
        textoOk: 'Restaurar',
        peligro: true
      }).then(function (aceptado) {
        if (!aceptado) return;
        try {
          var resumen = DB.restaurarRespaldo(objeto);
          toast('Respaldo restaurado: ' + resumen.movimientos + ' movimientos');
          render();
        } catch (e) {
          toast(e.message || 'No se pudo restaurar el respaldo.');
        }
      });
    }).catch(function (e) {
      toast(e.message || 'No se pudo leer el archivo.');
    });
  }

  function ayudaInstalar() {
    var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var html = esIOS
      ? '<ol style="margin:0;padding-left:20px;line-height:1.7">' +
          '<li>Abre esta página en <strong>Safari</strong> (no en Chrome ni en una vista previa).</li>' +
          '<li>Toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).</li>' +
          '<li>Desliza y elige <strong>Añadir a pantalla de inicio</strong>.</li>' +
          '<li>Confirma con <strong>Añadir</strong>. Aparecerá un ícono como el de cualquier app.</li>' +
        '</ol>' +
        '<p class="mudo chico mt-12">Debe estar publicada con HTTPS (GitHub Pages lo incluye). ' +
        'Una vez instalada funciona sin internet y los datos se guardan en el teléfono.</p>'
      : '<ol style="margin:0;padding-left:20px;line-height:1.7">' +
          '<li>Abre esta página en Chrome, Edge o Safari.</li>' +
          '<li>Abre el menú del navegador.</li>' +
          '<li>Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li>' +
        '</ol>' +
        '<p class="mudo chico mt-12">En iPhone el navegador debe ser Safari: Compartir → ' +
        'Añadir a pantalla de inicio.</p>';

    abrirModal({
      titulo: 'Instalar como aplicación',
      html: html,
      botones: [{ texto: 'Entendido', clase: 'btn-primario' }]
    });
  }

  // ------------------------------------------------------------------------
  // Render principal
  // ------------------------------------------------------------------------

  function render() {
    aplicarTema();

    var ruta = rutaActual();
    var info = null;

    if (ruta.vista === 'editor') {
      info = renderEditor(ruta);
      if (!info) return;
    } else {
      estado.editor = null;
      if (ruta.vista === 'inicio') info = renderInicio();
      else if (ruta.vista === 'movimientos') info = renderMovimientos();
      else if (ruta.vista === 'categorias') info = renderCategorias();
      else if (ruta.vista === 'presupuesto') info = renderPresupuesto();
      else if (ruta.vista === 'ajustes') info = renderAjustes();
      else if (ruta.vista === 'archivos') info = renderArchivos();
      else {
        ir('#/inicio');
        return;
      }
    }

    estado.vista = ruta.vista;
    configurarCabecera(info);
    $('#vista').innerHTML = info.html;
    document.body.classList.toggle('sin-nav', ruta.vista === 'editor');
    marcarNavegacion(ruta.vista);

    if (estado.ultimaRuta !== location.hash) {
      estado.ultimaRuta = location.hash;
      window.scrollTo(0, 0);
    }

    var tituloVista = $('#titulo-vista');
    tituloVista.classList.toggle('chica', ruta.vista === 'archivos');

    if (ruta.vista === 'ajustes') {
      var rango = $('#pref-umbral');
      if (rango) {
        rango.addEventListener('input', function () {
          var valor = Number(rango.value);
          var etiqueta = $('#valor-umbral');
          if (etiqueta) etiqueta.textContent = valor + '%';
          Prefs.set('umbral', valor);
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  // Eventos globales
  // ------------------------------------------------------------------------

  document.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-accion]');
    if (!boton) return;

    var accion = boton.getAttribute('data-accion');
    var id = Number(boton.getAttribute('data-id')) || 0;

    switch (accion) {
      case 'inicio-mes-ant':
      case 'inicio-mes-sig': {
        var delta = accion === 'inicio-mes-ant' ? -1 : 1;
        var nuevo = Formato.sumarMes(estado.inicioAnio, estado.inicioMes, delta);
        estado.inicioAnio = nuevo[0];
        estado.inicioMes = nuevo[1];
        render();
        break;
      }
      case 'presu-mes-ant':
      case 'presu-mes-sig': {
        var deltaP = accion === 'presu-mes-ant' ? -1 : 1;
        var nuevoP = Formato.sumarMes(estado.presuAnio, estado.presuMes, deltaP);
        estado.presuAnio = nuevoP[0];
        estado.presuMes = nuevoP[1];
        render();
        break;
      }
      case 'ir-movimientos':
        ir('#/movimientos');
        break;
      case 'ver-tarjeta':
        estado.filtros.tipo = 'TARJETA';
        estado.filtros.periodo = 'MES';
        estado.filtros.categoriaId = 0;
        ir('#/movimientos');
        break;
      case 'ir-archivos':
        ir('#/archivos');
        break;
      case 'nuevo-abono':
        abrirEditor(null, 'ABONO_TARJETA', null);
        break;
      case 'editar-movimiento':
        abrirEditor(id, null, null);
        break;
      case 'borrar-movimiento':
        evento.stopPropagation();
        borrarMovimiento(id, false);
        break;
      case 'borrar-movimiento-editor':
        if (estado.editor && estado.editor.id) borrarMovimiento(estado.editor.id, true);
        break;
      case 'tipo-movimiento': {
        sincronizarEditor();
        var tipoNuevo = boton.getAttribute('data-tipo');
        estado.editor.tipo = tipoNuevo;
        if (tipoNuevo !== 'GASTO') estado.editor.medioPago = 'EFECTIVO';
        if (tipoNuevo === 'ABONO_TARJETA') estado.editor.categoriaId = null;
        render();
        break;
      }
      case 'medio-movimiento': {
        sincronizarEditor();
        estado.editor.medioPago = boton.getAttribute('data-medio');
        render();
        break;
      }
      case 'nueva-categoria-editor':
        abrirCategoriaModal(null);
        break;
      case 'editar-categoria':
        evento.stopPropagation();
        abrirCategoriaModal(DB.obtenerCategoria(id));
        break;
      case 'borrar-categoria':
        evento.stopPropagation();
        borrarCategoria(id);
        break;
      case 'tipo-categoria': {
        if (!estado.modalCategoria) break;
        estado.modalCategoria.tipo = boton.getAttribute('data-tipo');
        $$('#modal-cuerpo [data-accion="tipo-categoria"]').forEach(function (b) {
          b.classList.toggle('activo', b.getAttribute('data-tipo') === estado.modalCategoria.tipo);
        });
        break;
      }
      case 'color-categoria': {
        if (!estado.modalCategoria) break;
        estado.modalCategoria.color = boton.getAttribute('data-color');
        $$('#modal-cuerpo .color-op').forEach(function (b) {
          b.classList.toggle('seleccionado', b === boton);
        });
        break;
      }
      case 'quitar-presupuesto':
        confirmar({
          titulo: 'Quitar presupuesto',
          mensaje: '¿Eliminar el presupuesto de este mes?',
          textoOk: 'Eliminar',
          peligro: true
        }).then(function (aceptado) {
          if (!aceptado) return;
          guardarConAviso(function () {
            DB.eliminarPresupuesto(Formato.periodo(estado.presuAnio, estado.presuMes));
          });
          toast('Presupuesto eliminado');
          render();
        });
        break;
      case 'generar-csv':
        generarCSV();
        break;
      case 'descargar-csv': {
        var archivo = DB.obtenerExportacion(id);
        if (archivo) descargar(archivo.nombre, archivo.contenido, 'text/csv;charset=utf-8');
        break;
      }
      case 'compartir-csv': {
        var compartido = DB.obtenerExportacion(id);
        if (compartido) compartir(compartido.nombre, compartido.contenido, 'text/csv;charset=utf-8');
        break;
      }
      case 'ver-csv': {
        var visto = DB.obtenerExportacion(id);
        if (!visto) break;
        abrirModal({
          titulo: visto.nombre,
          html: '<pre class="previsualizacion">' + esc(visto.contenido.slice(0, 20000)) + '</pre>' +
            (visto.contenido.length > 20000 ? '<p class="ayuda">Vista previa limitada a los primeros 20 000 caracteres.</p>' : ''),
          botones: [
            {
              texto: 'Descargar',
              clase: 'btn-contorno',
              onClick: function () { descargar(visto.nombre, visto.contenido, 'text/csv;charset=utf-8'); }
            },
            {
              texto: 'Compartir',
              clase: 'btn-contorno',
              onClick: function () { compartir(visto.nombre, visto.contenido, 'text/csv;charset=utf-8'); }
            },
            { texto: 'Cerrar', clase: 'btn-primario' }
          ]
        });
        break;
      }
      case 'borrar-csv': {
        confirmar({
          titulo: 'Eliminar archivo',
          mensaje: '¿Eliminar este archivo del historial?',
          textoOk: 'Eliminar',
          peligro: true
        }).then(function (aceptado) {
          if (!aceptado) return;
          guardarConAviso(function () { DB.eliminarExportacion(id); });
          toast('Archivo eliminado');
          render();
        });
        break;
      }
      case 'descargar-respaldo':
        descargarRespaldo();
        break;
      case 'restablecer-prefs':
        confirmar({
          titulo: 'Restablecer valores',
          mensaje: '¿Volver a la configuración de fábrica? Los datos no se borran.',
          textoOk: 'Restablecer'
        }).then(function (aceptado) {
          if (!aceptado) return;
          Prefs.restablecer();
          estado.filtros = filtrosIniciales();
          aplicarTema();
          toast('Preferencias restablecidas');
          render();
        });
        break;
      case 'borrar-todo':
        confirmar({
          titulo: 'Borrar todos los datos',
          mensaje: 'Se eliminarán todos los movimientos, presupuestos y categorías personalizadas. ' +
            'Esta acción no se puede deshacer. ¿Continuar?',
          textoOk: 'Borrar todo',
          peligro: true
        }).then(function (aceptado) {
          if (!aceptado) return;
          guardarConAviso(function () { DB.restablecerTodo(); });
          toast('Datos borrados');
          render();
        });
        break;
      case 'ayuda-instalar':
        ayudaInstalar();
        break;
      case 'ocultar-aviso':
        Prefs.set('avisoOculto', true);
        render();
        break;
      default:
        break;
    }
  });

  // Navegación por teclado en filas con role="button".
  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    var fila = evento.target.closest('.mov[data-accion], .cat[data-accion]');
    if (!fila) return;
    evento.preventDefault();
    fila.click();
  });

  // Filtros de la lista de movimientos.
  document.addEventListener('change', function (evento) {
    var filtro = evento.target.getAttribute && evento.target.getAttribute('data-filtro');
    if (filtro) {
      if (filtro === 'categoriaId') estado.filtros.categoriaId = Number(evento.target.value) || 0;
      else if (filtro === 'periodo') estado.filtros.periodo = evento.target.value;
      else if (filtro === 'tipo') estado.filtros.tipo = evento.target.value;
      render();
      return;
    }

    var preferencia = evento.target.getAttribute && evento.target.getAttribute('data-pref');
    if (preferencia) {
      Prefs.set(preferencia, evento.target.value);
      if (preferencia === 'tema') aplicarTema();
      if (preferencia === 'periodo') estado.filtros.periodo = evento.target.value;
      if (preferencia === 'moneda' || preferencia === 'periodo' || preferencia === 'orden') render();
      return;
    }
  });

  // Formularios.
  document.addEventListener('submit', function (evento) {
    var id = evento.target.id;
    if (id === 'form-movimiento') {
      guardarMovimiento(evento);
    } else if (id === 'form-presupuesto') {
      evento.preventDefault();
      var entrada = $('#presupuesto-monto');
      var monto = Formato.parseMonto(entrada.value);
      var error = $('#error-presupuesto');
      if (monto < 0) {
        error.textContent = 'Ingresa un monto mayor o igual a cero.';
        error.hidden = false;
        entrada.focus();
        return;
      }
      error.hidden = true;
      guardarConAviso(function () {
        DB.guardarPresupuesto(Formato.periodo(estado.presuAnio, estado.presuMes), monto);
      });
      toast('Presupuesto guardado');
      render();
    } else if (id === 'form-importar') {
      importarCSV(evento);
    } else if (id === 'form-restaurar') {
      restaurarRespaldo(evento);
    }
  });

  // Cabecera: atrás y acción contextual.
  $('#btn-atras').addEventListener('click', function () {
    if (estado.vista === 'editor') {
      estado.editor = null;
      ir(estado.volverA || '#/inicio');
    } else if (estado.vista === 'archivos') {
      if (window.history.length > 1) window.history.back();
      else ir('#/ajustes');
    } else {
      ir('#/inicio');
    }
  });

  $('#btn-accion').addEventListener('click', function () {
    if (estado.vista === 'categorias') {
      abrirCategoriaModal(null);
    } else {
      abrirEditor(null, 'GASTO', 'EFECTIVO');
    }
  });

  // Sombra sutil de la cabecera al hacer scroll.
  window.addEventListener('scroll', function () {
    $('#topbar').classList.toggle('scrolled', window.scrollY > 2);
  }, { passive: true });

  // Al cambiar de ruta se redibuja.
  window.addEventListener('hashchange', render);

  // ------------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------------

  function iniciar() {
    if (!location.hash) {
      try {
        history.replaceState(null, '', '#/inicio');
      } catch (e) {
        location.hash = '#/inicio';
      }
    }
    aplicarTema();
    render();

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {
          // Si falla, la app sigue funcionando en línea.
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
