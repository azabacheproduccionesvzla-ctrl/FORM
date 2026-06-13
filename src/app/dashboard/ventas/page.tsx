"use client";
import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";
import VentasModal from "./VentasModal";
import CuadroMaestroModal from "./CuadroMaestroModal";
interface Sale {
  id: string;
  codigo_venta: string;
  codigo_factura?: string | null;
  es_continuacion: boolean;
  tipo_continuacion?: string;
  proyecto_previo_id?: string;
  tipo_venta: string;
  tipo_proyecto: string;
  tipo_proyecto_otro?: string;
  status_pago: string;
  plataforma: string;
  cliente_id: string;
  proyecto_nombre: string;
  proyecto_link?: string;
  proyecto_brief?: string;
  descripcion_operativa?: string;
  carpeta_dropbox?: string;
  deadline?: string;
  urgente: boolean;
  motivo_urgencia?: string;
  moneda: string;
  moneda_otra?: string;
  monto_total: number;
  monto_explicacion?: string;
  monto_pagado?: number;
  comision_total?: number;
  fecha_pago?: string;
  fecha_liberacion_pendiente: boolean;
  comprobante_link?: string;
  comprobante_no_aplica: boolean;
  setter_principal_id?: string;
  setters_adicionales_ids?: string[];
  closer_principal_id?: string;
  closers_adicionales_ids?: string[];
  tipo_cierre: string;
  oferta_presentada?: string;
  condiciones_acordadas?: string;
  notas_internas?: string;
  usuario_registro_id: string;
  creado_en: string;
  estado_interno: string;
  status_trello: string;
  status_ghl_contacto: string;
  status_ghl_factura: string;
  status_ghl?: string;
  status_dropbox: string;
  status_whatsapp: string;
  status_email: string;
  status_sheets: string;
  link_trello?: string;
  clientes?: {
    nombre: string;
    email: string;
    telefono: string;
    pais?: string;
    empresa?: string;
    link_usuario_plataforma?: string;
    ghl_contact_id?: string;
  };
  registrador?: {
    nombre: string;
  };
  setter_principal?: {
    nombre: string;
  };
  closer_principal?: {
    nombre: string;
  };
}
interface UserSession {
  id: string;
  username: string;
  name: string;
  role: string;
}
interface UserListItem {
  id: string;
  nombre: string;
  username: string;
  rol: string;
}
export default function VentasPage() {
  const getBadgeStyle = (status?: string) => {
    if (status === "ERROR") {
      return { backgroundColor: "#fee2e2", borderColor: "#fecaca", color: "#b91c1c" };
    }
    if (status === "DESACTIVADO") {
      return { opacity: 0.5, borderStyle: "dashed" as const, borderColor: "#cbd5e1" };
    }
    return {};
  };

  const getPipelineBoxStyle = (status?: string) => {
    if (status === "DESACTIVADO") {
      return { opacity: 0.5, borderStyle: "dashed" as const, borderColor: "#cbd5e1" };
    }
    return {};
  };

  const [sales, setSales] = useState<Sale[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalGatingStep, setModalGatingStep] = useState<"choose" | "none">("choose");
  const [isCuadroMaestroOpen, setIsCuadroMaestroOpen] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");

  const [selectedViewSale, setSelectedViewSale] = useState<Sale | null>(null);
  const [selectedLogsSale, setSelectedLogsSale] = useState<Sale | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [saleLogs, setSaleLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (selectedLogsSale) {
      setLoadingLogs(true);
      setSaleLogs([]);
      fetch(`/api/sales/logs?saleId=${selectedLogsSale.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSaleLogs(data.logs || []);
          }
        })
        .catch(err => console.error("Error fetching logs:", err))
        .finally(() => setLoadingLogs(false));
    }
  }, [selectedLogsSale]);

  const [quickTrelloTitle, setQuickTrelloTitle] = useState("");
  const [quickTrelloDesc, setQuickTrelloDesc] = useState("");
  const [quickDropboxFolder, setQuickDropboxFolder] = useState("");
  const [isUpdatingTrello, setIsUpdatingTrello] = useState(false);
  const [isUpdatingDropbox, setIsUpdatingDropbox] = useState(false);
  const [isSyncingTrello, setIsSyncingTrello] = useState(false);
  const [trelloEditMode, setTrelloEditMode] = useState(false);
  const [dropboxEditMode, setDropboxEditMode] = useState(false);

  useEffect(() => {
    if (selectedViewSale) {
      setTrelloEditMode(false);
      setDropboxEditMode(false);

      const cleanedProj = (selectedViewSale.proyecto_nombre || "")
        .replace(/^azabache\s+producciones\s*-\s*/i, "")
        .replace(/^azabache\s+producciones\s*/i, "")
        .trim();
      const clientName = selectedViewSale.clientes?.nombre || "";
      
      // Default fallback values
      setQuickTrelloTitle(`${cleanedProj} - ${clientName}`);
      const dropboxUrlLink = selectedViewSale.carpeta_dropbox || "No creada";
      const desc = `${selectedViewSale.tipo_proyecto}${selectedViewSale.tipo_proyecto_otro ? ` (${selectedViewSale.tipo_proyecto_otro})` : ""} \n\n  Brief: ${selectedViewSale.proyecto_brief || "N/A"} \n Material: ${dropboxUrlLink} \n\n 🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos. Una evaluación rápida del proyecto nos puede asegurar un desarrollo más fluido y efectivo.${selectedViewSale.descripcion_operativa ? `\n\n---\n\n${selectedViewSale.descripcion_operativa}` : ""}`;
      setQuickTrelloDesc(desc);
      setQuickDropboxFolder(`${clientName} - ${cleanedProj}`);

      // If Trello is completed, let's sync live values from Trello API
      if (selectedViewSale.status_trello === "COMPLETADO") {
        setIsSyncingTrello(true);
        fetch(`/api/sales/sync-trello?saleId=${selectedViewSale.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.synchronized) {
              if (data.trelloTitle) setQuickTrelloTitle(data.trelloTitle);
              if (data.trelloDesc) setQuickTrelloDesc(data.trelloDesc);
              if (data.dbUpdated) {
                fetchSales();
              }
            }
          })
          .catch(err => console.error("Error syncing Trello live:", err))
          .finally(() => setIsSyncingTrello(false));
      }
    } else {
      setQuickTrelloTitle("");
      setQuickTrelloDesc("");
      setQuickDropboxFolder("");
      setTrelloEditMode(false);
      setDropboxEditMode(false);
    }
  }, [selectedViewSale]);

  const handleUpdateTrello = async () => {
    if (!selectedViewSale) return;
    setIsUpdatingTrello(true);
    try {
      const res = await fetch("/api/sales/quick-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: selectedViewSale.id,
          action: "trello",
          trelloTitle: quickTrelloTitle,
          trelloDesc: quickTrelloDesc
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Tarjeta de Trello actualizada exitosamente.");
        setTrelloEditMode(false);
        fetchSales();
      } else {
        alert(`Error al actualizar Trello: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setIsUpdatingTrello(false);
    }
  };

  const handleUpdateDropbox = async () => {
    if (!selectedViewSale) return;
    setIsUpdatingDropbox(true);
    try {
      const res = await fetch("/api/sales/quick-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: selectedViewSale.id,
          action: "dropbox",
          dropboxFolder: quickDropboxFolder
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Carpeta de Dropbox renombrada exitosamente y base de datos actualizada.");
        setDropboxEditMode(false);
        fetchSales();
      } else {
        alert(`Error al renombrar Dropbox: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setIsUpdatingDropbox(false);
    }
  };

  const fetchSales = async () => {
    try {
      setSalesLoading(true);
      const res = await fetch("/api/sales");
      const data = await res.json();
      if (data.success) {
        setSales(data.sales || []);
      } else {
        setError(data.error || "Error al obtener las ventas.");
      }
    } catch (err) {
      console.error("Error fetching sales:", err);
      setError("Error de red al conectar con el servidor.");
    } finally {
      setSalesLoading(false);
    }
  };

  const handleRetry = async (saleId: string) => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/sales/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId })
      });
      const data = await res.json();
      if (data.success) {
        alert("Reintento iniciado exitosamente.");
        fetchSales();
      } else {
        alert(`Error al reintentar: ${data.error}`);
      }
    } catch (e) {
      alert("Error de conexión al reintentar.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleExportVentas = () => {
    if (filteredSales.length === 0) {
      alert("No hay ventas para exportar.");
      return;
    }

    const headers = [
      "Etapa",
      "Plataforma",
      "Codigo Venta",
      "Fecha de inicio",
      "Cliente",
      "Codigo Cliente (GHL ID)",
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

    const getComision = (plataforma: string) => {
      const plat = (plataforma || "").toLowerCase();
      if (plat === "freelancer") return "10%";
      if (plat === "workana") return "REVISAR";
      if (plat.includes("contrato") || plat === "freelancer con contrato") return "15%";
      return "0%";
    };

    const escapeCsv = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = filteredSales.map(sale => {
      const setter2 = sale.setters_adicionales_ids && sale.setters_adicionales_ids.length > 0
        ? (usersList.find(u => u.id === sale.setters_adicionales_ids![0])?.nombre || "")
        : "";
      const closer2 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 0
        ? (usersList.find(u => u.id === sale.closers_adicionales_ids![0])?.nombre || "")
        : "";
      const closer3 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 1
        ? (usersList.find(u => u.id === sale.closers_adicionales_ids![1])?.nombre || "")
        : "";

      return [
        escapeCsv(sale.status_pago || "PAGO ADELANTADO"),
        escapeCsv(sale.plataforma),
        escapeCsv(sale.codigo_venta),
        escapeCsv(new Date(sale.creado_en).toLocaleDateString("es-ES")),
        escapeCsv(sale.clientes?.nombre),
        escapeCsv(sale.clientes?.ghl_contact_id),
        escapeCsv(sale.proyecto_nombre),
        escapeCsv(`${sale.monto_total || 0} ${(sale.moneda || "USD").toUpperCase()}`),
        escapeCsv(getComision(sale.plataforma)),
        escapeCsv(sale.setter_principal?.nombre),
        escapeCsv(setter2),
        escapeCsv(sale.closer_principal?.nombre),
        escapeCsv(closer2),
        escapeCsv(closer3),
        escapeCsv(sale.comprobante_link),
        escapeCsv(sale.fecha_pago),
        '""', // Comisión de transferencia
        '""', // Fondo Gerencial
        '""', // Lider
        '""', // Asociaciado I
        '""', // % Asociaciado I
        '""', // Asociaciado II
        '""', // % Asociaciado II
        '""', // Asociaciado III
        '""', // % Asociaciado III
        '""', // Asociaciado IV
        '""', // % Asociaciado IV
        '""', // Asociaciado V
        '""'  // % Asociaciado V
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Cuadro_Maestro_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  useEffect(() => {
    async function loadSessionAndUsers() {
      try {
        setSessionLoading(true);
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.user) {
          setUser(sessionData.user);
          const usersRes = await fetch("/api/users");
          const usersData = await usersRes.json();
          if (usersData.success) {
            setUsersList(usersData.users || []);
          }
        }
      } catch (err) {
        console.error("Error al cargar sesión/usuarios:", err);
      } finally {
        setSessionLoading(false);
      }
    }
    loadSessionAndUsers();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user]);

  const filteredSales = sales.filter((sale) => {
    if (filterUserId && sale.usuario_registro_id !== filterUserId) {
      return false;
    }
    if (filterClient) {
      const clientName = sale.clientes?.nombre || "";
      if (!clientName.toLowerCase().includes(filterClient.toLowerCase())) {
        return false;
      }
    }
    if (filterProject) {
      const projectName = sale.proyecto_nombre || "";
      if (!projectName.toLowerCase().includes(filterProject.toLowerCase())) {
        return false;
      }
    }
    if (filterDate) {
      const d = new Date(sale.creado_en);
      const saleDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (saleDateString !== filterDate) {
        return false;
      }
    }
    return true;
  });
  return (
    <div>
      { }
      <div className={styles.pageHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <h1 className={styles.pageTitle}>Ventas</h1>
        </div>
      </div>
      {!sessionLoading && user?.role !== "auditor" && (
        <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
          <div className={styles.cardTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(-10deg)", color: "#0052cc" }}>
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <span>¡Felicidades!</span>
          </div>
          <p className={styles.cardDescription}>
            Si estás aquí, es porque estás a punto de registrar una venta.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className={styles.btnPrimary} onClick={() => { setModalGatingStep("choose"); setIsModalOpen(true); }}>
              <span>Nueva venta</span>
            </button>
            {(user?.role === "admin" || user?.role === "auditor") && (
              <button 
                className={styles.btnSecondary} 
                onClick={() => setIsCuadroMaestroOpen(true)} 
                style={{ borderColor: "#0052cc", color: "#0052cc" }}
              >
                <span>Cuadro maestro</span>
              </button>
            )}
          </div>
        </div>
      )}
      { }
      <div className={styles.card} style={{ minHeight: "450px", display: "flex", flexDirection: "column", padding: "2rem" }}>
        <div className={styles.cardTitle} style={{ justifyContent: "space-between", marginBottom: "1.5rem", width: "100%" }}>
          <span>Registro de Ventas</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={styles.btnSecondary}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", padding: 0, borderRadius: "8px", border: "1px solid #cbd5e1" }}
              title="Filtrar ventas"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
            <button
              className={styles.btnSecondary}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", padding: 0, borderRadius: "8px", border: "1px solid #cbd5e1" }}
              title="Exportar ventas"
              onClick={handleExportVentas}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        </div>
        {showFilters && (
          <div style={{ padding: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "8px", backgroundColor: "#f8fafc", marginBottom: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem", alignItems: "end" }}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569" }}>Cliente</label>
                <input
                  type="text"
                  placeholder="Coloca el nombre del cliente"
                  className={`${styles.input} ${styles.tallerFilterInput}`}
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569" }}>Proyecto</label>
                <input
                  type="text"
                  placeholder="Escribe el nombre del proyecto"
                  className={`${styles.input} ${styles.tallerFilterInput}`}
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569" }}>Fecha</label>
                <input
                  type="date"
                  className={`${styles.input} ${styles.tallerFilterInput}`}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  onClick={(e) => (e.target as any).showPicker?.()}
                />
              </div>
              {(user?.role === "auditor" || user?.role === "admin") && (
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label} style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569" }}>Usuario</label>
                  <select
                    className={`${styles.select} ${styles.tallerFilterInput}`}
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    style={{ paddingRight: "2.5rem" }}
                  >
                    <option value="">Todos los usuarios</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(filterClient || filterProject || filterDate || filterUserId) && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setFilterClient("");
                    setFilterProject("");
                    setFilterDate("");
                    setFilterUserId("");
                  }}
                  style={{ padding: "0.45rem 1rem", fontSize: "0.8rem", height: "42px", display: "inline-flex", justifyContent: "center", alignItems: "center" }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}
        { }
        {salesLoading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "4rem", flexGrow: 1 }}>
            <div className={styles.loadingSpinner} style={{ borderTopColor: "#0052cc" }}></div>
          </div>
        ) : error ? (
          <div className={styles.alertError} style={{ margin: "1rem 0" }}>
            <span>{error}</span>
          </div>
        ) : sales.length === 0 ? (
          <div className={styles.emptyState} style={{ flexGrow: 1 }}>
            <div className={styles.emptyStateIcon}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#94a3b8" }}>
                <path d="M12 10V16" />
                <path d="M12 10L9 13" />
                <path d="M12 10L15 13" />
                <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
              </svg>
            </div>
            <span className={styles.emptyStateText}>Aún no has registrado ventas</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className={styles.emptyState} style={{ flexGrow: 1 }}>
            <div className={styles.emptyStateIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#cbd5e1" }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span className={styles.emptyStateText}>No se encontraron ventas que coincidan con los filtros aplicados</span>
          </div>
        ) : (
          <>
            { }
            <div className={styles.salesDesktopView}>
              <div className={styles.salesTableContainer}>
                <table className={styles.salesTable}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Proyecto</th>
                      <th>Monto</th>
                      <th>Automatizaciones</th>
                      <th style={{ textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start", whiteSpace: "nowrap" }}>
                            <span className={styles.salesTableCode} title="ID/Código de la Venta (Correlativo Interno)">{sale.codigo_venta}</span>
                            {sale.codigo_factura && (
                              <span className={styles.salesTableCode} style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} title="ID/Número de Factura de GHL">
                                Factura {sale.codigo_factura}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {new Date(sale.creado_en).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td>
                          <span className={styles.salesTableClient}>{sale.clientes?.nombre || "N/A"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span className={styles.salesTableProject}>{sale.proyecto_nombre}</span>

                            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.55rem" }}>
                              <span className={styles.badgeSmallBlue}>{sale.tipo_venta}</span>

                              {sale.es_continuacion ? (
                                <span className={styles.badgeSmallGrey}>Continuación</span>
                              ) : (
                                <span className={styles.badgeSmallGreen}>Proyecto Nuevo</span>
                              )}
                              <span className={styles.badgeSmallPurple}>{sale.tipo_proyecto}</span>
                              {sale.urgente && (
                                <span style={{ alignSelf: "flex-start", fontSize: "0.725rem", fontWeight: "800", backgroundColor: "#fee2e2", color: "#ef4444", padding: "0.2rem 0.5rem", borderRadius: "3px", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                                  Urgente
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.salesTableAmount}>
                            {sale.moneda === "USD" ? "$" : ""}
                            {sale.monto_total}
                            {sale.moneda !== "USD" ? ` ${sale.moneda_otra || sale.moneda}` : " USD"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.automationsStatus}>
                            <div
                              className={`${styles.automationIconBadge} ${sale.status_trello === "COMPLETADO" ? styles.automationCompleted : sale.status_trello === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_trello)}
                              title={`Trello: ${sale.status_trello}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.333 2H4.667C3.197 2 2 3.197 2 4.667v14.666C2 20.803 3.197 22 4.667 22h14.666C20.803 22 22 20.803 22 19.333V4.667C22 3.197 20.803 2 19.333 2zM10.222 16.222c0 .49-.398.889-.889.889H5.778a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v10.444zm8.889-4.444c0 .49-.398.889-.889.889h-3.555a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v6z" />
                              </svg>
                            </div>

                            <div
                              className={`${styles.automationIconBadge} ${sale.status_dropbox === "COMPLETADO" ? styles.automationCompleted : sale.status_dropbox === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_dropbox)}
                              title={`Dropbox: ${sale.status_dropbox}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 2L1.5 5.5 6 9l4.5-3.5L6 2zm12 0l-4.5 3.5L18 9l4.5-3.5L18 2zM1.5 12.5L6 16l4.5-3.5-4.5-3.5-4.5 3.5zm16.5-3.5l-4.5 3.5 4.5 3.5 4.5-3.5-4.5-3.5zM6 17.5v2.25L12 23l6-3.25v-2.25l-6 3.75-6-3.75z" />
                              </svg>
                            </div>
                            <div
                              className={`${styles.automationIconBadge} ${(sale.status_ghl_contacto || sale.status_ghl) === "COMPLETADO" ? styles.automationCompleted : (sale.status_ghl_contacto || sale.status_ghl) === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_ghl_contacto || sale.status_ghl)}
                              title={`GHL Contacto: ${sale.status_ghl_contacto || sale.status_ghl || "PENDIENTE"}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </div>

                            <div
                              className={`${styles.automationIconBadge} ${(sale.status_ghl_factura || sale.status_ghl) === "COMPLETADO" ? styles.automationCompleted : (sale.status_ghl_factura || sale.status_ghl) === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_ghl_factura || sale.status_ghl)}
                              title={`GHL Factura: ${sale.status_ghl_factura || sale.status_ghl || "PENDIENTE"}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                              </svg>
                            </div>

                            <div
                              className={`${styles.automationIconBadge} ${sale.status_whatsapp === "COMPLETADO" ? styles.automationCompleted : sale.status_whatsapp === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_whatsapp)}
                              title={`WhatsApp: ${sale.status_whatsapp}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.202-1.362a9.92 9.92 0 0 0 4.808 1.258h.005c5.507 0 9.99-4.478 9.99-9.986 0-2.668-1.037-5.176-2.922-7.062C17.199 3.037 14.686 2 12.012 2zm5.727 14.168c-.25.7-.75 1.25-1.42 1.58-.57.28-1.25.43-3.15-.36-2.45-1.02-4.04-3.53-4.16-3.7-.12-.17-.99-1.32-.99-2.52 0-1.2.62-1.79.84-2.03.22-.24.48-.3.64-.3.16 0 .32.01.46.01.15 0 .35-.06.55.43.2.49.69 1.68.75 1.8.06.12.1.26.02.43-.08.17-.18.28-.3.43-.13.15-.27.33-.39.46-.14.15-.29.31-.12.6.17.29.74 1.22 1.59 1.98.85.76 1.56 1 1.86 1.13.3.13.48.11.66-.1.18-.21.78-.91.99-1.22.21-.31.42-.26.71-.15.29.11 1.86.88 2.18 1.04.32.16.53.24.61.38.08.14.08.82-.17 1.52z" />
                              </svg>
                            </div>
                            <div
                              className={`${styles.automationIconBadge} ${sale.status_email === "COMPLETADO" ? styles.automationCompleted : sale.status_email === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_email)}
                              title={`Email: ${sale.status_email}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                              </svg>
                            </div>
                            <div
                              className={`${styles.automationIconBadge} ${sale.status_sheets === "COMPLETADO" ? styles.automationCompleted : sale.status_sheets === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                              style={getBadgeStyle(sale.status_sheets)}
                              title={`Google Sheets: ${sale.status_sheets}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                              </svg>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className={styles.salesTableActions} style={{ justifyContent: "flex-end" }}>
                            <button
                              className={`${styles.btnActionCircle} ${styles.btnActionCircleVer}`}
                              onClick={() => setSelectedLogsSale(sale)}
                              title="Ver Estado de Sistema"
                              style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                              </svg>
                            </button>
                            <button
                              className={`${styles.btnActionCircle} ${styles.btnActionCircleVer}`}
                              onClick={() => setSelectedViewSale(sale)}
                              title="Ver detalle"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            { }
            <div className={styles.salesMobileView}>
              {filteredSales.map((sale) => (
                <div key={sale.id} className={styles.saleMobileCard}>
                  <div className={styles.saleMobileCardHeader}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start", whiteSpace: "nowrap" }}>
                      <span className={styles.salesTableCode} title="ID/Código de la Venta (Correlativo Interno)">{sale.codigo_venta}</span>
                      {sale.codigo_factura && (
                        <span className={styles.salesTableCode} style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} title="ID/Número de Factura de GHL">
                          Factura {sale.codigo_factura}
                        </span>
                      )}
                    </div>
                    <span className={styles.saleMobileCardDate}>
                      {new Date(sale.creado_en).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className={styles.saleMobileCardBody}>
                    <div className={styles.saleMobileCardRow}>
                      <span className={styles.saleMobileCardLabel}>Cliente</span>
                      <span className={styles.salesTableClient}>{sale.clientes?.nombre || "N/A"}</span>
                    </div>
                    <div className={styles.saleMobileCardRow} style={{ alignItems: "flex-start" }}>
                      <span className={styles.saleMobileCardLabel} style={{ marginTop: "0.2rem" }}>Proyecto</span>
                      <span className={styles.salesTableProject} style={{ textAlign: "right", maxWidth: "70%", wordBreak: "break-word" }}>
                        {sale.proyecto_nombre}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.25rem" }}>
                      <span className={styles.badgeSmallBlue}>{sale.tipo_venta}</span>
                      {sale.es_continuacion ? (
                        <span className={styles.badgeSmallGrey}>Continuación</span>
                      ) : (
                        <span className={styles.badgeSmallGreen}>Proyecto Nuevo</span>
                      )}
                      <span className={styles.badgeSmallPurple}>{sale.tipo_proyecto}</span>
                      {sale.urgente && (
                        <span style={{ alignSelf: "flex-start", fontSize: "0.725rem", fontWeight: "800", backgroundColor: "#fee2e2", color: "#ef4444", padding: "0.2rem 0.5rem", borderRadius: "3px", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                          Urgente
                        </span>
                      )}
                    </div>

                    <div className={styles.saleMobileCardRow} style={{ marginTop: "0.45rem" }}>
                      <span className={styles.saleMobileCardLabel}>Monto</span>
                      <span className={styles.salesTableAmount}>
                        {sale.moneda === "USD" ? "$" : ""}
                        {sale.monto_total}
                        {sale.moneda !== "USD" ? ` ${sale.moneda_otra || sale.moneda}` : " USD"}
                      </span>
                    </div>

                    <div className={styles.saleMobileCardRow} style={{ marginTop: "0.45rem" }}>
                      <span className={styles.saleMobileCardLabel}>Automatizaciones</span>
                      <div className={styles.automationsStatus}>
                        <div
                          className={`${styles.automationIconBadge} ${sale.status_trello === "COMPLETADO" ? styles.automationCompleted : sale.status_trello === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_trello)}
                          title={`Trello: ${sale.status_trello}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.333 2H4.667C3.197 2 2 3.197 2 4.667v14.666C2 20.803 3.197 22 4.667 22h14.666C20.803 22 22 20.803 22 19.333V4.667C22 3.197 20.803 2 19.333 2zM10.222 16.222c0 .49-.398.889-.889.889H5.778a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v10.444zm8.889-4.444c0 .49-.398.889-.889.889h-3.555a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v6z" />
                          </svg>
                        </div>

                        <div
                          className={`${styles.automationIconBadge} ${sale.status_dropbox === "COMPLETADO" ? styles.automationCompleted : sale.status_dropbox === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_dropbox)}
                          title={`Dropbox: ${sale.status_dropbox}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 2L1.5 5.5 6 9l4.5-3.5L6 2zm12 0l-4.5 3.5L18 9l4.5-3.5L18 2zM1.5 12.5L6 16l4.5-3.5-4.5-3.5-4.5 3.5zm16.5-3.5l-4.5 3.5 4.5 3.5 4.5-3.5-4.5-3.5zM6 17.5v2.25L12 23l6-3.25v-2.25l-6 3.75-6-3.75z" />
                          </svg>
                        </div>

                        <div
                          className={`${styles.automationIconBadge} ${(sale.status_ghl_contacto || sale.status_ghl) === "COMPLETADO" ? styles.automationCompleted : (sale.status_ghl_contacto || sale.status_ghl) === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_ghl_contacto || sale.status_ghl)}
                          title={`GHL Contacto: ${sale.status_ghl_contacto || sale.status_ghl || "PENDIENTE"}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>

                        <div
                          className={`${styles.automationIconBadge} ${(sale.status_ghl_factura || sale.status_ghl) === "COMPLETADO" ? styles.automationCompleted : (sale.status_ghl_factura || sale.status_ghl) === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_ghl_factura || sale.status_ghl)}
                          title={`GHL Factura: ${sale.status_ghl_factura || sale.status_ghl || "PENDIENTE"}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                        </div>

                        <div
                          className={`${styles.automationIconBadge} ${sale.status_whatsapp === "COMPLETADO" ? styles.automationCompleted : sale.status_whatsapp === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_whatsapp)}
                          title={`WhatsApp: ${sale.status_whatsapp}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.202-1.362a9.92 9.92 0 0 0 4.808 1.258h.005c5.507 0 9.99-4.478 9.99-9.986 0-2.668-1.037-5.176-2.922-7.062C17.199 3.037 14.686 2 12.012 2zm5.727 14.168c-.25.7-.75 1.25-1.42 1.58-.57.28-1.25.43-3.15-.36-2.45-1.02-4.04-3.53-4.16-3.7-.12-.17-.99-1.32-.99-2.52 0-1.2.62-1.79.84-2.03.22-.24.48-.3.64-.3.16 0 .32.01.46.01.15 0 .35-.06.55.43.2.49.69 1.68.75 1.8.06.12.1.26.02.43-.08.17-.18.28-.3.43-.13.15-.27.33-.39.46-.14.15-.29.31-.12.6.17.29.74 1.22 1.59 1.98.85.76 1.56 1 1.86 1.13.3.13.48.11.66-.1.18-.21.78-.91.99-1.22.21-.31.42-.26.71-.15.29.11 1.86.88 2.18 1.04.32.16.53.24.61.38.08.14.08.82-.17 1.52z" />
                          </svg>
                        </div>

                        <div
                          className={`${styles.automationIconBadge} ${sale.status_email === "COMPLETADO" ? styles.automationCompleted : sale.status_email === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_email)}
                          title={`Email: ${sale.status_email}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                        </div>
                        <div
                          className={`${styles.automationIconBadge} ${sale.status_sheets === "COMPLETADO" ? styles.automationCompleted : sale.status_sheets === "ERROR" ? styles.statusBadgeError : styles.automationPending}`}
                          style={getBadgeStyle(sale.status_sheets)}
                          title={`Google Sheets: ${sale.status_sheets}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.saleMobileCardFooter} style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className={styles.btnSecondary}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                      onClick={() => setSelectedLogsSale(sale)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                      <span>Sistema</span>
                    </button>
                    <button
                      className={styles.btnSecondary}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                      onClick={() => setSelectedViewSale(sale)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Detalle</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {user?.role !== "auditor" && (
        <VentasModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchSales}
          initialGatingStep={modalGatingStep}
        />
      )}
      { }
      {selectedViewSale && (
        <div className={styles.viewModalOverlay} onClick={() => setSelectedViewSale(null)}>
          <div className={styles.viewModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.viewModalHeader}>
              <div className={styles.viewModalTitleRow}>
                <h3 className={styles.viewModalTitle} style={{ fontWeight: "600" }}>Detalle de Venta</h3>
                <span className={styles.salesTableCode} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }} title="ID/Código de la Venta (Correlativo Interno)">
                  {selectedViewSale.codigo_venta}
                </span>
                {selectedViewSale.codigo_factura && (
                  <span className={styles.salesTableCode} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: "12px" }} title="ID/Número de Factura de GHL">
                    {selectedViewSale.codigo_factura}
                  </span>
                )}
                <span className={`${styles.badge} ${selectedViewSale.estado_interno === "Finalizada" ? styles.badgeActive : styles.roleventas}`} style={{ fontWeight: "500", fontSize: "0.75rem" }}>
                  {selectedViewSale.estado_interno}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedViewSale(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.viewModalBody} style={{ padding: "1.75rem 2rem 2rem 2rem", gap: "1.75rem" }}>

              <div className={styles.viewModalSideBySide}>

                <div className={styles.viewModalBlock}>
                  <div className={styles.viewModalBlockTitle} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>Datos del Cliente</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Nombre</span>
                      <span className={styles.viewModalDataValue}>{selectedViewSale.clientes?.nombre || "No especificado"}</span>
                    </div>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Email</span>
                      <span className={styles.viewModalDataValue}>{selectedViewSale.clientes?.email || "No registrado"}</span>
                    </div>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Teléfono</span>
                      <span className={styles.viewModalDataValue}>{selectedViewSale.clientes?.telefono || "No registrado"}</span>
                    </div>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>País / Empresa</span>
                      <span className={styles.viewModalDataValue}>
                        {selectedViewSale.clientes?.pais || "N/R"} {selectedViewSale.clientes?.empresa ? `(${selectedViewSale.clientes.empresa})` : ""}
                      </span>
                    </div>
                    {selectedViewSale.clientes?.link_usuario_plataforma && (
                      <div className={styles.viewModalDataRow}>
                        <span className={styles.viewModalDataLabel}>Enlace Plataforma</span>
                        <span className={styles.viewModalDataValue} style={{ marginTop: "0.25rem" }}>
                          <a href={selectedViewSale.clientes.link_usuario_plataforma} target="_blank" rel="noopener noreferrer" className={styles.btnLink}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            <span>Visitar Perfil</span>
                          </a>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.viewModalBlock}>
                  <div className={styles.viewModalBlockTitle} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>Datos del Proyecto</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Proyecto</span>
                      <span className={styles.viewModalDataValue}>{selectedViewSale.proyecto_nombre}</span>
                    </div>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Modalidad y Venta</span>
                      <span className={styles.viewModalDataValue}>
                        {selectedViewSale.tipo_proyecto} {selectedViewSale.tipo_proyecto === "Otro" ? `(${selectedViewSale.tipo_proyecto_otro})` : ""} | {selectedViewSale.tipo_venta}
                      </span>
                    </div>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Plataforma</span>
                      <span className={styles.viewModalDataValue}>{selectedViewSale.plataforma}</span>
                    </div>
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Fecha Límite (Deadline)</span>
                      <span className={styles.viewModalDataValue}>{selectedViewSale.deadline ? new Date(selectedViewSale.deadline).toLocaleDateString("es-ES") : "Sin deadline"}</span>
                    </div>
                    {(selectedViewSale.proyecto_link || selectedViewSale.proyecto_brief) && (
                      <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                        {selectedViewSale.proyecto_link && (
                          <div className={styles.viewModalDataRow}>
                            <span className={styles.viewModalDataLabel}>Trabajo</span>
                            <span className={styles.viewModalDataValue} style={{ marginTop: "0.25rem" }}>
                              <a href={selectedViewSale.proyecto_link} target="_blank" rel="noopener noreferrer" className={styles.btnLink}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                <span>Ver Proyecto</span>
                              </a>
                            </span>
                          </div>
                        )}
                        {selectedViewSale.proyecto_brief && (
                          <div className={styles.viewModalDataRow}>
                            <span className={styles.viewModalDataLabel}>Brief</span>
                            <span className={styles.viewModalDataValue} style={{ marginTop: "0.25rem" }}>
                              <a href={selectedViewSale.proyecto_brief} target="_blank" rel="noopener noreferrer" className={styles.btnLink}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                <span>Ver Brief</span>
                              </a>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.viewModalBlock} style={{ width: "100%" }}>
                <div className={styles.viewModalBlockTitle} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>Detalles Financieros y Comerciales</span>
                </div>
                <div className={styles.viewModalFinancialGrid}>
                  <div className={styles.viewModalDataRow}>
                    <span className={styles.viewModalDataLabel}>Monto Total</span>
                    <span className={styles.viewModalDataValue} style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                      {selectedViewSale.moneda === "USD" ? "$" : ""}
                      {selectedViewSale.monto_total}
                      {selectedViewSale.moneda !== "USD" ? ` ${selectedViewSale.moneda_otra || selectedViewSale.moneda}` : " USD"}
                    </span>
                  </div>
                  <div className={styles.viewModalDataRow}>
                    <span className={styles.viewModalDataLabel}>Estado de Pago</span>
                    <span className={styles.viewModalDataValue}>{selectedViewSale.status_pago}</span>
                  </div>
                  <div className={styles.viewModalDataRow}>
                    <span className={styles.viewModalDataLabel}>Fecha de Pago</span>
                    <span className={styles.viewModalDataValue}>{selectedViewSale.fecha_pago ? new Date(selectedViewSale.fecha_pago).toLocaleDateString("es-ES") : "N/R"}</span>
                  </div>
                  {selectedViewSale.monto_pagado !== null && selectedViewSale.monto_pagado !== undefined && (
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Monto Pagado Parcial</span>
                      <span className={styles.viewModalDataValue}>${selectedViewSale.monto_pagado} USD</span>
                    </div>
                  )}
                  {selectedViewSale.comision_total !== null && selectedViewSale.comision_total !== undefined && (
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Comisión Cobrada</span>
                      <span className={styles.viewModalDataValue}>${selectedViewSale.comision_total} USD</span>
                    </div>
                  )}
                  <div className={styles.viewModalDataRow}>
                    <span className={styles.viewModalDataLabel}>Tipo Cierre</span>
                    <span className={styles.viewModalDataValue}>{selectedViewSale.tipo_cierre}</span>
                  </div>
                  <div className={styles.viewModalDataRow}>
                    <span className={styles.viewModalDataLabel}>Setter / Closer</span>
                    <span className={styles.viewModalDataValue}>
                      {selectedViewSale.setter_principal?.nombre || "N/A"} / {selectedViewSale.closer_principal?.nombre || "N/A"}
                    </span>
                  </div>
                  <div className={styles.viewModalDataRow}>
                    <span className={styles.viewModalDataLabel}>Registrado Por</span>
                    <span className={styles.viewModalDataValue}>{selectedViewSale.registrador?.nombre || "N/A"}</span>
                  </div>
                  {selectedViewSale.comprobante_link && (
                    <div className={styles.viewModalDataRow}>
                      <span className={styles.viewModalDataLabel}>Comprobante</span>
                      <span className={styles.viewModalDataValue} style={{ marginTop: "0.25rem" }}>
                        <a href={selectedViewSale.comprobante_link} target="_blank" rel="noopener noreferrer" className={styles.btnLink}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <line x1="12" y1="4" x2="12" y2="20" />
                          </svg>
                          <span>Ver Comprobante</span>
                        </a>
                      </span>
                    </div>
                  )}
                </div>
                {selectedViewSale.descripcion_operativa && (
                  <div className={styles.viewModalDataRow} style={{ marginTop: "0.5rem" }}>
                    <span className={styles.viewModalDataLabel}>Descripción Operativa</span>
                    <span className={styles.viewModalDataValue} style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {selectedViewSale.descripcion_operativa}
                    </span>
                  </div>
                )}
                {selectedViewSale.notas_internas && (
                  <div className={styles.viewModalDataRow} style={{ marginTop: "0.5rem" }}>
                    <span className={styles.viewModalDataLabel}>Notas Internas</span>
                    <span className={styles.viewModalDataValue} style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {selectedViewSale.notas_internas}
                    </span>
                  </div>
                )}
              </div>

              {/* Tarjeta de Trello */}
              {selectedViewSale.status_trello === "COMPLETADO" && (
                <div className={styles.viewModalBlock} style={{ width: "100%", marginTop: "1rem" }}>
                  <div className={styles.viewModalBlockTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Tarjeta de Trello</span>
                    {!trelloEditMode && (
                      <button
                        className={styles.btnSecondary}
                        onClick={() => setTrelloEditMode(true)}
                        style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}
                      >
                        Modificar
                      </button>
                    )}
                  </div>
                  {trelloEditMode ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "500", display: "block", marginBottom: "0.25rem" }}>Nombre de la Tarjeta</label>
                        <input
                          type="text"
                          value={quickTrelloTitle}
                          onChange={(e) => setQuickTrelloTitle(e.target.value)}
                          className={styles.input}
                          style={{ fontSize: "0.75rem", padding: "0.4rem" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "500", display: "block", marginBottom: "0.25rem" }}>Descripción</label>
                        <textarea
                          value={quickTrelloDesc}
                          onChange={(e) => setQuickTrelloDesc(e.target.value)}
                          className={styles.input}
                          style={{ fontSize: "0.75rem", padding: "0.4rem", minHeight: "80px", resize: "vertical" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className={styles.btnSecondary}
                          onClick={handleUpdateTrello}
                          disabled={isUpdatingTrello}
                          style={{ fontSize: "0.7rem", padding: "0.4rem 0.75rem", backgroundColor: "#22c55e", color: "#ffffff", border: "none" }}
                        >
                          {isUpdatingTrello ? "Guardando..." : "Guardar"}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setTrelloEditMode(false);
                            if (selectedViewSale) {
                              const cleanedProj = (selectedViewSale.proyecto_nombre || "")
                                .replace(/^azabache\s+producciones\s*-\s*/i, "")
                                .replace(/^azabache\s+producciones\s*/i, "")
                                .trim();
                              const clientName = selectedViewSale.clientes?.nombre || "";
                              setQuickTrelloTitle(`${cleanedProj} - ${clientName}`);
                            }
                          }}
                          style={{ fontSize: "0.7rem", padding: "0.4rem 0.75rem" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <div className={styles.viewModalDataRow}>
                        <span className={styles.viewModalDataLabel}>Nombre en Tarjeta</span>
                        <span className={styles.viewModalDataValue}>{isSyncingTrello ? "Sincronizando..." : quickTrelloTitle}</span>
                      </div>
                      <div className={styles.viewModalDataRow}>
                        <span className={styles.viewModalDataLabel}>Descripción en Tarjeta</span>
                        <span className={styles.viewModalDataValue} style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", backgroundColor: "#f8fafc", padding: "0.5rem", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                          {isSyncingTrello ? "Sincronizando..." : quickTrelloDesc}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Carpeta de Dropbox */}
              {selectedViewSale.status_dropbox === "COMPLETADO" && (
                <div className={styles.viewModalBlock} style={{ width: "100%", marginTop: "1rem" }}>
                  <div className={styles.viewModalBlockTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Carpeta de Dropbox</span>
                    {!dropboxEditMode && (
                      <button
                        className={styles.btnSecondary}
                        onClick={() => setDropboxEditMode(true)}
                        style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}
                      >
                        Modificar
                      </button>
                    )}
                  </div>
                  {dropboxEditMode ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "500", display: "block", marginBottom: "0.25rem" }}>Nombre de la Carpeta</label>
                        <input
                          type="text"
                          value={quickDropboxFolder}
                          onChange={(e) => setQuickDropboxFolder(e.target.value)}
                          className={styles.input}
                          style={{ fontSize: "0.75rem", padding: "0.4rem" }}
                        />
                      </div>
                      <span style={{ fontSize: "0.65rem", color: "#64748b", lineHeight: 1.4 }}>
                        * El formato recomendado es: <code>[Nombre Cliente] - [Nombre Proyecto]</code>. Al guardar se renombrará la carpeta remota y se actualizará el proyecto en Supabase.
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className={styles.btnSecondary}
                          onClick={handleUpdateDropbox}
                          disabled={isUpdatingDropbox}
                          style={{ fontSize: "0.7rem", padding: "0.4rem 0.75rem", backgroundColor: "#22c55e", color: "#ffffff", border: "none" }}
                        >
                          {isUpdatingDropbox ? "Guardando..." : "Guardar"}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setDropboxEditMode(false);
                            if (selectedViewSale) {
                              const cleanedProj = (selectedViewSale.proyecto_nombre || "")
                                .replace(/^azabache\s+producciones\s*-\s*/i, "")
                                .replace(/^azabache\s+producciones\s*/i, "")
                                .trim();
                              const clientName = selectedViewSale.clientes?.nombre || "";
                              setQuickDropboxFolder(`${clientName} - ${cleanedProj}`);
                            }
                          }}
                          style={{ fontSize: "0.7rem", padding: "0.4rem 0.75rem" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <div className={styles.viewModalDataRow}>
                        <span className={styles.viewModalDataLabel}>Nombre de Carpeta</span>
                        <span className={styles.viewModalDataValue}>{quickDropboxFolder}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.pipelineSection}>
                <div className={styles.pipelineTitle}>
                  Proceso de automatizaciones
                </div>
                <div className={styles.pipelineContainer}>

                  <div
                    className={`${styles.pipelineBox} ${selectedViewSale.status_trello === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      selectedViewSale.status_trello === "ERROR" ? styles.pipelineBoxError :
                        selectedViewSale.status_trello === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_trello)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M19.333 2H4.667C3.197 2 2 3.197 2 4.667v14.666C2 20.803 3.197 22 4.667 22h14.666C20.803 22 22 20.803 22 19.333V4.667C22 3.197 20.803 2 19.333 2zM10.222 16.222c0 .49-.398.889-.889.889H5.778a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v10.444zm8.889-4.444c0 .49-.398.889-.889.889h-3.555a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v6z" />
                      </svg>
                      <span>Trello</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_trello}
                    </span>
                    {selectedViewSale.link_trello && (
                      <a href={selectedViewSale.link_trello} target="_blank" rel="noopener noreferrer" className={styles.btnLink} style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem", marginTop: "0.15rem", width: "fit-content" }}>
                        <span>Ver Tablero</span>
                      </a>
                    )}
                  </div>
                  <div className={styles.pipelineArrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                  <div
                    className={`${styles.pipelineBox} ${selectedViewSale.status_dropbox === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      selectedViewSale.status_dropbox === "ERROR" ? styles.pipelineBoxError :
                        selectedViewSale.status_dropbox === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_dropbox)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M6 2L1.5 5.5 6 9l4.5-3.5L6 2zm12 0l-4.5 3.5L18 9l4.5-3.5L18 2zM1.5 12.5L6 16l4.5-3.5-4.5-3.5-4.5 3.5zm16.5-3.5l-4.5 3.5 4.5 3.5 4.5-3.5-4.5-3.5zM6 17.5v2.25L12 23l6-3.25v-2.25l-6 3.75-6-3.75z" />
                      </svg>
                      <span>Dropbox</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_dropbox}
                    </span>
                    {selectedViewSale.carpeta_dropbox && (
                      <a href={selectedViewSale.carpeta_dropbox} target="_blank" rel="noopener noreferrer" className={styles.btnLink} style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem", marginTop: "0.15rem", width: "fit-content" }}>
                        <span>Ver Carpeta</span>
                      </a>
                    )}
                  </div>
                  <div className={styles.pipelineArrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                  <div
                    className={`${styles.pipelineBox} ${(selectedViewSale.status_ghl_contacto || selectedViewSale.status_ghl) === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      (selectedViewSale.status_ghl_contacto || selectedViewSale.status_ghl) === "ERROR" ? styles.pipelineBoxError :
                        (selectedViewSale.status_ghl_contacto || selectedViewSale.status_ghl) === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_ghl_contacto || selectedViewSale.status_ghl)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>GHL Contacto</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_ghl_contacto || selectedViewSale.status_ghl || "PENDIENTE"}
                    </span>
                  </div>
                  <div className={styles.pipelineArrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                  <div
                    className={`${styles.pipelineBox} ${(selectedViewSale.status_ghl_factura || selectedViewSale.status_ghl) === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      (selectedViewSale.status_ghl_factura || selectedViewSale.status_ghl) === "ERROR" ? styles.pipelineBoxError :
                        (selectedViewSale.status_ghl_factura || selectedViewSale.status_ghl) === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_ghl_factura || selectedViewSale.status_ghl)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <span>GHL Factura</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_ghl_factura || selectedViewSale.status_ghl || "PENDIENTE"}
                    </span>
                  </div>
                  <div className={styles.pipelineArrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                  <div
                    className={`${styles.pipelineBox} ${selectedViewSale.status_whatsapp === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      selectedViewSale.status_whatsapp === "ERROR" ? styles.pipelineBoxError :
                        selectedViewSale.status_whatsapp === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_whatsapp)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.202-1.362a9.92 9.92 0 0 0 4.808 1.258h.005c5.507 0 9.99-4.478 9.99-9.986 0-2.668-1.037-5.176-2.922-7.062C17.199 3.037 14.686 2 12.012 2zm5.727 14.168c-.25.7-.75 1.25-1.42 1.58-.57.28-1.25.43-3.15-.36-2.45-1.02-4.04-3.53-4.16-3.7-.12-.17-.99-1.32-.99-2.52 0-1.2.62-1.79.84-2.03.22-.24.48-.3.64-.3.16 0 .32.01.46.01.15 0 .35-.06.55.43.2.49.69 1.68.75 1.8.06.12.1.26.02.43-.08.17-.18.28-.3.43-.13.15-.27.33-.39.46-.14.15-.29.31-.12.6.17.29.74 1.22 1.59 1.98.85.76 1.56 1 1.86 1.13.3.13.48.11.66-.1.18-.21.78-.91.99-1.22.21-.31.42-.26.71-.15.29.11 1.86.88 2.18 1.04.32.16.53.24.61.38.08.14.08.82-.17 1.52z" />
                      </svg>
                      <span>WhatsApp</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_whatsapp}
                    </span>
                  </div>
                  <div className={styles.pipelineArrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                  <div
                    className={`${styles.pipelineBox} ${selectedViewSale.status_email === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      selectedViewSale.status_email === "ERROR" ? styles.pipelineBoxError :
                        selectedViewSale.status_email === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_email)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                      </svg>
                      <span>Email</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_email}
                    </span>
                  </div>
                  <div className={styles.pipelineArrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                  <div
                    className={`${styles.pipelineBox} ${selectedViewSale.status_sheets === "COMPLETADO" ? styles.pipelineBoxCompleted :
                      selectedViewSale.status_sheets === "ERROR" ? styles.pipelineBoxError :
                        selectedViewSale.status_sheets === "PROCESANDO" ? styles.pipelineBoxProcessing : styles.pipelineBoxPending
                      }`}
                    style={getPipelineBoxStyle(selectedViewSale.status_sheets)}
                  >
                    <div className={styles.pipelineBoxHeader}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="3" y1="15" x2="21" y2="15" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                      </svg>
                      <span>Google Sheets</span>
                    </div>
                    <span className={styles.pipelineBoxStatus}>
                      {selectedViewSale.status_sheets || "PENDIENTE"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLogsSale && (
        <div className={styles.viewModalOverlay} onClick={() => setSelectedLogsSale(null)}>
          <div className={styles.viewModalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
            <div className={styles.viewModalHeader}>
              <div className={styles.viewModalTitleRow}>
                <h3 className={styles.viewModalTitle} style={{ fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  Estado de la venta
                </h3>
                <span className={styles.salesTableCode} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", backgroundColor: "#f1f5f9" }} title="ID/Código de la Venta (Correlativo Interno)">
                  {selectedLogsSale.codigo_venta}
                </span>
                {selectedLogsSale.codigo_factura && (
                  <span className={styles.salesTableCode} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} title="ID/Número de Factura de GHL">
                    Factura {selectedLogsSale.codigo_factura}
                  </span>
                )}
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedLogsSale(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.viewModalBody} style={{ padding: "1.75rem 2rem", backgroundColor: "#ffffff" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>Flujo de Integraciones</h4>

                <button
                  className={styles.btnSecondary}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", padding: "0.4rem 0.75rem", backgroundColor: "#f8fafc" }}
                  onClick={() => handleRetry(selectedLogsSale.id)}
                  disabled={isRetrying}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isRetrying ? styles.spinAnimation : ""}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  <span>{isRetrying ? "Procesando..." : "Reintentar fallidos"}</span>
                </button>
              </div>

              {/* Status summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", backgroundColor: "#fafafa", marginBottom: "1.5rem" }}>
                {(() => {
                  const renderStatusItem = (name: string, status: string) => {
                    const isError = status === "ERROR";
                    const isCompleted = status === "COMPLETADO";
                    const isDeactivated = status === "DESACTIVADO";
                    const isPending = !isError && !isCompleted && !isDeactivated;

                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: "500" }}>{name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {isCompleted && <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22c55e" }}></span>}
                          {isError && <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444" }}></span>}
                          {isDeactivated && <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#94a3b8" }}></span>}
                          {isPending && <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#cbd5e1" }}></span>}
                          <span style={{ fontSize: "0.75rem", color: isError ? "#ef4444" : isCompleted ? "#22c55e" : isDeactivated ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {renderStatusItem("GHL Contacto", selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl || "PENDIENTE")}
                      {renderStatusItem("GHL Factura", selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl || "PENDIENTE")}
                      {renderStatusItem("Trello (Tarjeta)", selectedLogsSale.status_trello || "PENDIENTE")}
                      {renderStatusItem("Dropbox (Carpeta)", selectedLogsSale.status_dropbox || "PENDIENTE")}
                      {renderStatusItem("WhatsApp (Zapier)", selectedLogsSale.status_whatsapp || "PENDIENTE")}
                      {renderStatusItem("Email Equipo (GHL)", selectedLogsSale.status_email || "PENDIENTE")}
                      {renderStatusItem("Cuadro Maestro Local", selectedLogsSale.status_sheets || "PENDIENTE")}
                    </>
                  );
                })()}
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "0.75rem" }}>
                  Registro de Eventos (Logs)
                </h4>
                <div style={{ backgroundColor: "#f1f5f9", borderRadius: "8px", padding: "1rem", border: "1px solid #e2e8f0", fontFamily: "monospace", fontSize: "0.8rem", color: "#475569", minHeight: "150px", maxHeight: "350px", overflowY: "auto" }}>
                  {loadingLogs ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px", color: "#94a3b8" }}>
                      <span>Cargando historial de logs...</span>
                    </div>
                  ) : saleLogs.length > 0 ? (
                    <>
                      {saleLogs.map((log: any) => {
                        const isError = log.tipo === "ERROR";
                        const isSuccess = log.tipo === "SUCCESS";
                        const isDeactivated = log.tipo === "INFO" && (log.mensaje.toLowerCase().includes("desactivada") || log.mensaje.toLowerCase().includes("desactivado") || log.mensaje.toLowerCase().includes("desactivar"));
                        const color = isError ? "#ef4444" : isDeactivated ? "#94a3b8" : "inherit";

                        return (
                          <div key={log.id} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: color, lineHeight: "1.4" }}>
                            <span style={{ color: "#94a3b8" }}>[{new Date(log.creado_en).toLocaleTimeString("es-ES")}]</span>
                            <span style={{ fontWeight: "600", color: isError ? "#ef4444" : isSuccess ? "#16a34a" : "#475569" }}>[{log.integracion.toUpperCase()}]</span>
                            <span>{log.mensaje}</span>
                          </div>
                        );
                      })}
                      {(selectedLogsSale.status_trello === "ERROR" || selectedLogsSale.status_dropbox === "ERROR" || selectedLogsSale.status_ghl === "ERROR" || selectedLogsSale.status_ghl_contacto === "ERROR" || selectedLogsSale.status_ghl_factura === "ERROR" || selectedLogsSale.status_email === "ERROR" || selectedLogsSale.status_whatsapp === "ERROR" || selectedLogsSale.status_sheets === "ERROR") && (
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                          <span style={{ color: "#ef4444", fontWeight: "600" }}>[!]</span>
                          <span style={{ color: "#ef4444" }}>Hay errores en el flujo. Puedes hacer clic en "Reintentar fallidos".</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                        <span style={{ fontWeight: "600" }}>[SYSTEM]</span>
                        <span>Registro creado exitosamente en la base de datos principal.</span>
                      </div>

                      {(selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl) && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: (selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl) === "ERROR" ? "#ef4444" : (selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl) === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[GHL CONTACTO]</span>
                          <span>
                            {(selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl) === "DESACTIVADO"
                              ? "Integración desactivada: Creación/sincronización de contacto en GHL omitida por el administrador."
                              : (selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl) === "COMPLETADO"
                                ? "Búsqueda/creación de contacto en GHL completada con éxito."
                                : `Proceso de contacto GHL: ${selectedLogsSale.status_ghl_contacto || selectedLogsSale.status_ghl}`}
                          </span>
                        </div>
                      )}

                      {(selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl) && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: (selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl) === "ERROR" ? "#ef4444" : (selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl) === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[GHL FACTURA]</span>
                          <span>
                            {(selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl) === "DESACTIVADO"
                              ? "Integración desactivada: Creación de factura borrador en GHL omitida por el administrador."
                              : (selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl) === "COMPLETADO"
                                ? "Generación de factura borrador en GHL completada con éxito."
                                : `Proceso de factura GHL: ${selectedLogsSale.status_ghl_factura || selectedLogsSale.status_ghl}`}
                          </span>
                        </div>
                      )}

                      {selectedLogsSale.status_trello && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: selectedLogsSale.status_trello === "ERROR" ? "#ef4444" : selectedLogsSale.status_trello === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[TRELLO]</span>
                          <span>
                            {selectedLogsSale.status_trello === "DESACTIVADO"
                              ? "Integración desactivada: Creación de tarjeta de proyecto en Trello omitida por el administrador."
                              : selectedLogsSale.status_trello === "COMPLETADO"
                                ? "Tarjeta de proyecto creada en Trello con éxito."
                                : `Sincronización de tablero Trello: ${selectedLogsSale.status_trello}`}
                          </span>
                        </div>
                      )}

                      {selectedLogsSale.status_dropbox && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: selectedLogsSale.status_dropbox === "ERROR" ? "#ef4444" : selectedLogsSale.status_dropbox === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[DROPBOX]</span>
                          <span>
                            {selectedLogsSale.status_dropbox === "DESACTIVADO"
                              ? "Integración desactivada: Creación de carpeta en Dropbox omitida por el administrador."
                              : selectedLogsSale.status_dropbox === "COMPLETADO"
                                ? "Carpeta de proyecto en Dropbox creada con éxito."
                                : `Creación de directorio Dropbox: ${selectedLogsSale.status_dropbox}`}
                          </span>
                        </div>
                      )}

                      {selectedLogsSale.status_email && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: selectedLogsSale.status_email === "ERROR" ? "#ef4444" : selectedLogsSale.status_email === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[EMAIL]</span>
                          <span>
                            {selectedLogsSale.status_email === "DESACTIVADO"
                              ? "Integración desactivada: Notificación de email interno omitida por el administrador."
                              : selectedLogsSale.status_email === "COMPLETADO"
                                ? "Notificación de email al equipo enviada con éxito."
                                : `Envío de email de notificación: ${selectedLogsSale.status_email}`}
                          </span>
                        </div>
                      )}

                      {selectedLogsSale.status_whatsapp && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: selectedLogsSale.status_whatsapp === "ERROR" ? "#ef4444" : selectedLogsSale.status_whatsapp === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[WHATSAPP]</span>
                          <span>
                            {selectedLogsSale.status_whatsapp === "DESACTIVADO"
                              ? "Integración desactivada: Notificación de WhatsApp por Zapier omitida por el administrador."
                              : selectedLogsSale.status_whatsapp === "COMPLETADO"
                                ? "Notificación de WhatsApp enviada al grupo con éxito."
                                : `Envío de mensaje de WhatsApp: ${selectedLogsSale.status_whatsapp}`}
                          </span>
                        </div>
                      )}

                      {selectedLogsSale.status_sheets && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: selectedLogsSale.status_sheets === "ERROR" ? "#ef4444" : selectedLogsSale.status_sheets === "DESACTIVADO" ? "#94a3b8" : "inherit" }}>
                          <span style={{ color: "#94a3b8" }}>[{new Date(selectedLogsSale.creado_en).toLocaleTimeString()}]</span>
                          <span style={{ fontWeight: "600" }}>[SHEETS]</span>
                          <span>
                            {selectedLogsSale.status_sheets === "DESACTIVADO"
                              ? "Integración desactivada: Inserción de fila en Google Sheets omitida por el administrador."
                              : selectedLogsSale.status_sheets === "COMPLETADO"
                                ? "Fila insertada en Google Sheets con éxito."
                                : `Envío a Google Sheets: ${selectedLogsSale.status_sheets}`}
                          </span>
                        </div>
                      )}

                      {(selectedLogsSale.status_trello === "ERROR" || selectedLogsSale.status_dropbox === "ERROR" || selectedLogsSale.status_ghl === "ERROR" || selectedLogsSale.status_ghl_contacto === "ERROR" || selectedLogsSale.status_ghl_factura === "ERROR" || selectedLogsSale.status_email === "ERROR" || selectedLogsSale.status_whatsapp === "ERROR" || selectedLogsSale.status_sheets === "ERROR") && (
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                          <span style={{ color: "#ef4444", fontWeight: "600" }}>[!]</span>
                          <span style={{ color: "#ef4444" }}>Hay errores en el flujo. Puedes hacer clic en "Reintentar fallidos".</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className={styles.viewModalBlock} style={{ width: "100%", marginTop: "1.5rem" }}>
                <div className={styles.viewModalBlockTitle} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#64748b" }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>Enlaces Generados por Automatización</span>
                </div>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {selectedLogsSale.link_trello ? (
                    <a href={selectedLogsSale.link_trello} target="_blank" rel="noopener noreferrer" className={styles.btnLink} style={{ backgroundColor: "#f1f5f9", padding: "0.5rem 1rem", borderRadius: "6px" }}>
                      <span>🔗 Tarjeta de Trello</span>
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8", padding: "0.5rem" }}>Trello pendiente...</span>
                  )}

                  {selectedLogsSale.carpeta_dropbox ? (
                    <a href={selectedLogsSale.carpeta_dropbox} target="_blank" rel="noopener noreferrer" className={styles.btnLink} style={{ backgroundColor: "#f1f5f9", padding: "0.5rem 1rem", borderRadius: "6px" }}>
                      <span>📁 Carpeta Dropbox</span>
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8", padding: "0.5rem" }}>Dropbox pendiente...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCuadroMaestroOpen && (
        <CuadroMaestroModal
          isOpen={isCuadroMaestroOpen}
          onClose={() => setIsCuadroMaestroOpen(false)}
          usersList={usersList}
          userRole={user?.role || ""}
          onRefreshSales={fetchSales}
        />
      )}
    </div>
  );
}