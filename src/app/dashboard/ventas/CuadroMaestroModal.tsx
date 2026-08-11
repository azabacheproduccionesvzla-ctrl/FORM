"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

interface Sale {
  id: string;
  codigo_venta: string;
  codigo_factura?: string | null;
  es_continuacion: boolean;
  tipo_venta: string;
  tipo_proyecto: string;
  tipo_proyecto_otro?: string;
  status_pago: string;
  plataforma: string;
  cliente_id: string;
  proyecto_nombre: string;
  monto_total: number;
  moneda: string;
  moneda_otra?: string | null;
  fecha_pago?: string;
  comprobante_link?: string;
  setter_principal_id?: string;
  setters_adicionales_ids?: string[];
  closer_principal_id?: string;
  closers_adicionales_ids?: string[];
  creado_en: string;
  clientes?: {
    id: string;
    nombre: string;
    ghl_contact_id?: string;
  };
  setter_principal?: {
    nombre: string;
  };
  closer_principal?: {
    nombre: string;
  };
}

interface UserListItem {
  id: string;
  nombre: string;
  username: string;
  rol: string;
}

interface CuadroMaestroModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersList: UserListItem[];
  userRole: string;
  onRefreshSales: () => void;
}

function formatExcelDate(dateStr?: string | Date | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[date.getUTCDay()];
  const monthName = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${dayName} ${monthName} ${day} ${hours}:${minutes}:${seconds} +0000 ${year}`;
}

export default function CuadroMaestroModal({
  isOpen,
  onClose,
  usersList,
  userRole,
  onRefreshSales,
}: CuadroMaestroModalProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterClient, setFilterClient] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Estado del editor de celdas
  const [gridData, setGridData] = useState<Sale[]>([]);
  const [modifiedRows, setModifiedRows] = useState<Map<string, Partial<Sale> & { cliente_nombre?: string; cliente_ghl_id?: string }>>(new Map());
  const [editingCell, setEditingCell] = useState<{ saleId: string; field: string } | null>(null);

  // Dialogo del PIN
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSales();
    }
  }, [isOpen]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/sales");
      const data = await res.json();
      if (data.success) {
        const orderedSales = (data.sales || []).slice().reverse();
        setSales(orderedSales);
        setGridData(JSON.parse(JSON.stringify(orderedSales))); // Deep clone for local editing
        setModifiedRows(new Map());
        setEditingCell(null);
      } else {
        setError(data.error || "Error al obtener las ventas.");
      }
    } catch (err) {
      console.error("Error fetching sales:", err);
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isReadOnly = userRole === "auditor";

  // Opciones predefinidas
  const platformOptions = ["Freelancer", "Workana", "Upwork", "Directo", "Fiverr", "LinkedIn", "Instagram", "Otro"];
  const statusPagoOptions = ["PAGO ADELANTADO", "PAGO PARCIAL", "PENDIENTE DE COBRO", "COBRADO", "DEVOLUCION", "RECHAZADO"];
  const currencyOptions = ["USD", "EUR", "COP", "VES", "Otra"];

  const getComisionValue = (plataforma: string) => {
    const plat = (plataforma || "").toLowerCase();
    if (plat === "freelancer") return "10%";
    if (plat === "workana") return "REVISAR";
    if (plat.includes("contrato") || plat === "freelancer con contrato") return "15%";
    return "0%";
  };

  // Filtrado reactivo en el cliente
  const filteredSales = gridData.filter((sale) => {
    if (filterClient) {
      const clientName = sale.clientes?.nombre || "";
      if (!clientName.toLowerCase().includes(filterClient.toLowerCase())) return false;
    }
    if (filterProject) {
      const projectName = sale.proyecto_nombre || "";
      if (!projectName.toLowerCase().includes(filterProject.toLowerCase())) return false;
    }
    if (filterPlatform && sale.plataforma !== filterPlatform) return false;
    if (filterStatus && sale.status_pago !== filterStatus) return false;
    return true;
  });

  // Manejar el cambio de valor en una celda
  const handleCellChange = (saleId: string, field: string, value: any) => {
    if (isReadOnly) return;

    setGridData((prev) =>
      prev.map((sale) => {
        if (sale.id === saleId) {
          const updatedSale = { ...sale };

          // Campos anidados
          if (field === "cliente_nombre") {
            updatedSale.clientes = {
              ...(updatedSale.clientes || { id: sale.cliente_id || "", nombre: "" }),
              nombre: value,
            };
          } else if (field === "cliente_ghl_id") {
            updatedSale.clientes = {
              ...(updatedSale.clientes || { id: sale.cliente_id || "", nombre: "" }),
              ghl_contact_id: value,
            };
          } else if (field === "setter_principal_id") {
            updatedSale.setter_principal_id = value || undefined;
            const u = usersList.find((u) => u.id === value);
            updatedSale.setter_principal = u ? { nombre: u.nombre } : undefined;
          } else if (field === "closer_principal_id") {
            updatedSale.closer_principal_id = value || undefined;
            const u = usersList.find((u) => u.id === value);
            updatedSale.closer_principal = u ? { nombre: u.nombre } : undefined;
          } else if (field === "setter_adicional_id") {
            updatedSale.setters_adicionales_ids = value ? [value] : [];
          } else if (field === "closer_adicional_1_id") {
            const nextClosers = [...(updatedSale.closers_adicionales_ids || [])];
            if (value) {
              nextClosers[0] = value;
            } else {
              nextClosers.shift(); // Remove first additional closer
            }
            updatedSale.closers_adicionales_ids = nextClosers.filter(Boolean);
          } else if (field === "closer_adicional_2_id") {
            const nextClosers = [...(updatedSale.closers_adicionales_ids || [])];
            if (value) {
              nextClosers[1] = value;
            } else {
              if (nextClosers.length > 1) {
                nextClosers.splice(1, 1); // Remove second additional closer
              }
            }
            updatedSale.closers_adicionales_ids = nextClosers.filter(Boolean);
          } else {
            (updatedSale as any)[field] = value;
          }

          // Registrar en la lista de filas modificadas
          const existingMod = modifiedRows.get(saleId) || { id: saleId };
          
          if (field === "cliente_nombre") {
            existingMod.cliente_nombre = value;
            existingMod.cliente_id = sale.cliente_id;
          } else if (field === "cliente_ghl_id") {
            existingMod.cliente_ghl_id = value;
            existingMod.cliente_id = sale.cliente_id;
          } else if (field === "setter_adicional_id") {
            existingMod.setters_adicionales_ids = value ? [value] : [];
          } else if (field === "closer_adicional_1_id") {
            const currentArr = [...(sale.closers_adicionales_ids || [])];
            if (value) currentArr[0] = value;
            else currentArr.splice(0, 1);
            existingMod.closers_adicionales_ids = currentArr.filter(Boolean);
          } else if (field === "closer_adicional_2_id") {
            const currentArr = [...(sale.closers_adicionales_ids || [])];
            if (value) currentArr[1] = value;
            else if (currentArr.length > 1) currentArr.splice(1, 1);
            existingMod.closers_adicionales_ids = currentArr.filter(Boolean);
          } else {
            (existingMod as any)[field] = value;
          }

          // Guardar referencia al cliente
          if (sale.cliente_id) {
            existingMod.cliente_id = sale.cliente_id;
          }

          const copyMap = new Map(modifiedRows);
          copyMap.set(saleId, existingMod);
          setModifiedRows(copyMap);

          return updatedSale;
        }
        return sale;
      })
    );
  };

  // Exportar a XLSX nativo
  const exportToXlsx = () => {
    const headers = [
      "Etapa",
      "Plataforma",
      "Codigo Venta",
      "ID Factura",
      "Fecha de inicio",
      "Cliente ",
      "Codigo Cliente",
      "Proyecto",
      "Monto C/C",
      "Comision",
      "Setter I",
      "Setter II",
      "Closer I",
      "Closer II",
      "Closer III",
      "Factura",
      "Fecha de Pago",
      "Comisión de transferencia",
      "Fondo Gerencial",
      "Lider",
      "Asociaciado I",
      "% Asociaciado I",
      "Asociaciado II",
      "% Asociaciado II",
      "Asociaciado III",
      "% Asociaciado III",
      "Asociaciado IV",
      "% Asociaciado IV",
      "Asociaciado V",
      "% Asociaciado V"
    ];

    const rows = filteredSales.map((sale) => {
      const setter2 = sale.setters_adicionales_ids && sale.setters_adicionales_ids.length > 0
        ? (usersList.find((u) => u.id === sale.setters_adicionales_ids![0])?.nombre || "")
        : "";
      const closer2 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 0
        ? (usersList.find((u) => u.id === sale.closers_adicionales_ids![0])?.nombre || "")
        : "";
      const closer3 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 1
        ? (usersList.find((u) => u.id === sale.closers_adicionales_ids![1])?.nombre || "")
        : "";

      return [
        sale.status_pago || "PAGO ADELANTADO",
        sale.plataforma || "",
        sale.codigo_venta || "",
        sale.codigo_factura || "",
        formatExcelDate(sale.creado_en),
        sale.clientes?.nombre || "Cliente",
        sale.clientes?.ghl_contact_id || "",
        sale.proyecto_nombre || "",
        `${sale.monto_total || 0} ${(sale.moneda === "Otra" ? (sale.moneda_otra || "Otra") : (sale.moneda || "USD")).toUpperCase()}`,
        getComisionValue(sale.plataforma),
        sale.setter_principal?.nombre || "",
        setter2,
        sale.closer_principal?.nombre || "",
        closer2,
        closer3,
        sale.comprobante_link || "",
        sale.fecha_pago || "",
        "", // Comisión de transferencia
        "", // Fondo Gerencial
        "", // Lider
        "", // Asociaciado I
        "", // % Asociaciado I
        "", // Asociaciado II
        "", // % Asociaciado II
        "", // Asociaciado III
        "", // % Asociaciado III
        "", // Asociaciado IV
        "", // % Asociaciado IV
        "", // Asociaciado V
        ""  // % Asociaciado V
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cuadro Maestro");

    // Guardar archivo XLSX
    XLSX.writeFile(workbook, `Cuadro_Maestro_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Confirmar y guardar modificaciones en Supabase
  const handleSaveChanges = async () => {
    if (modifiedRows.size === 0) {
      alert("No hay modificaciones para guardar.");
      return;
    }
    setIsPinDialogOpen(true);
    setPinCode("");
    setPinError(null);
  };

  const submitBatchSave = async () => {
    if (!pinCode) {
      setPinError("El PIN es requerido.");
      return;
    }
    setSavingChanges(true);
    setPinError(null);

    const salesListToUpdate = Array.from(modifiedRows.values());

    try {
      const res = await fetch("/api/sales/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinCode,
          sales: salesListToUpdate,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || "Cambios guardados con éxito.");
        setIsPinDialogOpen(false);
        fetchSales();
        onRefreshSales(); // Refresh parent view sales
      } else {
        setPinError(data.error || "Error al verificar PIN o guardar cambios.");
      }
    } catch (err) {
      setPinError("Error de conexión con el servidor.");
    } finally {
      setSavingChanges(false);
    }
  };

  // Convertir columna a Letra Excel (0 -> A, 1 -> B, ...)
  const getColLetter = (index: number): string => {
    let letter = "";
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContainerStyle}>
        {/* Barra de cabecera */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#107c41" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600", color: "#1e293b" }}>Cuadro Maestro</h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                {isReadOnly ? "Vista de lectura de planilla de ventas." : "Haz doble clic o haz clic sobre una celda para editar los campos directamente."}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={exportToXlsx} style={btnExportStyle} title="Exportar fila de ventas actual a Excel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar (.xlsx)
            </button>

            {!isReadOnly && (
              <button
                onClick={handleSaveChanges}
                disabled={modifiedRows.size === 0}
                style={modifiedRows.size === 0 ? btnSaveDisabledStyle : btnSaveStyle}
              >
                Guardar cambios ({modifiedRows.size})
              </button>
            )}

            <button onClick={onClose} style={btnCloseStyle}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div style={filterBarStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", width: "100%" }}>
            <div>
              <label style={filterLabelStyle}>Cliente</label>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                style={filterInputStyle}
              />
            </div>
            <div>
              <label style={filterLabelStyle}>Proyecto</label>
              <input
                type="text"
                placeholder="Buscar proyecto..."
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                style={filterInputStyle}
              />
            </div>
            <div>
              <label style={filterLabelStyle}>Plataforma</label>
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="">Todas las plataformas</option>
                {platformOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={filterLabelStyle}>Etapa (Pago)</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="">Todas las etapas</option>
                {statusPagoOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla / Planilla (Spreadsheet Grid) */}
        <div style={spreadsheetAreaStyle}>
          {loading ? (
            <div style={centerContainerStyle}>
              <div style={loadingSpinnerStyle}></div>
              <p style={{ marginTop: "10px", color: "#64748b" }}>Cargando planilla...</p>
            </div>
          ) : error ? (
            <div style={centerContainerStyle}>
              <p style={{ color: "#ef4444", fontWeight: "600" }}>{error}</p>
              <button onClick={fetchSales} style={btnRetryStyle}>Reintentar</button>
            </div>
          ) : filteredSales.length === 0 ? (
            <div style={centerContainerStyle}>
              <p style={{ color: "#64748b" }}>No se encontraron registros de ventas.</p>
            </div>
          ) : (
            <table ref={tableRef} style={tableStyle}>
              <thead>
                {/* Fila superior de letras de columna tipo Google Sheets (A, B, C...) */}
                <tr>
                  <th style={indexHeaderStyle}></th>
                  {Array.from({ length: 30 }).map((_, i) => (
                    <th key={i} style={letterHeaderStyle}>
                      {getColLetter(i)}
                    </th>
                  ))}
                </tr>
                {/* Encabezados de campos */}
                <tr>
                  <th style={indexHeaderStyle}></th>
                  <th style={fieldHeaderStyle}>Etapa</th>
                  <th style={fieldHeaderStyle}>Plataforma</th>
                  <th style={fieldHeaderStyle}>Codigo Venta</th>
                  <th style={fieldHeaderStyle}>ID Factura</th>
                  <th style={fieldHeaderStyle}>Fecha de inicio</th>
                  <th style={fieldHeaderStyle}>Cliente </th>
                  <th style={fieldHeaderStyle}>Codigo Cliente</th>
                  <th style={fieldHeaderStyle}>Proyecto</th>
                  <th style={fieldHeaderStyle}>Monto C/C</th>
                  <th style={fieldHeaderStyle}>Comision</th>
                  <th style={fieldHeaderStyle}>Setter I</th>
                  <th style={fieldHeaderStyle}>Setter II</th>
                  <th style={fieldHeaderStyle}>Closer I</th>
                  <th style={fieldHeaderStyle}>Closer II</th>
                  <th style={fieldHeaderStyle}>Closer III</th>
                  <th style={fieldHeaderStyle}>Factura</th>
                  <th style={fieldHeaderStyle}>Fecha de Pago</th>
                  <th style={fieldHeaderStyleEmpty}>Comisión de transferencia</th>
                  <th style={fieldHeaderStyleEmpty}>Fondo Gerencial</th>
                  <th style={fieldHeaderStyleEmpty}>Lider</th>
                  <th style={fieldHeaderStyleEmpty}>Asociaciado I</th>
                  <th style={fieldHeaderStyleEmpty}>% Asociaciado I</th>
                  <th style={fieldHeaderStyleEmpty}>Asociaciado II</th>
                  <th style={fieldHeaderStyleEmpty}>% Asociaciado II</th>
                  <th style={fieldHeaderStyleEmpty}>Asociaciado III</th>
                  <th style={fieldHeaderStyleEmpty}>% Asociaciado III</th>
                  <th style={fieldHeaderStyleEmpty}>Asociaciado IV</th>
                  <th style={fieldHeaderStyleEmpty}>% Asociaciado IV</th>
                  <th style={fieldHeaderStyleEmpty}>Asociaciado V</th>
                  <th style={fieldHeaderStyleEmpty}>% Asociaciado V</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale, rowIndex) => {
                  const isRowModified = modifiedRows.has(sale.id);

                  // Resoluciones locales de nombres
                  const setter2 = sale.setters_adicionales_ids && sale.setters_adicionales_ids.length > 0
                    ? sale.setters_adicionales_ids[0]
                    : "";
                  const closer2 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 0
                    ? sale.closers_adicionales_ids[0]
                    : "";
                  const closer3 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 1
                    ? sale.closers_adicionales_ids[1]
                    : "";

                  const renderCell = (
                    field: string,
                    displayVal: any,
                    type: "text" | "select" | "date" | "number",
                    selectOptions?: string[] | { id: string; name: string }[],
                    customRenderVal?: React.ReactNode
                  ) => {
                    const isEditing = editingCell?.saleId === sale.id && editingCell?.field === field;

                    if (isEditing && !isReadOnly) {
                      if (type === "select" && selectOptions) {
                        return (
                          <select
                            defaultValue={displayVal}
                            autoFocus
                            onBlur={(e) => {
                              handleCellChange(sale.id, field, e.target.value);
                              setEditingCell(null);
                            }}
                            onChange={(e) => {
                              handleCellChange(sale.id, field, e.target.value);
                            }}
                            style={cellInputSelectStyle}
                          >
                            <option value="">-- Vacío --</option>
                            {selectOptions.map((opt) => {
                              const isObj = typeof opt === "object";
                              const key = isObj ? opt.id : opt;
                              const val = isObj ? opt.name : opt;
                              return (
                                <option key={key} value={key}>
                                  {val}
                                </option>
                              );
                            })}
                          </select>
                        );
                      }

                      if (type === "date") {
                        return (
                          <input
                            type="date"
                            defaultValue={displayVal || ""}
                            autoFocus
                            onBlur={(e) => {
                              handleCellChange(sale.id, field, e.target.value);
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCellChange(sale.id, field, (e.target as any).value);
                                setEditingCell(null);
                              }
                            }}
                            style={cellInputTextStyle}
                          />
                        );
                      }

                      if (type === "number") {
                        return (
                          <input
                            type="number"
                            defaultValue={displayVal ?? ""}
                            autoFocus
                            onBlur={(e) => {
                              handleCellChange(sale.id, field, parseFloat(e.target.value) || 0);
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCellChange(sale.id, field, parseFloat((e.target as any).value) || 0);
                                setEditingCell(null);
                              }
                            }}
                            style={cellInputTextStyle}
                          />
                        );
                      }

                      // Default text input
                      return (
                        <input
                          type="text"
                          defaultValue={displayVal || ""}
                          autoFocus
                          onBlur={(e) => {
                            handleCellChange(sale.id, field, e.target.value);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCellChange(sale.id, field, (e.target as any).value);
                              setEditingCell(null);
                            }
                          }}
                          style={cellInputTextStyle}
                        />
                      );
                    }

                    return (
                      <div
                        onClick={() => !isReadOnly && setEditingCell({ saleId: sale.id, field })}
                        style={{
                          height: "100%",
                          width: "100%",
                          padding: "6px 8px",
                          cursor: isReadOnly ? "default" : "pointer",
                          userSelect: "none",
                        }}
                      >
                        {customRenderVal !== undefined ? customRenderVal : (displayVal || <span style={{ color: "#cbd5e1", fontSize: "0.75rem" }}>--</span>)}
                      </div>
                    );
                  };

                  const resolvedSetterName = (userId: string) => usersList.find(u => u.id === userId)?.nombre || "";

                  return (
                    <tr key={sale.id} style={isRowModified ? rowModifiedStyle : rowStyle}>
                      <td style={rowNumberColStyle}>{rowIndex + 1}</td>
                      <td style={cellStyle}>
                        {renderCell("status_pago", sale.status_pago, "select", statusPagoOptions)}
                      </td>
                      <td style={cellStyle}>
                        {renderCell("plataforma", sale.plataforma, "select", platformOptions)}
                      </td>
                      <td style={cellStyle}>
                        {renderCell("codigo_venta", sale.codigo_venta, "text")}
                      </td>
                      <td style={cellStyle}>
                        {renderCell("codigo_factura", sale.codigo_factura, "text")}
                      </td>
                      <td style={cellReadOnlyStyle}>
                        {formatExcelDate(sale.creado_en)}
                      </td>
                      <td style={cellStyle}>
                        {renderCell("cliente_nombre", sale.clientes?.nombre, "text")}
                      </td>
                      <td style={cellStyle}>
                        {renderCell("cliente_ghl_id", sale.clientes?.ghl_contact_id, "text")}
                      </td>
                      <td style={cellStyle}>
                        {renderCell("proyecto_nombre", sale.proyecto_nombre, "text")}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "monto_total",
                          sale.monto_total,
                          "number",
                          undefined,
                          `${sale.monto_total || 0} ${(sale.moneda === "Otra" ? (sale.moneda_otra || "Otra") : (sale.moneda || "USD")).toUpperCase()}`
                        )}
                      </td>
                      <td style={cellReadOnlyStyle}>
                        {getComisionValue(sale.plataforma)}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "setter_principal_id",
                          sale.setter_principal_id,
                          "select",
                          usersList.map((u) => ({ id: u.id, name: u.nombre })),
                          usersList.find((u) => u.id === sale.setter_principal_id)?.nombre
                        )}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "setter_adicional_id",
                          setter2,
                          "select",
                          usersList.map((u) => ({ id: u.id, name: u.nombre })),
                          usersList.find((u) => u.id === setter2)?.nombre
                        )}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "closer_principal_id",
                          sale.closer_principal_id,
                          "select",
                          usersList.map((u) => ({ id: u.id, name: u.nombre })),
                          usersList.find((u) => u.id === sale.closer_principal_id)?.nombre
                        )}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "closer_adicional_1_id",
                          closer2,
                          "select",
                          usersList.map((u) => ({ id: u.id, name: u.nombre })),
                          usersList.find((u) => u.id === closer2)?.nombre
                        )}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "closer_adicional_2_id",
                          closer3,
                          "select",
                          usersList.map((u) => ({ id: u.id, name: u.nombre })),
                          usersList.find((u) => u.id === closer3)?.nombre
                        )}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "comprobante_link",
                          sale.comprobante_link,
                          "text",
                          undefined,
                          sale.comprobante_link ? (
                            <a href={sale.comprobante_link} target="_blank" rel="noopener noreferrer" style={{ color: "#0052cc", textDecoration: "underline" }}>
                              {sale.comprobante_link.length > 30 ? sale.comprobante_link.substring(0, 27) + "..." : sale.comprobante_link}
                            </a>
                          ) : undefined
                        )}
                      </td>
                      <td style={cellStyle}>
                        {renderCell(
                          "fecha_pago",
                          sale.fecha_pago,
                          "date",
                          undefined,
                          sale.fecha_pago ? new Date(sale.fecha_pago + "T00:00:00").toLocaleDateString("es-ES") : undefined
                        )}
                      </td>
                      {/* Celdas reservadas vacías */}
                      {Array.from({ length: 13 }).map((_, i) => (
                        <td key={i} style={cellEmptyStyle}></td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div>
            Filas: <strong>{filteredSales.length}</strong> | Modificaciones pendientes: <strong>{modifiedRows.size}</strong>
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", border: "1px solid #e2e8f0" }}></span> Fila normal
            </span>
            {!isReadOnly && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", backgroundColor: "#f0fdf4", borderRadius: "2px", border: "1px solid #bbf7d0" }}></span> Modificada
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dialogo de PIN de Confirmación */}
      {isPinDialogOpen && (
        <div style={pinOverlayStyle}>
          <div style={pinDialogStyle}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", fontWeight: "600", color: "#1e293b" }}>
              Confirmar guardado en Supabase
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "0.85rem", color: "#64748b" }}>
              Se actualizarán {modifiedRows.size} registros de ventas. Por favor ingresa tu PIN de seguridad para firmar y aplicar los cambios.
            </p>

            {pinError && (
              <div style={pinAlertErrorStyle}>
                <span>{pinError}</span>
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <input
                type="password"
                maxLength={4}
                placeholder="PIN"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitBatchSave();
                  }
                }}
                disabled={savingChanges}
                style={pinInputStyle}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                onClick={() => setIsPinDialogOpen(false)}
                disabled={savingChanges}
                style={pinBtnCancelStyle}
              >
                Cancelar
              </button>
              <button
                onClick={submitBatchSave}
                disabled={savingChanges || pinCode.length !== 4}
                style={pinCode.length !== 4 ? pinBtnSaveDisabledStyle : pinBtnSaveStyle}
              >
                {savingChanges ? "Guardando..." : "Firmar y Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos locales de objeto para flexibilidad y robustez en React
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "1rem",
};

const modalContainerStyle: React.CSSProperties = {
  width: "96vw",
  height: "92vh",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid #cbd5e1",
};

const headerStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  borderBottom: "1px solid #cbd5e1",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#f8fafc",
};

const filterBarStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  borderBottom: "1px solid #e2e8f0",
  backgroundColor: "#f1f5f9",
  display: "flex",
  alignItems: "center",
};

const filterLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  fontWeight: "700",
  textTransform: "uppercase",
  color: "#475569",
  marginBottom: "4px",
  letterSpacing: "0.5px",
};

const filterInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  fontSize: "0.85rem",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  outline: "none",
  color: "#1e293b",
};

const filterSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  fontSize: "0.85rem",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  outline: "none",
  color: "#1e293b",
};

const spreadsheetAreaStyle: React.CSSProperties = {
  flexGrow: 1,
  overflow: "auto",
  position: "relative",
  backgroundColor: "#f8fafc",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "separate",
  borderSpacing: 0,
  width: "max-content",
  minWidth: "100%",
  fontFamily: "Inter, sans-serif",
  fontSize: "0.85rem",
};

const letterHeaderStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  backgroundColor: "#f1f5f9",
  borderRight: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  padding: "4px 8px",
  fontWeight: "500",
  color: "#64748b",
  fontSize: "0.75rem",
  textAlign: "center",
  zIndex: 10,
};

const fieldHeaderStyle: React.CSSProperties = {
  position: "sticky",
  top: "26px", // Sticky header below the alphabet header
  backgroundColor: "#e2e8f0",
  borderRight: "1px solid #cbd5e1",
  borderBottom: "2px solid #94a3b8",
  padding: "8px 12px",
  fontWeight: "600",
  color: "#1e293b",
  textAlign: "left",
  fontSize: "0.8rem",
  zIndex: 10,
  minWidth: "160px",
};

const fieldHeaderStyleEmpty: React.CSSProperties = {
  position: "sticky",
  top: "26px",
  backgroundColor: "#f1f5f9",
  borderRight: "1px solid #cbd5e1",
  borderBottom: "2px solid #cbd5e1",
  padding: "8px 12px",
  fontWeight: "500",
  color: "#94a3b8",
  textAlign: "left",
  fontSize: "0.8rem",
  zIndex: 10,
  minWidth: "180px",
};

const indexHeaderStyle: React.CSSProperties = {
  position: "sticky",
  left: 0,
  top: 0,
  backgroundColor: "#e2e8f0",
  borderRight: "2px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  width: "40px",
  textAlign: "center",
  zIndex: 20,
};

const rowNumberColStyle: React.CSSProperties = {
  position: "sticky",
  left: 0,
  backgroundColor: "#f1f5f9",
  borderRight: "2px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  color: "#64748b",
  fontWeight: "600",
  fontSize: "0.75rem",
  textAlign: "center",
  zIndex: 5,
};

const cellStyle: React.CSSProperties = {
  borderRight: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  padding: 0,
  backgroundColor: "#ffffff",
  minWidth: "160px",
  height: "36px",
  verticalAlign: "middle",
};

const cellReadOnlyStyle: React.CSSProperties = {
  borderRight: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  padding: "6px 8px",
  backgroundColor: "#f8fafc",
  color: "#64748b",
  minWidth: "160px",
  height: "36px",
  verticalAlign: "middle",
  userSelect: "none",
};

const cellEmptyStyle: React.CSSProperties = {
  borderRight: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  backgroundColor: "#fafafa",
  minWidth: "180px",
  height: "36px",
};

const rowStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
};

const rowModifiedStyle: React.CSSProperties = {
  backgroundColor: "#f0fdf4",
};

const cellInputTextStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  border: "2px solid #0052cc",
  outline: "none",
  padding: "4px 6px",
  fontSize: "0.85rem",
  backgroundColor: "#ffffff",
  color: "#1e293b",
};

const cellInputSelectStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  border: "2px solid #0052cc",
  outline: "none",
  padding: "4px 6px",
  fontSize: "0.85rem",
  backgroundColor: "#ffffff",
  color: "#1e293b",
};

const footerStyle: React.CSSProperties = {
  padding: "0.5rem 1.5rem",
  borderTop: "1px solid #cbd5e1",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#f8fafc",
  fontSize: "0.8rem",
  color: "#64748b",
};

const centerContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: "6rem",
  width: "100%",
};

// Botones y Elementos Interactivos
const btnCloseStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "500",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  color: "#334155",
  cursor: "pointer",
  outline: "none",
};

const btnSaveStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "600",
  borderRadius: "6px",
  border: "1px solid #0052cc",
  backgroundColor: "#0052cc",
  color: "#ffffff",
  cursor: "pointer",
  outline: "none",
};

const btnSaveDisabledStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "600",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
  backgroundColor: "#f1f5f9",
  color: "#94a3b8",
  cursor: "not-allowed",
  outline: "none",
};

const btnExportStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "500",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  color: "#107c41",
  cursor: "pointer",
  outline: "none",
  display: "inline-flex",
  alignItems: "center",
};

const btnRetryStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "0.4rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "600",
  borderRadius: "6px",
  border: "1px solid #0052cc",
  backgroundColor: "#0052cc",
  color: "#ffffff",
  cursor: "pointer",
};

// PIN Dialog Styles
const pinOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1100,
};

const pinDialogStyle: React.CSSProperties = {
  width: "380px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "1.5rem",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
  border: "1px solid #e2e8f0",
};

const pinInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  fontSize: "1.25rem",
  letterSpacing: "8px",
  textAlign: "center",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  outline: "none",
  color: "#1e293b",
};

const pinBtnCancelStyle: React.CSSProperties = {
  padding: "0.45rem 1rem",
  fontSize: "0.85rem",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  color: "#475569",
  cursor: "pointer",
};

const pinBtnSaveStyle: React.CSSProperties = {
  padding: "0.45rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "600",
  borderRadius: "6px",
  border: "1px solid #0052cc",
  backgroundColor: "#0052cc",
  color: "#ffffff",
  cursor: "pointer",
};

const pinBtnSaveDisabledStyle: React.CSSProperties = {
  padding: "0.45rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "600",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
  backgroundColor: "#f1f5f9",
  color: "#94a3b8",
  cursor: "not-allowed",
};

const pinAlertErrorStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "#fee2e2",
  border: "1px solid #fecaca",
  borderRadius: "6px",
  color: "#b91c1c",
  fontSize: "0.8rem",
  marginBottom: "12px",
};

const loadingSpinnerStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  border: "3px solid #e2e8f0",
  borderTopColor: "#0052cc",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
