export const TIPOS_PAGO = [
  {
    id: '2',
    label: 'Crear un plan de pago por todo el presupuesto (aprobado por el paciente)',
  },
  {
    id: '3',
    label:
      'Crear un plan de pago para cada tratamiento del presupuesto (aprobado por el paciente)',
  },
  {
    id: '4',
    label: 'Guardar el presupuesto, proceso diagnóstico (sin aprobar por el paciente)',
  },
];

export const FORMAS_PAGO = [
  { id: '4', label: 'Contado' },
  { id: '5', label: 'EPS, Entidad Prepago' },
  { id: '3', label: 'Plan de Pago' },
];

export const TIPOS_BENEFICIARIO = [
  { id: '', label: '' },
  { id: 'titular', label: 'Titular' },
  { id: 'beneficiario', label: 'Beneficiario' },
];

export const PARENTESCOS = [
  { id: '', label: '' },
  { id: 'hijo', label: 'Hijo(a)' },
  { id: 'conyuge', label: 'Cónyuge' },
  { id: 'padre', label: 'Padre / Madre' },
  { id: 'otro', label: 'Otro' },
];

export const PRESUPUESTO_TABS = [
  { id: 'tratamiento', label: 'Información Tratamiento' },
  { id: 'procedimientos', label: 'Procedimientos' },
  { id: 'formaPago', label: 'Forma de Pago' },
  { id: 'adicionales', label: 'Procedimientos Adicionales' },
];

export function ymdHoy() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function lineaVacia(precio = 0) {
  return {
    precio: Number(precio) || 0,
    can: 0,
    descPct: 0,
    descPesos: 0,
    ivaPct: 0,
    ivaPesos: 0,
    observaciones: '',
  };
}

export function lineaKey(tratamientoId, codigo) {
  return `${tratamientoId}:${codigo}`;
}

export const OBS_REALIZAR_TRATAMIENTO = 'Realizar tratamiento';

export function pesosFromPct(base, pct) {
  return Math.round((Number(base) || 0) * ((Number(pct) || 0) / 100));
}

export function pctFromPesos(base, pesos) {
  const b = Number(base) || 0;
  if (b <= 0) return 0;
  return Math.round(((Number(pesos) || 0) / b) * 100);
}

export function applyLineaPatch(linea, partial) {
  const next = { ...(linea ?? lineaVacia()), ...partial };
  const base = (Number(next.precio) || 0) * (Number(next.can) || 0);
  const tocaBase =
    Object.prototype.hasOwnProperty.call(partial, 'precio') ||
    Object.prototype.hasOwnProperty.call(partial, 'can');
  const tocaPct = Object.prototype.hasOwnProperty.call(partial, 'descPct');
  const tocaPesos = Object.prototype.hasOwnProperty.call(partial, 'descPesos');
  if (tocaPesos && !tocaPct) {
    next.descPct = pctFromPesos(base, next.descPesos);
  } else if (tocaPct && !tocaPesos) {
    next.descPesos = pesosFromPct(base, next.descPct);
  } else if (tocaBase) {
    next.descPesos = pesosFromPct(base, next.descPct);
  }
  return next;
}

export function toggleSeleccionLinea(linea) {
  const prev = linea ?? lineaVacia();
  const can = Number(prev.can) || 0;
  const obs = String(prev.observaciones ?? '');
  if (can <= 0) {
    return applyLineaPatch(prev, {
      can: 1,
      observaciones: obs.trim() ? obs : OBS_REALIZAR_TRATAMIENTO,
    });
  }
  return applyLineaPatch(prev, {
    can: 0,
    observaciones: obs.trim() === OBS_REALIZAR_TRATAMIENTO ? '' : obs,
  });
}

export function calcFila(linea) {
  const can = Number(linea?.can) || 0;
  if (can <= 0) {
    return { base: 0, desc: 0, iva: 0, neto: 0, subtotal: 0 };
  }
  const base = (Number(linea?.precio) || 0) * can;
  const descPesos = Number(linea?.descPesos) || 0;
  const desc =
    descPesos > 0 ? descPesos : pesosFromPct(base, linea?.descPct);
  const neto = Math.max(0, base - desc);
  const iva =
    (Number(linea?.ivaPesos) || 0) + neto * ((Number(linea?.ivaPct) || 0) / 100);
  return { base, desc, iva, neto, subtotal: neto + iva };
}

export function formatMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const UNIDADES = [
  '',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
];
const DIEZ = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
];
const DECENAS = [
  '',
  '',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function grupoCien(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  let out = CENTENAS[c] || '';
  if (r >= 10 && r < 20) {
    out = `${out}${out ? ' ' : ''}${DIEZ[r - 10]}`;
  } else {
    const d = Math.floor(r / 10);
    const u = r % 10;
    if (d === 2 && u > 0) {
      out = `${out}${out ? ' ' : ''}veinti${UNIDADES[u]}`;
    } else {
      if (d) out = `${out}${out ? ' ' : ''}${DECENAS[d]}`;
      if (u) out = `${out}${out && d ? ' y ' : out ? ' ' : ''}${UNIDADES[u]}`;
    }
  }
  return out.trim();
}

function numeroALetras(n) {
  const v = Math.floor(Math.abs(n));
  if (v === 0) return 'cero';
  if (v === 1) return 'un';
  const millon = Math.floor(v / 1_000_000);
  const miles = Math.floor((v % 1_000_000) / 1000);
  const resto = v % 1000;
  const parts = [];
  if (millon) {
    parts.push(millon === 1 ? 'un millón' : `${grupoCien(millon)} millones`);
  }
  if (miles) {
    parts.push(miles === 1 ? 'mil' : `${grupoCien(miles)} mil`);
  }
  if (resto) parts.push(grupoCien(resto));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function pesosEnLetras(n) {
  const entero = Math.round(Math.abs(Number(n) || 0));
  if (entero === 0) return 'pesos 00/100 M. L. V.';
  return `pesos ${numeroALetras(entero)} 00/100 M. L. V.`;
}

export function filaTratamientoVacia() {
  return { sel: false, profesional: '', tarifa: '', finTto: '' };
}

export function mergeLineasDesdeItems(lineas, tratamientoId, items) {
  const next = { ...lineas };
  for (const p of items ?? []) {
    const codigo = String(p.codigo ?? '').trim();
    if (!codigo) continue;
    const key = lineaKey(tratamientoId, codigo);
    const prev = next[key];
    next[key] = {
      precio: Number(p.precio) || 0,
      can: prev?.can ?? 0,
      descPct: prev?.descPct ?? (Number(p.descPct) || 0),
      descPesos: prev?.descPesos ?? 0,
      ivaPct: Number(p.ivaPct) || 0,
      ivaPesos: prev?.ivaPesos ?? 0,
      observaciones: prev?.observaciones ?? '',
    };
  }
  return next;
}

export function emptyPresupuestoForm() {
  const hoy = ymdHoy();
  return {
    numero: '—',
    fechaInicio: hoy,
    fechaFin: hoy,
    moneda: 'Peso',
    afiliado: true,
    documentoPaciente: '',
    nombres: '',
    direccion: '',
    barrio: 'Sin Asignar',
    telefono: '',
    noPoliza: '0000',
    cita: '',
    remision: '',
    beneficiario: false,
    documentoBeneficiario: '',
    nombreBeneficiario: '',
    tipoBeneficiario: '',
    parentesco: '',
    tratamientos: {},
    itemsPorTratamiento: {},
    profesionalesPorTratamiento: {},
    entidadRemite: false,
    documentoEntidad: '',
    nombreEntidad: '',
    observaciones: '',
    lineas: {},
    desAdicionalPesos: 0,
    desAdicionalPct: 0,
    verDecidua: false,
    verMixta: false,
    verPermanente: true,
    verSoloSeleccionados: false,
    gruposAbiertos: {},
    tipoPago: '',
    formaPago: '',
    documentoResponsable: '',
    nombreResponsable: '',
    tratamientoChecks: {},
    planPago: '',
    periodoPago: '',
    tipoCuota: '',
    inicioPlanPago: hoy,
    valorPctCuotaInicial: 0,
    valorPesosCuotaInicial: 0,
    numeroCuotasInicial: 0,
    fechaPrimeraCuotaInicial: hoy,
    capitalFinanciar: 0,
    numeroCuotasCapital: 0,
    valorPctInteres: 0,
    valorPctInteresMora: 0,
    fechaPrimeraCuotaCapital: hoy,
  };
}

export function parseMoneyDraft(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (!digits) return { text: '', number: 0 };
  const text = digits.replace(/^0+(?=\d)/, '');
  return { text, number: Number(text) || 0 };
}

export function calcTotales(form) {
  let subtotal = 0;
  let descFilas = 0;
  let iva = 0;
  const porTratamiento = {};
  for (const [id, row] of Object.entries(form.tratamientos ?? {})) {
    if (!row?.sel) {
      porTratamiento[id] = 0;
      continue;
    }
    let suma = 0;
    for (const p of form.itemsPorTratamiento?.[id] ?? []) {
      const linea = form.lineas[lineaKey(id, p.codigo)];
      const calc = calcFila(linea);
      subtotal += calc.base;
      descFilas += calc.desc;
      iva += calc.iva;
      suma += calc.subtotal;
    }
    porTratamiento[id] = suma;
  }
  const neto = Math.max(0, subtotal - descFilas);
  const extraPesos = Number(form.desAdicionalPesos) || 0;
  const extra =
    extraPesos > 0
      ? extraPesos
      : pesosFromPct(neto, form.desAdicionalPct);
  const descAdic = descFilas + extra;
  const valorTotal = Math.max(0, subtotal + iva - descAdic);
  return { subtotal, neto, iva, descAdic, valorTotal, porTratamiento };
}
