import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPacienteCatalog,
  updatePacienteDatos,
} from '../api/client';

const CATALOG_KEYS = [
  'tipo-documento',
  'sexo',
  'identidad-genero',
  'paises',
  'municipios',
  'zona-territorial',
  'etnia',
  'discapacidad',
  'ocupacion',
];

const EMPTY_FORM = {
  idTipoDocumento: '',
  documento: '',
  primerApellido: '',
  segundoApellido: '',
  primerNombre: '',
  segundoNombre: '',
  fechaNacimiento: '',
  edad: '',
  idSexo: '',
  idSexoIdentidadGenero: '',
  idPaisNacionalidad: '',
  talla: '',
  peso: '',
  imc: '',
  idPaisResidencia: '',
  idMunicipioResidencia: '',
  idZonaResidencia: '',
  direccion: '',
  idEtnia: '',
  comunidadEtnica: '',
  idDiscapacidad: '',
  telefono: '',
  idOcupacion: '',
  alergeno: '',
};

function calcEdad(fechaStr) {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const m = hoy.getMonth() - fecha.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) edad--;
  return String(edad < 0 ? 0 : edad);
}

function calcImc(talla, peso) {
  const t = parseFloat(talla);
  const p = parseFloat(peso);
  if (!t || !p || t <= 0) return '';
  const imc = p / (t / 100) ** 2;
  return imc.toFixed(1);
}

function demografiaToForm(d) {
  if (!d) return { ...EMPTY_FORM };
  return {
    idTipoDocumento: d.idTipoDocumento != null ? String(d.idTipoDocumento) : '',
    documento: d.documentoPaciente ?? '',
    primerApellido: d.primerApellido ?? '',
    segundoApellido: d.segundoApellido ?? '',
    primerNombre: d.primerNombre ?? '',
    segundoNombre: d.segundoNombre ?? '',
    fechaNacimiento: d.fechaNacimiento ?? '',
    edad: d.edad != null ? String(d.edad) : '',
    idSexo: d.idSexo != null ? String(d.idSexo) : '',
    idSexoIdentidadGenero:
      d.idSexoIdentidadGenero != null ? String(d.idSexoIdentidadGenero) : '',
    idPaisNacionalidad:
      d.idPaisNacionalidad != null ? String(d.idPaisNacionalidad) : '',
    talla: d.talla ?? '',
    peso: d.peso ?? '',
    imc: calcImc(d.talla, d.peso),
    idPaisResidencia:
      d.idPaisResidencia != null ? String(d.idPaisResidencia) : '',
    idMunicipioResidencia:
      d.idMunicipioResidencia != null ? String(d.idMunicipioResidencia) : '',
    idZonaResidencia:
      d.idZonaResidencia != null ? String(d.idZonaResidencia) : '',
    direccion: d.direccion ?? '',
    idEtnia: d.idEtnia != null ? String(d.idEtnia) : '',
    comunidadEtnica: d.comunidadEtnica ?? '',
    idDiscapacidad:
      d.idDiscapacidad != null ? String(d.idDiscapacidad) : '',
    telefono: d.telefono ?? '',
    idOcupacion: d.idOcupacion != null ? String(d.idOcupacion) : '',
    alergeno: d.alergeno ?? '',
  };
}

function CatalogSelect({
  label,
  required,
  value,
  onChange,
  disabled,
  options,
  currentLabel,
  invalid,
}) {
  const hasValue = value !== '' && value != null;
  const inList = options.some((o) => String(o.id) === String(value));
  return (
    <label className={`hc-field ${invalid ? 'hc-field--invalid' : ''}`}>
      <span className="hc-field-label">
        {label}
        {required ? <span className="hc-required"> *</span> : null}
      </span>
      <select
        className="hc-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Selecciona —</option>
        {hasValue && !inList && currentLabel ? (
          <option value={value}>{currentLabel}</option>
        ) : null}
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  required,
  value,
  onChange,
  disabled,
  readOnly,
  type = 'text',
  className = '',
  invalid,
}) {
  return (
    <label className={`hc-field ${className} ${invalid ? 'hc-field--invalid' : ''}`}>
      <span className="hc-field-label">
        {label}
        {required ? <span className="hc-required"> *</span> : null}
      </span>
      <input
        type={type}
        className="hc-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
      />
    </label>
  );
}

export function PatientDataPanel({
  documentoPaciente,
  demografia,
  onSaved,
  onFormChange,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [catalogs, setCatalogs] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invalidIds, setInvalidIds] = useState(new Set());

  const labels = useMemo(
    () => ({
      tipoDocumento: demografia?.descripcionTipoDocumento ?? '',
      sexo: demografia?.sexo ?? '',
      identidadGenero: demografia?.identidadGenero ?? '',
      paisNacionalidad: demografia?.nombrePaisNacionalidad ?? '',
      paisResidencia: demografia?.nombrePaisResidencia ?? '',
      municipio: demografia?.nombreMunicipioResidencia ?? '',
      zona: demografia?.descripcionZonaResidencia ?? '',
      etnia: demografia?.descripcionEtnia ?? '',
      discapacidad: demografia?.descripcionDiscapacidad ?? '',
      ocupacion: demografia?.descripcionOcupacion ?? '',
    }),
    [demografia],
  );

  useEffect(() => {
    setForm(demografiaToForm(demografia));
    setEditing(false);
    setInvalidIds(new Set());
  }, [demografia, documentoPaciente]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const entries = await Promise.all(
          CATALOG_KEYS.map(async (key) => {
            const items = await fetchPacienteCatalog(key);
            return [key, items];
          }),
        );
        if (!cancel) {
          setCatalogs(Object.fromEntries(entries));
        }
      } catch (e) {
        if (!cancel) console.warn('Catálogos paciente:', e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const patch = useCallback((partial) => {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      if ('fechaNacimiento' in partial) {
        next.edad = calcEdad(partial.fechaNacimiento);
      }
      if ('talla' in partial || 'peso' in partial) {
        next.imc = calcImc(
          partial.talla ?? prev.talla,
          partial.peso ?? prev.peso,
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!onFormChange) return;
    onFormChange({
      idSexo: form.idSexo ? Number(form.idSexo) : null,
      idOcupacion: form.idOcupacion ? Number(form.idOcupacion) : null,
      direccionPaciente: form.direccion,
      celularPaciente: form.telefono,
      nacimientoPaciente: form.fechaNacimiento
        ? form.fechaNacimiento.split('T')[0]
        : null,
      edadPaciente: form.edad ? Number(form.edad) : null,
      idTipoDocumento: form.idTipoDocumento
        ? Number(form.idTipoDocumento)
        : null,
    });
  }, [form, onFormChange]);

  const fieldsDisabled = !editing;

  const requiredChecks = [
    { id: 'idTipoDocumento', label: 'Tipo Documento' },
    { id: 'documento', label: 'Número Documento' },
    { id: 'primerApellido', label: 'Primer Apellido' },
    { id: 'primerNombre', label: 'Primer Nombre' },
    { id: 'fechaNacimiento', label: 'Fecha y Hora Nacimiento' },
    { id: 'idSexo', label: 'Sexo Biológico' },
    { id: 'idPaisNacionalidad', label: 'Nacionalidad (País)' },
    { id: 'idPaisResidencia', label: 'País Residencia' },
    { id: 'idMunicipioResidencia', label: 'Municipio Residencia' },
    { id: 'idZonaResidencia', label: 'Zona Territorial' },
    { id: 'idEtnia', label: 'Etnia' },
    { id: 'idDiscapacidad', label: 'Discapacidad' },
  ];

  async function handleAction() {
    setError('');
    if (!editing) {
      setEditing(true);
      return;
    }

    const missing = [];
    const bad = new Set();
    requiredChecks.forEach(({ id, label }) => {
      const v = form[id];
      if (v == null || String(v).trim() === '') {
        missing.push(label);
        bad.add(id);
      }
    });
    setInvalidIds(bad);
    if (missing.length) {
      setError(`Complete: ${missing.join(', ')}`);
      return;
    }

    const alergenoTexto = form.alergeno.trim();
    const body = {
      idTipoDocumento: Number(form.idTipoDocumento),
      documento: form.documento.trim(),
      primerApellido: form.primerApellido.trim(),
      segundoApellido: form.segundoApellido.trim() || undefined,
      primerNombre: form.primerNombre.trim(),
      segundoNombre: form.segundoNombre.trim() || undefined,
      fechaNacimiento: form.fechaNacimiento,
      edad: form.edad,
      sexoBio: Number(form.idSexo),
      sexoIdenti: form.idSexoIdentidadGenero
        ? Number(form.idSexoIdentidadGenero)
        : undefined,
      idNacionalidad: Number(form.idPaisNacionalidad),
      talla: form.talla.trim() || undefined,
      peso: form.peso.trim() || undefined,
      idResidencia: Number(form.idPaisResidencia),
      idMunicipio: Number(form.idMunicipioResidencia),
      idZonaTerritorial: Number(form.idZonaResidencia),
      direccion: form.direccion.trim() || undefined,
      idEtnia: Number(form.idEtnia),
      comunidadEtnica: form.comunidadEtnica.trim() || undefined,
      idDiscapacidad: Number(form.idDiscapacidad),
      telefono: form.telefono.trim() || undefined,
      idOcupacion: form.idOcupacion ? Number(form.idOcupacion) : undefined,
      alergias: alergenoTexto ? 'Si' : 'No',
      alergeno: alergenoTexto || undefined,
    };

    setSaving(true);
    try {
      await updatePacienteDatos(documentoPaciente, body);
      setEditing(false);
      setInvalidIds(new Set());
      onSaved?.();
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudo guardar',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!demografia) {
    return (
      <p className="muted">
        No hay datos demográficos en la vista del Relacionador para este documento.
      </p>
    );
  }

  return (
    <div className="hc-patient-form">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="hc-patient-grid hc-patient-grid--form">
        <CatalogSelect
          label="Tipo documento"
          required
          value={form.idTipoDocumento}
          onChange={(v) => patch({ idTipoDocumento: v })}
          disabled={fieldsDisabled}
          options={catalogs['tipo-documento'] ?? []}
          currentLabel={labels.tipoDocumento}
          invalid={invalidIds.has('idTipoDocumento')}
        />
        <TextField
          label="Número documento"
          required
          value={form.documento}
          onChange={() => {}}
          disabled
          readOnly
          invalid={invalidIds.has('documento')}
        />
        <TextField
          label="Primer apellido"
          required
          value={form.primerApellido}
          onChange={(v) => patch({ primerApellido: v })}
          disabled={fieldsDisabled}
          invalid={invalidIds.has('primerApellido')}
        />
        <TextField
          label="Segundo apellido"
          value={form.segundoApellido}
          onChange={(v) => patch({ segundoApellido: v })}
          disabled={fieldsDisabled}
        />
        <TextField
          label="Primer nombre"
          required
          value={form.primerNombre}
          onChange={(v) => patch({ primerNombre: v })}
          disabled={fieldsDisabled}
          invalid={invalidIds.has('primerNombre')}
        />
        <TextField
          label="Segundo nombre"
          value={form.segundoNombre}
          onChange={(v) => patch({ segundoNombre: v })}
          disabled={fieldsDisabled}
        />

        <TextField
          label="Fecha y hora nacimiento"
          required
          type="datetime-local"
          value={form.fechaNacimiento}
          onChange={(v) => patch({ fechaNacimiento: v })}
          disabled={fieldsDisabled}
          className="hc-field--wide-md"
          invalid={invalidIds.has('fechaNacimiento')}
        />
        <TextField
          label="Edad"
          value={form.edad}
          onChange={() => {}}
          disabled
          readOnly
        />
        <CatalogSelect
          label="Sexo biológico"
          required
          value={form.idSexo}
          onChange={(v) => patch({ idSexo: v })}
          disabled={fieldsDisabled}
          options={catalogs.sexo ?? []}
          currentLabel={labels.sexo}
          invalid={invalidIds.has('idSexo')}
        />
        <CatalogSelect
          label="Identidad de género"
          value={form.idSexoIdentidadGenero}
          onChange={(v) => patch({ idSexoIdentidadGenero: v })}
          disabled={fieldsDisabled}
          options={catalogs['identidad-genero'] ?? []}
          currentLabel={labels.identidadGenero}
        />
        <CatalogSelect
          label="Nacionalidad (país)"
          required
          value={form.idPaisNacionalidad}
          onChange={(v) => patch({ idPaisNacionalidad: v })}
          disabled={fieldsDisabled}
          options={catalogs.paises ?? []}
          currentLabel={labels.paisNacionalidad}
          invalid={invalidIds.has('idPaisNacionalidad')}
        />

        <TextField
          label="Talla (cm)"
          type="number"
          value={form.talla}
          onChange={(v) => patch({ talla: v })}
          disabled={fieldsDisabled}
        />
        <TextField
          label="Peso (kg)"
          type="number"
          value={form.peso}
          onChange={(v) => patch({ peso: v })}
          disabled={fieldsDisabled}
        />
        <TextField
          label="IMC"
          value={form.imc}
          onChange={() => {}}
          disabled
          readOnly
        />
        <CatalogSelect
          label="País residencia"
          required
          value={form.idPaisResidencia}
          onChange={(v) => patch({ idPaisResidencia: v })}
          disabled={fieldsDisabled}
          options={catalogs.paises ?? []}
          currentLabel={labels.paisResidencia}
          invalid={invalidIds.has('idPaisResidencia')}
        />
        <CatalogSelect
          label="Municipio residencia"
          required
          value={form.idMunicipioResidencia}
          onChange={(v) => patch({ idMunicipioResidencia: v })}
          disabled={fieldsDisabled}
          options={catalogs.municipios ?? []}
          currentLabel={labels.municipio}
          invalid={invalidIds.has('idMunicipioResidencia')}
        />

        <CatalogSelect
          label="Zona territorial"
          required
          value={form.idZonaResidencia}
          onChange={(v) => patch({ idZonaResidencia: v })}
          disabled={fieldsDisabled}
          options={catalogs['zona-territorial'] ?? []}
          currentLabel={labels.zona}
          invalid={invalidIds.has('idZonaResidencia')}
        />
        <TextField
          label="Dirección"
          value={form.direccion}
          onChange={(v) => patch({ direccion: v })}
          disabled={fieldsDisabled}
          className="hc-field--wide-md"
        />
        <CatalogSelect
          label="Etnia"
          required
          value={form.idEtnia}
          onChange={(v) => patch({ idEtnia: v })}
          disabled={fieldsDisabled}
          options={catalogs.etnia ?? []}
          currentLabel={labels.etnia}
          invalid={invalidIds.has('idEtnia')}
        />
        <TextField
          label="Comunidad étnica"
          value={form.comunidadEtnica}
          onChange={(v) => patch({ comunidadEtnica: v })}
          disabled={fieldsDisabled}
        />
        <CatalogSelect
          label="Discapacidad"
          required
          value={form.idDiscapacidad}
          onChange={(v) => patch({ idDiscapacidad: v })}
          disabled={fieldsDisabled}
          options={catalogs.discapacidad ?? []}
          currentLabel={labels.discapacidad}
          invalid={invalidIds.has('idDiscapacidad')}
        />
        <TextField
          label="Teléfono"
          value={form.telefono}
          onChange={(v) => patch({ telefono: v })}
          disabled={fieldsDisabled}
        />
        <CatalogSelect
          label="Ocupación"
          value={form.idOcupacion}
          onChange={(v) => patch({ idOcupacion: v })}
          disabled={fieldsDisabled}
          options={catalogs.ocupacion ?? []}
          currentLabel={labels.ocupacion}
        />
        <div className="hc-field hc-field--action">
          <button
            type="button"
            className="evolucion-patient-save secondary"
            disabled={saving}
            onClick={() => void handleAction()}
          >
            {saving
              ? 'Guardando…'
              : editing
                ? 'Guardar cambios'
                : 'Actualizar datos paciente'}
          </button>
        </div>
      </div>

      <div className="hc-alergias-box">
        <h4 className="hc-alergias-title">Alergias</h4>
        <label className="hc-field hc-field--wide">
          <span className="hc-field-label">Nombre del alérgeno / detalles</span>
          <input
            type="text"
            className="hc-input"
            placeholder="Describa la alergia"
            value={form.alergeno}
            onChange={(e) => patch({ alergeno: e.target.value })}
            disabled={fieldsDisabled}
          />
        </label>
      </div>
    </div>
  );
}
