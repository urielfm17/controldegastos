/* ==========================================================================
   Formato de dinero y fechas.
   Se usa en el navegador (global Formato) y en las pruebas de Node.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MONEDAS = { MXN: 'MXN', USD: 'USD', EUR: 'EUR' };

  function capitalizar(texto) {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function dosDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /**
   * Convierte "2026-11-04" en un Date local (sin desfase de zona horaria).
   */
  function aFecha(iso) {
    if (iso instanceof Date) return iso;
    if (typeof iso !== 'string') return null;
    var partes = iso.split('-');
    if (partes.length !== 3) return null;
    var anio = parseInt(partes[0], 10);
    var mes = parseInt(partes[1], 10);
    var dia = parseInt(partes[2], 10);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }

  function fechaAISO(fecha) {
    var d = fecha instanceof Date ? fecha : new Date();
    return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
  }

  function hoyISO() {
    return fechaAISO(new Date());
  }

  /**
   * Formatea un monto con la moneda elegida. Ej.: 1234.5 -> "$1,234.50".
   */
  function moneda(monto, monedaCodigo) {
    var codigo = MONEDAS[monedaCodigo] ? monedaCodigo : 'MXN';
    var valor = Number(monto);
    if (!isFinite(valor)) valor = 0;
    try {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: codigo,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor);
    } catch (e) {
      return '$' + valor.toFixed(2);
    }
  }

  /**
   * Convierte el texto de un campo a número.
   * Acepta "$1,234.50", "1234,50" o "1234.50". Devuelve -1 si no es válido.
   */
  function parseMonto(texto) {
    if (texto === null || texto === undefined) return -1;
    var limpio = String(texto).trim()
      .replace(/\$/g, '')
      .replace(/\s/g, '')
      .replace(/\u00A0/g, '');
    if (!limpio) return -1;

    if (limpio.indexOf(',') !== -1 && limpio.indexOf('.') !== -1) {
      limpio = limpio.replace(/,/g, '');
    } else {
      limpio = limpio.replace(',', '.');
    }

    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(limpio)) return -1;
    var valor = parseFloat(limpio);
    if (!isFinite(valor) || valor < 0) return -1;
    return valor;
  }

  function fechaVisible(iso) {
    var f = aFecha(iso);
    if (!f) return String(iso || '');
    return dosDigitos(f.getDate()) + ' ' + MESES_CORTOS[f.getMonth()] + ' ' + f.getFullYear();
  }

  function fechaCorta(iso) {
    var f = aFecha(iso);
    if (!f) return String(iso || '');
    return dosDigitos(f.getDate()) + ' ' + MESES_CORTOS[f.getMonth()];
  }

  function fechaLarga(iso) {
    var f = aFecha(iso);
    if (!f) return String(iso || '');
    return dosDigitos(f.getDate()) + ' de ' + MESES[f.getMonth()] + ' de ' + f.getFullYear();
  }

  function mesLargo(anio, mes) {
    return capitalizar(MESES[(mes - 1 + 12) % 12] + ' ' + anio);
  }

  function periodoLargo(periodoISO) {
    var partes = String(periodoISO || '').split('-');
    if (partes.length < 2) return String(periodoISO || '');
    return mesLargo(parseInt(partes[0], 10), parseInt(partes[1], 10));
  }

  function periodo(anio, mes) {
    return anio + '-' + dosDigitos(mes);
  }

  function periodoDeHoy() {
    var hoy = new Date();
    return periodo(hoy.getFullYear(), hoy.getMonth() + 1);
  }

  function mesActual() {
    var hoy = new Date();
    return [hoy.getFullYear(), hoy.getMonth() + 1];
  }

  function sumarMes(anio, mes, delta) {
    var fecha = new Date(anio, mes - 1 + delta, 1);
    return [fecha.getFullYear(), fecha.getMonth() + 1];
  }

  /** Primera y última fecha ISO de un mes. */
  function rangoMes(anio, mes) {
    var inicio = new Date(anio, mes - 1, 1);
    var fin = new Date(anio, mes, 0);
    return [fechaAISO(inicio), fechaAISO(fin)];
  }

  /** Lunes y domingo de la semana actual. */
  function rangoSemanaActual() {
    var hoy = new Date();
    var dia = hoy.getDay(); // 0 = domingo
    var desplazamiento = dia === 0 ? -6 : 1 - dia;
    var inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + desplazamiento);
    var fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    return [fechaAISO(inicio), fechaAISO(fin)];
  }

  /** Convierte SEMANA / MES / TODO en un rango de fechas. */
  function rangoPeriodo(periodoNombre) {
    if (periodoNombre === 'SEMANA') return rangoSemanaActual();
    if (periodoNombre === 'TODO') return ['0000-01-01', '9999-12-31'];
    var actual = mesActual();
    return rangoMes(actual[0], actual[1]);
  }

  function rangoLegible(periodoNombre) {
    if (periodoNombre === 'SEMANA') return 'Semana actual';
    if (periodoNombre === 'TODO') return 'Todo el historial';
    return 'Mes actual';
  }

  function fechaHoraArchivo(marca) {
    var f = marca instanceof Date ? marca : new Date(marca);
    if (isNaN(f.getTime())) return '';
    return dosDigitos(f.getDate()) + '/' + dosDigitos(f.getMonth() + 1) + '/' + f.getFullYear() +
      ' ' + dosDigitos(f.getHours()) + ':' + dosDigitos(f.getMinutes());
  }

  function tamanoLegible(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function nombreMes(anio, mes) {
    return mesLargo(anio, mes);
  }

  var Formato = {
    MESES: MESES,
    moneda: moneda,
    parseMonto: parseMonto,
    hoyISO: hoyISO,
    fechaAISO: fechaAISO,
    fechaVisible: fechaVisible,
    fechaCorta: fechaCorta,
    fechaLarga: fechaLarga,
    mesLargo: mesLargo,
    nombreMes: nombreMes,
    periodoLargo: periodoLargo,
    periodo: periodo,
    periodoDeHoy: periodoDeHoy,
    mesActual: mesActual,
    sumarMes: sumarMes,
    rangoMes: rangoMes,
    rangoSemanaActual: rangoSemanaActual,
    rangoPeriodo: rangoPeriodo,
    rangoLegible: rangoLegible,
    fechaHoraArchivo: fechaHoraArchivo,
    tamanoLegible: tamanoLegible
  };

  raiz.Formato = Formato;
  if (typeof module !== 'undefined' && module.exports) module.exports = Formato;
})(typeof window !== 'undefined' ? window : globalThis);
