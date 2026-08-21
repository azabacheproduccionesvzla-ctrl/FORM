"use client";

import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";
import ImportModal from "./ImportModal";
import { formatAmount, formatCurrency } from "@/lib/formatters";

interface Project {
  id: string;
  nombre: string;
  trello_card_id: string | null;
  trello_list_id: string | null;
  link_trello: string | null;
  carpeta_dropbox: string | null;
  activo: boolean;
  creado_en: string;
  clientes: {
    id: string;
    nombre: string;
    empresa: string | null;
  } | null;
  ventas: {
    id: string;
    codigo_venta: string | null;
    monto_total: number | null;
    moneda: string | null;
    urgente: boolean | null;
  } | null;
}

// Helper function to generate paginated page numbers
function getPageNumbers(currentPage: number, totalPages: number) {
  const pages: (number | string)[] = [];
  if (totalPages <= 8) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  pages.push(1);
  pages.push(2);

  let middleStart = Math.max(3, currentPage - 1);
  let middleEnd = Math.min(totalPages - 2, middleStart + 1);

  if (currentPage <= 3) {
    middleStart = 3;
    middleEnd = 4;
  } else if (currentPage >= totalPages - 2) {
    middleStart = totalPages - 3;
    middleEnd = totalPages - 2;
  }

  if (middleStart > 3) {
    pages.push("...");
  }

  for (let i = middleStart; i <= middleEnd; i++) {
    pages.push(i);
  }

  if (middleEnd < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages - 1);
  pages.push(totalPages);

  return Array.from(new Set(pages));
}

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter states
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "activos" | "deshabilitados">("todos");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // PIN modal states
  const [selectedProjectForToggle, setSelectedProjectForToggle] = useState<Project | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState<string[]>(Array(6).fill(""));
  const [pinError, setPinError] = useState<string | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 8;

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Helper to get local date format YYYY-MM-DD
  function getLocalDateString(dateStr: string) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return "";
    }
  }

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchProjects = async (query = "") => {
    try {
      setLoading(true);
      const url = query ? `/api/projects?search=${encodeURIComponent(query)}` : "/api/projects";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
      } else {
        setError(data.error || "Error al obtener proyectos.");
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError("Error de red al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPinModal = (project: Project) => {
    setSelectedProjectForToggle(project);
    setPin(Array(6).fill(""));
    setPinError(null);
    setShowPinModal(true);
    setTimeout(() => {
      const el = document.getElementById("project-pin-input-0");
      if (el) el.focus();
    }, 100);
  };

  const handlePinChange = (index: number, value: string) => {
    if (value !== "" && !/^[0-9]$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value !== "" && index < 5) {
      const nextInput = document.getElementById(`project-pin-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (pin[index] === "" && index > 0) {
        const newPin = [...pin];
        newPin[index - 1] = "";
        setPin(newPin);
        const prevInput = document.getElementById(`project-pin-input-${index - 1}`);
        if (prevInput) prevInput.focus();
      } else {
        const newPin = [...pin];
        newPin[index] = "";
        setPin(newPin);
      }
    }
  };

  const handleConfirmToggleWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForToggle) return;
    const pinStr = pin.join("");
    if (pinStr.length !== 6) {
      setPinError("Debes ingresar los 6 dígitos del PIN de seguridad.");
      return;
    }

    setSubmittingPin(true);
    setPinError(null);

    try {
      const newActiveState = !selectedProjectForToggle.activo;
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProjectForToggle.id,
          activo: newActiveState,
          pin: pinStr,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedProjectForToggle.id ? { ...p, activo: newActiveState } : p
          )
        );
        setShowPinModal(false);
        setSelectedProjectForToggle(null);
        setPin(Array(6).fill(""));
      } else {
        setPinError(data.error || "Error al cambiar el estado del proyecto.");
        setPin(Array(6).fill(""));
        setTimeout(() => {
          const el = document.getElementById("project-pin-input-0");
          if (el) el.focus();
        }, 50);
      }
    } catch (err) {
      console.error("Error toggling project status:", err);
      setPinError("Error de conexión al intentar cambiar el estado.");
    } finally {
      setSubmittingPin(false);
    }
  };


  useEffect(() => {
    fetchProjects(debouncedSearch);
  }, [debouncedSearch]);

  // Apply filters client-side
  const filteredProjects = projects.filter((project) => {
    if (filterDate) {
      const localDateStr = getLocalDateString(project.creado_en);
      if (localDateStr !== filterDate) return false;
    }
    if (filterStatus === "activos" && !project.activo) return false;
    if (filterStatus === "deshabilitados" && project.activo) return false;
    return true;
  });

  const handleExportProyectos = () => {
    if (filteredProjects.length === 0) {
      alert("No hay proyectos para exportar.");
      return;
    }

    const headers = ["Nombre Proyecto", "Cliente", "Empresa Cliente", "Código Venta", "Monto Venta", "Urgente", "Trello ID", "Link Trello", "Carpeta Dropbox", "Estado", "Fecha Registro"];
    
    const escapeCsv = (val: string | number | boolean | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = filteredProjects.map(project => [
      escapeCsv(project.nombre),
      escapeCsv(project.clientes?.nombre),
      escapeCsv(project.clientes?.empresa),
      escapeCsv(project.ventas?.codigo_venta),
      escapeCsv(project.ventas?.monto_total !== undefined && project.ventas?.monto_total !== null ? `${formatAmount(project.ventas.monto_total)} ${project.ventas.moneda || ""}`.trim() : ""),
      escapeCsv(project.ventas?.urgente ? "SÍ" : "NO"),
      escapeCsv(project.trello_card_id),
      escapeCsv(project.link_trello),
      escapeCsv(project.carpeta_dropbox),
      escapeCsv(project.activo ? "Activo" : "Archivado"),
      escapeCsv(new Date(project.creado_en).toLocaleDateString("es-ES"))
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Proyectos_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination Math
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const endIndex = startIndex + projectsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>Proyectos</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className={styles.btnPrimary}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", height: "42px", padding: "0 1rem", borderRadius: "8px", fontSize: "0.85rem" }}
            title="Importar proyectos desde CSV/Excel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Importar</span>
          </button>
          <button
            onClick={handleExportProyectos}
            className={styles.btnSecondary}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", height: "42px", padding: "0 1rem", borderRadius: "8px", fontSize: "0.85rem" }}
            title="Exportar proyectos a CSV"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem", alignItems: "center" }}>
        <div className={styles.formGroup} style={{ marginBottom: 0, flexGrow: 1, minWidth: "250px" }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Buscar por nombre de proyecto, cliente o código..."
              className={styles.input}
              style={{ paddingLeft: "2.5rem" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#64748b", display: "flex", alignItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Estado:</span>
            <select
              className={styles.input}
              style={{ width: "160px", height: "42px", padding: "0 0.75rem", cursor: "pointer" }}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as any);
                setCurrentPage(1);
              }}
            >
              <option value="todos">Todos</option>
              <option value="activos">Solo Habilitados</option>
              <option value="deshabilitados">Solo Deshabilitados</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Fecha:</span>
            <input
              type="date"
              className={styles.input}
              style={{ width: "150px", height: "42px", padding: "0 0.75rem", cursor: "pointer" }}
              value={filterDate}
              onClick={(e) => e.currentTarget.showPicker()}
              onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {(filterDate || filterStatus !== "todos") && (
            <button
              onClick={() => {
                setFilterDate("");
                setFilterStatus("todos");
                setCurrentPage(1);
              }}
              className={styles.btnSecondary}
              style={{ height: "42px", padding: "0 1rem", borderRadius: "8px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "#dc2626", borderColor: "#fca5a5", backgroundColor: "#fef2f2" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.alertError} style={{ marginBottom: "1.5rem" }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
          <div className={styles.loadingSpinner} style={{ borderTopColor: "#0052cc", width: "40px", height: "40px" }}></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className={styles.card} style={{ minHeight: "350px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#cbd5e1" }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className={styles.emptyStateText}>
              {search || filterDate || filterStatus !== "todos"
                ? "No se encontraron proyectos que coincidan con los filtros aplicados."
                : "No hay proyectos registrados."}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {paginatedProjects.map((project) => {
              const clientName = project.clientes?.nombre || "Sin cliente";
              const clientCompany = project.clientes?.empresa;
              const saleCode = project.ventas?.codigo_venta;
              const amount = project.ventas?.monto_total;
              const currency = project.ventas?.moneda;

              return (
                <div key={project.id} className={styles.card} style={{ display: "flex", flexDirection: "column", padding: "1.5rem", transition: "transform 0.2s, box-shadow 0.2s", opacity: project.activo ? 1 : 0.8, backgroundColor: project.activo ? "#ffffff" : "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                        {saleCode && (
                          <span className={styles.salesTableCode} style={{ fontSize: "0.75rem", margin: 0 }}>
                            {saleCode}
                          </span>
                        )}
                        {project.ventas?.urgente && (
                          <span className={styles.badge} style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", backgroundColor: "#fee2e2", color: "#b91c1c", fontWeight: 700, borderRadius: "4px" }}>
                            URGENTE
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: project.activo ? "#0f172a" : "#64748b", margin: 0 }}>
                        {project.nombre}
                      </h3>
                    </div>
                    <div
                      onClick={() => handleOpenPinModal(project)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                        padding: "0.2rem 0.5rem 0.2rem 0.35rem",
                        borderRadius: "20px",
                        backgroundColor: project.activo ? "#f0fdf4" : "#f8fafc",
                        border: "1px solid",
                        borderColor: project.activo ? "#bbf7d0" : "#cbd5e1",
                        transition: "all 0.2s ease",
                        userSelect: "none"
                      }}
                      title={project.activo ? "Haz clic para deshabilitar este proyecto (requiere PIN)" : "Haz clic para habilitar este proyecto (requiere PIN)"}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "20px",
                          backgroundColor: project.activo ? "#22c55e" : "#94a3b8",
                          borderRadius: "10px",
                          position: "relative",
                          transition: "background-color 0.25s ease",
                          display: "flex",
                          alignItems: "center",
                          padding: "2px",
                          boxSizing: "border-box"
                        }}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            backgroundColor: "#ffffff",
                            borderRadius: "50%",
                            transform: project.activo ? "translateX(16px)" : "translateX(0px)",
                            transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: project.activo ? "#15803d" : "#64748b"
                        }}
                      >
                        {project.activo ? "Habilitado" : "Deshabilitado"}
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #f1f5f9", padding: "1rem 0", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Cliente:</span>
                      <span style={{ fontWeight: 500, color: "#1e293b" }}>
                        {clientName} {clientCompany ? `(${clientCompany})` : ""}
                      </span>
                    </div>
                    {amount !== null && amount !== undefined && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Monto:</span>
                        <span style={{ fontWeight: 600, color: "#16a34a" }}>
                          {formatCurrency(amount, currency || "USD")}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Creado:</span>
                      <span>
                        {new Date(project.creado_en).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "1rem" }}>
                    {project.link_trello ? (
                      <a
                        href={project.link_trello}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnSecondary}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          fontSize: "0.8rem",
                          borderColor: "#0052cc",
                          color: "#0052cc",
                          backgroundColor: "#f4f8ff",
                          borderRadius: "6px",
                          height: "36px",
                          padding: 0
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.333 2H4.667C3.197 2 2 3.197 2 4.667v14.666C2 20.803 3.197 22 4.667 22h14.666C20.803 22 22 20.803 22 19.333V4.667C22 3.197 20.803 2 19.333 2zM10.222 16.222c0 .49-.398.889-.889.889H5.778a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v10.444zm8.889-4.444c0 .49-.398.889-.889.889h-3.555a.89.89 0 0 1-.889-.89V5.778c0-.49.398-.889.889-.889h3.555c.49 0 .889.398.889.89v6z" />
                        </svg>
                        <span>Trello</span>
                      </a>
                    ) : (
                      <button
                        disabled
                        className={styles.btnSecondary}
                        style={{
                          flex: 1,
                          fontSize: "0.8rem",
                          opacity: 0.5,
                          borderRadius: "6px",
                          height: "36px",
                          padding: 0
                        }}
                      >
                        Trello N/A
                      </button>
                    )}

                    {project.carpeta_dropbox ? (
                      <a
                        href={project.carpeta_dropbox}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnSecondary}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          fontSize: "0.8rem",
                          borderColor: "#0061ff",
                          color: "#0061ff",
                          backgroundColor: "#f4f8ff",
                          borderRadius: "6px",
                          height: "36px",
                          padding: 0
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 2L1.5 5.5 6 9l4.5-3.5L6 2zm12 0l-4.5 3.5L18 9l4.5-3.5L18 2zM1.5 12.5L6 16l4.5-3.5-4.5-3.5-4.5 3.5zm16.5-3.5l-4.5 3.5 4.5 3.5 4.5-3.5-4.5-3.5zM6 17.5v2.25L12 23l6-3.25v-2.25l-6 3.75-6-3.75z" />
                        </svg>
                        <span>Dropbox</span>
                      </a>
                    ) : (
                      <button
                        disabled
                        className={styles.btnSecondary}
                        style={{
                          flex: 1,
                          fontSize: "0.8rem",
                          opacity: 0.5,
                          borderRadius: "6px",
                          height: "36px",
                          padding: 0
                        }}
                      >
                        Dropbox N/A
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Mostrando <strong style={{ color: "#0f172a" }}>{startIndex + 1}</strong> a <strong style={{ color: "#0f172a" }}>{Math.min(endIndex, filteredProjects.length)}</strong> de <strong style={{ color: "#0f172a" }}>{filteredProjects.length}</strong> proyectos
              </span>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={styles.btnSecondary}
                  style={{ height: "36px", padding: "0 0.75rem", display: "flex", alignItems: "center", borderRadius: "6px", fontSize: "0.8rem", opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                {getPageNumbers(currentPage, totalPages).map((page, index) => {
                  if (typeof page === "string") {
                    return (
                      <span key={`ellipsis-${index}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", color: "#64748b", fontSize: "0.875rem" }}>
                        {page}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? styles.btnPrimary : styles.btnSecondary}
                      style={{ 
                        height: "36px", 
                        width: "36px", 
                        padding: 0, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        borderRadius: "6px", 
                        fontSize: "0.8rem",
                        backgroundColor: currentPage === page ? "#0052cc" : undefined,
                        borderColor: currentPage === page ? "#0052cc" : undefined,
                        color: currentPage === page ? "#fff" : undefined
                      }}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={styles.btnSecondary}
                  style={{ height: "36px", padding: "0 0.75rem", display: "flex", alignItems: "center", borderRadius: "6px", fontSize: "0.8rem", opacity: currentPage === totalPages ? 0.5 : 1 }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchProjects(debouncedSearch)}
      />

      {showPinModal && selectedProjectForToggle && (
        <div className={styles.modalOverlay} style={{ zIndex: 2000 }}>
          <div className={styles.modalContent} style={{ maxWidth: "400px", overflowY: "hidden", padding: "2rem" }}>
            <form onSubmit={handleConfirmToggleWithPin} className={styles.pinConfirmPrompt}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: selectedProjectForToggle.activo ? "#fef2f2" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: selectedProjectForToggle.activo ? "#ef4444" : "#22c55e", marginBottom: "0.25rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <span className={styles.pinConfirmTitle}>Firma de Autorización</span>
              <p className={styles.pinConfirmDesc} style={{ margin: 0 }}>
                Ingresa tu PIN de 6 dígitos para autorizar {selectedProjectForToggle.activo ? "deshabilitar" : "habilitar"} el proyecto:
              </p>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", backgroundColor: "#f8fafc", padding: "0.4rem 0.88rem", borderRadius: "6px", border: "1px solid #e2e8f0", maxWidth: "100%", wordBreak: "break-word" }}>
                {selectedProjectForToggle.nombre}
              </span>
              <p style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                ⚠️ Solo Administradores y Auditores
              </p>

              <div className={styles.pinConfirmInputs} style={{ margin: "0.75rem auto" }}>
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`project-pin-input-${idx}`}
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    className={`${styles.pinConfirmInput} ${digit ? styles.pinConfirmInputFilled : ""} ${pinError ? styles.inputError : ""}`}
                    disabled={submittingPin}
                  />
                ))}
              </div>

              {pinError && (
                <div className={styles.alertError} style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", margin: 0 }}>
                  <span>{pinError}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", width: "100%", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ flex: 1, minHeight: "42px", justifyContent: "center" }}
                  onClick={() => {
                    setShowPinModal(false);
                    setSelectedProjectForToggle(null);
                    setPin(Array(6).fill(""));
                    setPinError(null);
                  }}
                  disabled={submittingPin}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ flex: 1, minHeight: "42px", justifyContent: "center", backgroundColor: selectedProjectForToggle.activo ? "#dc2626" : "#0052cc", borderColor: selectedProjectForToggle.activo ? "#dc2626" : "#0052cc" }}
                  disabled={submittingPin || pin.join("").length !== 6}
                >
                  {submittingPin ? "Verificando..." : selectedProjectForToggle.activo ? "Deshabilitar" : "Habilitar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
