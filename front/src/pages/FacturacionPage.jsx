import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchPacienteDatos,
  fetchPresupuestoItems,
  fetchPresupuestoProfesionales,
  fetchPresupuestoSiguienteNumero,
  fetchPresupuestoTarifas,
  fetchPresupuestoTratamientos,
  messageFromAxiosError,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCompany } from '../auth/CompanyContext';
import { PersonaBuscarModal } from '../components/PersonaBuscarModal';
import { TabPanel, Tabs } from '../components/Tabs';
import {
  FORMAS_PAGO,
  PARENTESCOS,
  PRESUPUESTO_TABS,
  TIPOS_BENEFICIARIO,
  TIPOS_PAGO,
  applyLineaPatch,
  calcFila,
  calcTotales,
  emptyPresupuestoForm,
  filaTratamientoVacia,
  formatMoney,
  lineaKey,
  mergeLineasDesdeItems,
  parseMoneyDraft,
  pctFromPesos,
  pesosEnLetras,
  pesosFromPct,
  toggleSeleccionLinea,
} from '../facturacion/presupuestoMock';

const AVISO_SIN_PERSISTIR =
  'Aún no disponible: el presupuesto no se guarda hasta conectar la API.';

function FieldRow({ label, children, className = '' }) {
  return (
    <label className={`presupuesto-field ${className}`}>
      <span className="presupuesto-field-label">{label}</span>
      <span className="presupuesto-field-control">{children}</span>
    </label>
  );
}

function SearchField({ value, onSearch, disabled, placeholder = '' }) {
  return (
    <span className="presupuesto-search-wrap">
      <input
        type="text"
        value={value}
        readOnly
        disabled={disabled}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="secondary presupuesto-search-btn"
        onClick={onSearch}
        disabled={disabled}
        title="Buscar"
      >
        **
      </button>
    </span>
  );
}

function MoneyInput({ value, onChange, className = '' }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const n = Number(value) || 0;
  const display = focused ? draft : String(n);

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onFocus={() => {
        setFocused(true);
        setDraft(n === 0 ? '' : String(n));
      }}
      onChange={(e) => {
        const parsed = parseMoneyDraft(e.target.value);
        setDraft(parsed.text);
        onChange(parsed.number);
      }}
      onBlur={() => {
        const parsed = parseMoneyDraft(draft);
        setFocused(false);
        setDraft('');
        onChange(parsed.number);
      }}
    />
  );
}

export default function FacturacionPage() {
  const navigate = useNavigate();
  const { documentoEmpresa, nombreComercialEmpresa } = useCompany();
  const { user } = useAuth();
  const [tab, setTab] = useState('tratamiento');
  const [form, setForm] = useState(emptyPresupuestoForm);
  const [picker, setPicker] = useState(null);
  const [aviso, setAviso] = useState('');
  const [filaFoco, setFilaFoco] = useState('');
  const [catalogo, setCatalogo] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [cargandoSel, setCargandoSel] = useState({});

  const totales = useMemo(() => calcTotales(form), [form]);
  const tratamientosSel = catalogo.filter(
    (t) => form.tratamientos[t.id]?.sel,
  );
  const usuarioPie =
    String(user?.nombreUsuario ?? '').trim() ||
    String(user?.username ?? '').trim() ||
    '—';

  function patch(partial) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function patchTratamiento(id, partial) {
    setForm((prev) => ({
      ...prev,
      tratamientos: {
        ...prev.tratamientos,
        [id]: { ...prev.tratamientos[id], ...partial },
      },
    }));
  }

  function patchLinea(tratamientoId, codigo, partial) {
    const key = lineaKey(tratamientoId, codigo);
    setForm((prev) => ({
      ...prev,
      lineas: {
        ...prev.lineas,
        [key]: applyLineaPatch(prev.lineas[key], partial),
      },
    }));
  }

  function toggleSeleccionProcedimiento(tratamientoId, codigo) {
    const key = lineaKey(tratamientoId, codigo);
    setForm((prev) => ({
      ...prev,
      lineas: {
        ...prev.lineas,
        [key]: toggleSeleccionLinea(prev.lineas[key]),
      },
    }));
  }

  useEffect(() => {
    let cancel = false;
    if (!documentoEmpresa) {
      setCatalogo([]);
      setTarifas([]);
      return undefined;
    }
    setCargandoCatalogo(true);
    (async () => {
      try {
        const [trats, tars, nro] = await Promise.all([
          fetchPresupuestoTratamientos(documentoEmpresa),
          fetchPresupuestoTarifas(documentoEmpresa),
          fetchPresupuestoSiguienteNumero(documentoEmpresa),
        ]);
        if (cancel) return;
        const list = Array.isArray(trats)
          ? trats.map((t) => ({
              id: String(t.idTratamiento),
              idTratamiento: t.idTratamiento,
              descripcion: t.descripcion,
              idSubcapitulo: t.idSubcapitulo,
            }))
          : [];
        const tarList = Array.isArray(tars) ? tars : [];
        setCatalogo(list);
        setTarifas(tarList);
        setForm((prev) => {
          const tratamientos = { ...prev.tratamientos };
          for (const t of list) {
            if (!tratamientos[t.id]) tratamientos[t.id] = filaTratamientoVacia();
          }
          const numero =
            String(nro?.numero ?? '').trim() || prev.numero || '—';
          return { ...prev, tratamientos, numero };
        });
      } catch (e) {
        if (!cancel) {
          setCatalogo([]);
          setTarifas([]);
          setAviso(
            await messageFromAxiosError(
              e,
              'No se pudieron cargar tratamientos y tarifas de la sede.',
            ),
          );
        }
      } finally {
        if (!cancel) setCargandoCatalogo(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoEmpresa]);

  async function nuevo() {
    const next = emptyPresupuestoForm();
    const tratamientos = {};
    for (const t of catalogo) tratamientos[t.id] = filaTratamientoVacia();
    let numero = next.numero;
    if (documentoEmpresa) {
      try {
        const nro = await fetchPresupuestoSiguienteNumero(documentoEmpresa);
        numero = String(nro?.numero ?? '').trim() || numero;
      } catch {
        /* se deja — */
      }
    }
    setForm({ ...next, tratamientos, numero });
    setTab('tratamiento');
    setAviso('');
    setFilaFoco('');
    setCargandoSel({});
  }

  async function cargarProfesionalesTratamiento(id) {
    const profesionales = await fetchPresupuestoProfesionales(
      id,
      documentoEmpresa,
    );
    const profList = Array.isArray(profesionales) ? profesionales : [];
    setForm((prev) => ({
      ...prev,
      profesionalesPorTratamiento: {
        ...prev.profesionalesPorTratamiento,
        [id]: profList,
      },
    }));
    return profList;
  }

  async function cargarDetalleTratamiento(id, idTipoTarifa) {
    const [items, profesionales] = await Promise.all([
      fetchPresupuestoItems(id, documentoEmpresa, idTipoTarifa),
      fetchPresupuestoProfesionales(id, documentoEmpresa),
    ]);
    const itemList = Array.isArray(items) ? items : [];
    const profList = Array.isArray(profesionales) ? profesionales : [];
    setForm((prev) => ({
      ...prev,
      itemsPorTratamiento: {
        ...prev.itemsPorTratamiento,
        [id]: itemList,
      },
      profesionalesPorTratamiento: {
        ...prev.profesionalesPorTratamiento,
        [id]: profList,
      },
      lineas: mergeLineasDesdeItems(prev.lineas, id, itemList),
      gruposAbiertos: { ...prev.gruposAbiertos, [id]: true },
    }));
    return { itemList, profList };
  }

  async function onToggleSel(id, checked) {
    patchTratamiento(id, { sel: checked });
    if (!checked) return;
    const tarifa = form.tratamientos[id]?.tarifa;
    setCargandoSel((s) => ({ ...s, [id]: true }));
    try {
      if (tarifa) {
        await cargarDetalleTratamiento(id, tarifa);
      } else {
        await cargarProfesionalesTratamiento(id);
      }
      setAviso('');
    } catch (e) {
      setAviso(
        await messageFromAxiosError(
          e,
          'No se pudieron cargar procedimientos, profesionales o tarifas.',
        ),
      );
    } finally {
      setCargandoSel((s) => ({ ...s, [id]: false }));
    }
  }

  async function onChangeTarifa(id, idTipoTarifa) {
    patchTratamiento(id, { tarifa: idTipoTarifa });
    if (!form.tratamientos[id]?.sel || !idTipoTarifa) return;
    setCargandoSel((s) => ({ ...s, [id]: true }));
    try {
      await cargarDetalleTratamiento(id, idTipoTarifa);
    } catch (e) {
      setAviso(
        await messageFromAxiosError(e, 'No se pudieron actualizar los precios.'),
      );
    } finally {
      setCargandoSel((s) => ({ ...s, [id]: false }));
    }
  }

  function noDisponible() {
    setAviso(AVISO_SIN_PERSISTIR);
  }

  async function onPickPersona(persona) {
    const actual = picker;
    setPicker(null);
    if (!actual) return;
    if (actual === 'paciente') {
      let nombres = persona.nombre;
      let direccion = '';
      let telefono = '';
      try {
        const data = await fetchPacienteDatos(persona.documento);
        const d = data?.demografia ?? {};
        nombres = String(d.nombreCompleto ?? '').trim() || persona.nombre;
        direccion = String(d.direccion ?? '').trim();
        telefono = String(d.telefono ?? '').trim();
      } catch {
        /* nombres del listado */
      }
      patch({
        documentoPaciente: persona.documento,
        nombres,
        direccion,
        barrio: 'Sin Asignar',
        telefono,
      });
      return;
    }
    if (actual === 'beneficiario') {
      patch({
        documentoBeneficiario: persona.documento,
        nombreBeneficiario: persona.nombre,
      });
      return;
    }
    if (actual === 'responsable') {
      patch({
        documentoResponsable: persona.documento,
        nombreResponsable: persona.nombre,
      });
      return;
    }
    if (actual === 'entidad') {
      patch({
        documentoEntidad: persona.documento,
        nombreEntidad: persona.nombre,
        entidadRemite: true,
      });
    }
  }

  const pickerMeta = {
    paciente: {
      title: 'Buscar paciente',
      hint: 'Al elegir se cargan nombres, dirección y teléfono.',
    },
    beneficiario: {
      title: 'Buscar beneficiario',
      hint: 'Documento del beneficiario cuando aplica.',
    },
    responsable: {
      title: 'Buscar responsable',
      hint: 'Usuario o responsable del presupuesto.',
    },
    entidad: {
      title: 'Entidad que remite',
      hint: 'Busque la entidad o persona que remite.',
    },
  };

  return (
    <div className="page presupuesto-page">
      <div className="presupuesto-toolbar">
        <h1>Presupuesto</h1>
        <div className="presupuesto-toolbar-actions">
          <button type="button" className="secondary" onClick={nuevo}>
            Nuevo
          </button>
          <button type="button" className="secondary" onClick={noDisponible}>
            Eliminar
          </button>
          <button type="button" className="secondary" onClick={noDisponible}>
            Anular
          </button>
          <button type="button" className="secondary" onClick={noDisponible}>
            Imprimir
          </button>
          <button type="button" className="secondary" onClick={noDisponible}>
            Buscar
          </button>
          <button type="button" className="secondary" onClick={noDisponible}>
            Guardar
          </button>
          <button type="button" className="secondary" onClick={noDisponible}>
            Cálculo de Cuotas
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => navigate('/principal/home')}
          >
            Salir
          </button>
        </div>
      </div>

      {aviso ? (
        <div className="alert alert-warn presupuesto-aviso" role="status">
          {aviso}
        </div>
      ) : null}

      <Tabs
        tabs={PRESUPUESTO_TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Pestañas del presupuesto"
        idPrefix="presupuesto"
      />

      <TabPanel id="tratamiento" value={tab} idPrefix="presupuesto">
        <div className="presupuesto-split">
          <section className="presupuesto-col">
            <h2>Información Presupuesto</h2>
            <FieldRow label="Presupuesto No">
              <input type="text" value={form.numero} readOnly />
            </FieldRow>
            <FieldRow label="Fecha Inicio Tratamiento">
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => patch({ fechaInicio: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Fecha Aproximada Fin Tto.">
              <input
                type="date"
                value={form.fechaFin}
                onChange={(e) => patch({ fechaFin: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Moneda Presupuesto">
              <select
                value={form.moneda}
                onChange={(e) => patch({ moneda: e.target.value })}
              >
                <option>Peso</option>
              </select>
            </FieldRow>
            <FieldRow label="Sede">
              <input
                type="text"
                value={nombreComercialEmpresa || '—'}
                readOnly
              />
            </FieldRow>

            <h2>Información Paciente</h2>
            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.afiliado}
                onChange={(e) => patch({ afiliado: e.target.checked })}
              />
              Afiliado
            </label>
            <FieldRow label="Documento">
              <SearchField
                value={form.documentoPaciente}
                onSearch={() => setPicker('paciente')}
              />
            </FieldRow>
            <FieldRow label="Nombres">
              <input type="text" value={form.nombres} readOnly />
            </FieldRow>
            <FieldRow label="Dirección">
              <input type="text" value={form.direccion} readOnly />
            </FieldRow>
            <FieldRow label="Barrio">
              <input type="text" value={form.barrio} readOnly />
            </FieldRow>
            <FieldRow label="Teléfono">
              <input type="text" value={form.telefono} readOnly />
            </FieldRow>
            <div className="presupuesto-inline-fields">
              <FieldRow label="No Póliza">
                <input
                  type="text"
                  value={form.noPoliza}
                  onChange={(e) => patch({ noPoliza: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="Cita">
                <input
                  type="text"
                  value={form.cita}
                  onChange={(e) => patch({ cita: e.target.value })}
                />
              </FieldRow>
            </div>
            <FieldRow label="Remisión">
              <input
                type="text"
                value={form.remision}
                onChange={(e) => patch({ remision: e.target.value })}
              />
            </FieldRow>

            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.beneficiario}
                onChange={(e) => patch({ beneficiario: e.target.checked })}
              />
              Beneficiario
            </label>
            <FieldRow label="Documento">
              <SearchField
                value={form.documentoBeneficiario}
                disabled={!form.beneficiario}
                onSearch={() => setPicker('beneficiario')}
              />
            </FieldRow>
            {form.nombreBeneficiario ? (
              <p className="muted presupuesto-nombre-extra">{form.nombreBeneficiario}</p>
            ) : null}
            <FieldRow label="Tipo Beneficiario">
              <select
                value={form.tipoBeneficiario}
                disabled={!form.beneficiario}
                onChange={(e) => patch({ tipoBeneficiario: e.target.value })}
              >
                {TIPOS_BENEFICIARIO.map((o) => (
                  <option key={o.id || 'vacio'} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Parentesco">
              <select
                value={form.parentesco}
                disabled={!form.beneficiario}
                onChange={(e) => patch({ parentesco: e.target.value })}
              >
                {PARENTESCOS.map((o) => (
                  <option key={o.id || 'vacio'} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldRow>
          </section>

          <section className="presupuesto-col">
            <h2>Seleccione los Tratamientos</h2>
            {!documentoEmpresa ? (
              <p className="muted">Seleccione la empresa de trabajo para ver tratamientos.</p>
            ) : cargandoCatalogo ? (
              <p className="muted">Cargando tratamientos y tarifas…</p>
            ) : catalogo.length === 0 ? (
              <p className="muted">No hay tratamientos activos para esta sede.</p>
            ) : (
            <div className="presupuesto-table-wrap">
              <table className="presupuesto-table">
                <thead>
                  <tr>
                    <th>Descripción Tratamiento</th>
                    <th>Sel</th>
                    <th>Profesional Responsable</th>
                    <th>Tarifa</th>
                    <th>Fin Tto.</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogo.map((t) => {
                    const row = form.tratamientos[t.id];
                    const profs = form.profesionalesPorTratamiento[t.id] ?? [];
                    const loading = !!cargandoSel[t.id];
                    return (
                      <tr key={t.id}>
                        <td>{t.descripcion}</td>
                        <td className="presupuesto-td-check">
                          <input
                            type="checkbox"
                            checked={!!row?.sel}
                            disabled={loading}
                            onChange={(e) => onToggleSel(t.id, e.target.checked)}
                          />
                        </td>
                        <td>
                          <select
                            value={row?.profesional ?? ''}
                            disabled={!row?.sel || loading}
                            onChange={(e) =>
                              patchTratamiento(t.id, {
                                profesional: e.target.value,
                              })
                            }
                          >
                            <option value="">
                              {loading
                                ? 'Cargando…'
                                : row?.sel && !profs.length
                                  ? 'Sin profesionales'
                                  : '—'}
                            </option>
                            {profs.map((p) => (
                              <option
                                key={p.documentoProfesional}
                                value={p.documentoProfesional}
                              >
                                {p.nombreProfesional || p.documentoProfesional}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={row?.tarifa ?? ''}
                            disabled={!row?.sel || loading || tarifas.length === 0}
                            onChange={(e) => onChangeTarifa(t.id, e.target.value)}
                          >
                            <option value="">
                              {tarifas.length ? '—' : 'Sin tarifas'}
                            </option>
                            {tarifas.map((tar) => (
                              <option
                                key={tar.idTipoTarifa}
                                value={String(tar.idTipoTarifa)}
                              >
                                {tar.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={row?.finTto ?? ''}
                            onChange={(e) =>
                              patchTratamiento(t.id, { finTto: e.target.value })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            <h2>Información Adicional (entidad que remite, observaciones)</h2>
            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.entidadRemite}
                onChange={(e) => patch({ entidadRemite: e.target.checked })}
              />
              Entidad Que Remite
            </label>
            <FieldRow label="Entidad">
              <SearchField
                value={form.nombreEntidad || form.documentoEntidad}
                disabled={!form.entidadRemite}
                onSearch={() => setPicker('entidad')}
              />
            </FieldRow>
            <FieldRow label="Observaciones" className="presupuesto-field--stack">
              <textarea
                rows={4}
                value={form.observaciones}
                onChange={(e) => patch({ observaciones: e.target.value })}
              />
            </FieldRow>
          </section>
        </div>
      </TabPanel>

      <TabPanel id="procedimientos" value={tab} idPrefix="presupuesto">
        {tratamientosSel.length === 0 ? (
          <p className="muted presupuesto-empty">
            Marque tratamientos en Información Tratamiento para ver el listado a
            facturar.
          </p>
        ) : (
          <div className="presupuesto-table-wrap presupuesto-table-wrap--tall">
            <table className="presupuesto-table presupuesto-table--proc">
              <thead>
                <tr>
                  <th>Procedimientos</th>
                  <th>Precio</th>
                  <th>Can</th>
                  <th>Desc %</th>
                  <th>Desc $</th>
                  <th>Iva %</th>
                  <th>Iva $</th>
                  <th>Observaciones</th>
                  <th>Subtotal</th>
                  <th>Rev</th>
                </tr>
              </thead>
              <tbody>
                {tratamientosSel.map((t) => {
                  const items = form.itemsPorTratamiento[t.id] ?? [];
                  const visible = form.verSoloSeleccionados
                    ? items.filter((p) => {
                        const linea = form.lineas[lineaKey(t.id, p.codigo)];
                        return (Number(linea?.can) || 0) > 0;
                      })
                    : items;
                  const abierto = form.gruposAbiertos[t.id] !== false;
                  const sumaGrupo = formatMoney(totales.porTratamiento[t.id] || 0);
                  return (
                    <TratamientoGrupo
                      key={t.id}
                      tratamiento={t}
                      abierto={abierto}
                      sumaGrupo={sumaGrupo}
                      items={visible}
                      form={form}
                      filaFoco={filaFoco}
                      onToggle={() =>
                        patch({
                          gruposAbiertos: {
                            ...form.gruposAbiertos,
                            [t.id]: !abierto,
                          },
                        })
                      }
                      onFocusFila={setFilaFoco}
                      onPatchLinea={patchLinea}
                      onToggleSeleccion={toggleSeleccionProcedimiento}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="presupuesto-proc-pie">
          <div className="presupuesto-proc-filters">
            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.verDecidua}
                onChange={(e) => patch({ verDecidua: e.target.checked })}
              />
              Ver dentición decidua
            </label>
            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.verMixta}
                onChange={(e) => patch({ verMixta: e.target.checked })}
              />
              Ver dentición mixta
            </label>
            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.verPermanente}
                onChange={(e) => patch({ verPermanente: e.target.checked })}
              />
              Ver dentición permanente
            </label>
            <label className="presupuesto-check">
              <input
                type="checkbox"
                checked={form.verSoloSeleccionados}
                onChange={(e) =>
                  patch({ verSoloSeleccionados: e.target.checked })
                }
              />
              Ver sólo los tratamientos seleccionados
            </label>
          </div>
          <div className="presupuesto-totales">
            <FieldRow label="Des Adicional $">
              <MoneyInput
                value={form.desAdicionalPesos}
                onChange={(v) =>
                  patch({
                    desAdicionalPesos: v,
                    desAdicionalPct: pctFromPesos(totales.neto, v),
                  })
                }
              />
            </FieldRow>
            <FieldRow label="Des Adicional %">
              <MoneyInput
                value={form.desAdicionalPct}
                onChange={(v) =>
                  patch({
                    desAdicionalPct: v,
                    desAdicionalPesos: pesosFromPct(totales.neto, v),
                  })
                }
              />
            </FieldRow>
            <dl className="presupuesto-totales-dl">
              <div>
                <dt>(+) Subtotal</dt>
                <dd>{formatMoney(totales.subtotal)}</dd>
              </div>
              <div>
                <dt>(+) Iva</dt>
                <dd>{formatMoney(totales.iva)}</dd>
              </div>
              <div className="presupuesto-totales-desc">
                <dt>(-) Desc. Adic.</dt>
                <dd>{formatMoney(totales.descAdic)}</dd>
              </div>
              <div className="presupuesto-total-row">
                <dt>Valor Total</dt>
                <dd>{formatMoney(totales.valorTotal)}</dd>
              </div>
            </dl>
            <p className="presupuesto-letras">{pesosEnLetras(totales.valorTotal)}</p>
          </div>
        </div>
      </TabPanel>

      <TabPanel id="formaPago" value={tab} idPrefix="presupuesto">
        <div className="presupuesto-pago-grid">
          <section className="presupuesto-col">
            <h2>Forma de Pago</h2>
            <FieldRow label="Tipo de Pago">
              <select
                value={form.tipoPago}
                onChange={(e) => patch({ tipoPago: e.target.value })}
              >
                <option value="">—</option>
                {TIPOS_PAGO.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} {o.label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Forma de Pago">
              <select
                value={form.formaPago}
                onChange={(e) => patch({ formaPago: e.target.value })}
              >
                <option value="">—</option>
                {FORMAS_PAGO.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} {o.label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Responsable">
              <SearchField
                value={form.documentoResponsable}
                onSearch={() => setPicker('responsable')}
              />
            </FieldRow>
            <input
              type="text"
              readOnly
              value={form.nombreResponsable}
              placeholder="Nombre del responsable"
            />

            <h2>Información cuotas (cuota inicial)</h2>
            <CuotasVacias />
            <h2>Información cuotas (capital a financiar)</h2>
            <CuotasVacias />
          </section>

          <section className="presupuesto-col">
            <h2>Valor por Tratamiento</h2>
            {tratamientosSel.length === 0 ? (
              <p className="muted">No hay tratamientos marcados.</p>
            ) : (
              <table className="presupuesto-table">
                <thead>
                  <tr>
                    <th>Tratamiento</th>
                    <th>Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tratamientosSel.map((t) => (
                    <tr key={t.id}>
                      <td>{t.descripcion}</td>
                      <td className="presupuesto-num">
                        {formatMoney(totales.porTratamiento[t.id] || 0)}
                      </td>
                      <td className="presupuesto-td-check">
                        <input
                          type="checkbox"
                          checked={!!form.tratamientoChecks[t.id]}
                          onChange={(e) =>
                            patch({
                              tratamientoChecks: {
                                ...form.tratamientoChecks,
                                [t.id]: e.target.checked,
                              },
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="presupuesto-col">
            <h2>Información</h2>
            <FieldRow label="Plan de Pago">
              <input
                type="text"
                value={form.planPago}
                onChange={(e) => patch({ planPago: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Periodo de Pago">
              <input
                type="text"
                value={form.periodoPago}
                onChange={(e) => patch({ periodoPago: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Tipo de Cuota">
              <input
                type="text"
                value={form.tipoCuota}
                onChange={(e) => patch({ tipoCuota: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Inicio Plan de Pago">
              <input
                type="date"
                value={form.inicioPlanPago}
                onChange={(e) => patch({ inicioPlanPago: e.target.value })}
              />
            </FieldRow>

            <h2>Información Cuota Inicial</h2>
            <FieldRow label="Valor % Cuota Inicial">
              <MoneyInput
                value={form.valorPctCuotaInicial}
                onChange={(v) => patch({ valorPctCuotaInicial: v })}
              />
            </FieldRow>
            <FieldRow label="Valor $ Cuota Inicial">
              <MoneyInput
                value={form.valorPesosCuotaInicial}
                onChange={(v) => patch({ valorPesosCuotaInicial: v })}
              />
            </FieldRow>
            <FieldRow label="Número de Cuotas">
              <MoneyInput
                value={form.numeroCuotasInicial}
                onChange={(v) => patch({ numeroCuotasInicial: v })}
              />
            </FieldRow>
            <FieldRow label="Fecha Primera Cuota">
              <input
                type="date"
                value={form.fechaPrimeraCuotaInicial}
                onChange={(e) =>
                  patch({ fechaPrimeraCuotaInicial: e.target.value })
                }
              />
            </FieldRow>

            <h2>Información Capital a Financiar</h2>
            <FieldRow label="Capital a Financiar">
              <MoneyInput
                value={form.capitalFinanciar}
                onChange={(v) => patch({ capitalFinanciar: v })}
              />
            </FieldRow>
            <FieldRow label="Número de Cuotas">
              <MoneyInput
                value={form.numeroCuotasCapital}
                onChange={(v) => patch({ numeroCuotasCapital: v })}
              />
            </FieldRow>
            <FieldRow label="Valor % Interés">
              <MoneyInput
                value={form.valorPctInteres}
                onChange={(v) => patch({ valorPctInteres: v })}
              />
            </FieldRow>
            <FieldRow label="Valor % Interés Mora">
              <MoneyInput
                value={form.valorPctInteresMora}
                onChange={(v) => patch({ valorPctInteresMora: v })}
              />
            </FieldRow>
            <FieldRow label="Fecha Primera Cuota">
              <input
                type="date"
                value={form.fechaPrimeraCuotaCapital}
                onChange={(e) =>
                  patch({ fechaPrimeraCuotaCapital: e.target.value })
                }
              />
            </FieldRow>
            <FieldRow label="Valor Total Tratamiento">
              <input
                type="text"
                readOnly
                value={formatMoney(totales.valorTotal)}
              />
            </FieldRow>
          </section>
        </div>
      </TabPanel>

      <TabPanel id="adicionales" value={tab} idPrefix="presupuesto">
        <p className="muted presupuesto-empty">
          Procedimientos Adicionales se documentará con la captura de Ceere. No
          hay campos inventados en esta pestaña.
        </p>
      </TabPanel>

      <p className="presupuesto-usuario">Usuario: {usuarioPie}</p>

      {picker ? (
        <PersonaBuscarModal
          title={pickerMeta[picker].title}
          hint={pickerMeta[picker].hint}
          onClose={() => setPicker(null)}
          onPick={onPickPersona}
        />
      ) : null}
    </div>
  );
}

function clicEnControl(el) {
  return Boolean(el?.closest?.('input, select, textarea, button, a, label'));
}

function TratamientoGrupo({
  tratamiento,
  abierto,
  sumaGrupo,
  items,
  form,
  filaFoco,
  onToggle,
  onFocusFila,
  onPatchLinea,
  onToggleSeleccion,
}) {
  return (
    <>
      <tr className="presupuesto-group-row">
        <td>
          <button
            type="button"
            className="presupuesto-group-toggle"
            onClick={onToggle}
            aria-expanded={abierto}
          >
            {abierto ? '−' : '+'} {tratamiento.descripcion}
          </button>
        </td>
        <td colSpan={8} />
        <td className="presupuesto-num presupuesto-group-sum">{sumaGrupo}</td>
      </tr>
      {abierto
        ? items.map((p) => {
            const key = lineaKey(tratamiento.id, p.codigo);
            const linea = form.lineas[key];
            const calc = calcFila(linea);
            const foco = filaFoco === key;
            const seleccionada = (Number(linea?.can) || 0) > 0;
            const clases = [
              seleccionada ? 'is-selected' : '',
              foco ? 'is-focused' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <tr
                key={key}
                className={clases || undefined}
                onFocusCapture={() => onFocusFila(key)}
                onClick={(e) => {
                  if (clicEnControl(e.target)) return;
                  onToggleSeleccion(tratamiento.id, p.codigo);
                }}
              >
                <td>
                  <span className="presupuesto-proc-name">
                    {p.codigo} - {p.descripcion}
                    {foco ? (
                      <button
                        type="button"
                        className="secondary presupuesto-ellipsis"
                        title="Detalle (aún no disponible)"
                      >
                        …
                      </button>
                    ) : null}
                  </span>
                </td>
                <td>
                  <MoneyInput
                    value={linea?.precio ?? 0}
                    onChange={(v) =>
                      onPatchLinea(tratamiento.id, p.codigo, { precio: v })
                    }
                  />
                </td>
                <td>
                  <MoneyInput
                    value={linea?.can ?? 0}
                    onChange={(v) =>
                      onPatchLinea(tratamiento.id, p.codigo, { can: v })
                    }
                  />
                </td>
                <td>
                  <MoneyInput
                    value={linea?.descPct ?? 0}
                    onChange={(v) =>
                      onPatchLinea(tratamiento.id, p.codigo, { descPct: v })
                    }
                  />
                </td>
                <td>
                  <MoneyInput
                    value={linea?.descPesos ?? 0}
                    onChange={(v) =>
                      onPatchLinea(tratamiento.id, p.codigo, { descPesos: v })
                    }
                  />
                </td>
                <td>
                  <MoneyInput
                    value={linea?.ivaPct ?? 0}
                    onChange={(v) =>
                      onPatchLinea(tratamiento.id, p.codigo, {
                        ivaPct: v,
                        ivaPesos: 0,
                      })
                    }
                  />
                </td>
                <td>
                  <MoneyInput
                    value={calc.iva}
                    onChange={(v) =>
                      onPatchLinea(tratamiento.id, p.codigo, {
                        ivaPesos: v,
                        ivaPct: 0,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={linea?.observaciones ?? ''}
                    onChange={(e) =>
                      onPatchLinea(tratamiento.id, p.codigo, {
                        observaciones: e.target.value,
                      })
                    }
                  />
                </td>
                <td className="presupuesto-num">{formatMoney(calc.subtotal)}</td>
                <td className="presupuesto-num">{formatMoney(0)}</td>
              </tr>
            );
          })
        : null}
    </>
  );
}

function CuotasVacias() {
  return (
    <div className="presupuesto-table-wrap">
      <table className="presupuesto-table presupuesto-table--cuotas">
        <thead>
          <tr>
            <th>Cuota No.</th>
            <th>No. días</th>
            <th>Cap.Falt</th>
            <th>Int.Cuota</th>
            <th>Cap.Cuota</th>
            <th>Vlr.Pagar</th>
            <th>Cuota de</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={7} className="muted">
              Se llena con Cálculo de Cuotas (aún no disponible).
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
