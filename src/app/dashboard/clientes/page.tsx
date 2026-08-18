"use client";

import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";
import ImportModal from "./ImportModal";

interface Client {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  empresa: string | null;
  link_usuario_plataforma?: string | null;
  setter_original_id?: string | null;
  setter?: { id: string; nombre: string } | null;
  ghl_contact_id: string | null;
  creado_en: string;
}

const COUNTRIES_AMERICA = [
  "Antigua y Barbuda",
  "Argentina",
  "Bahamas",
  "Barbados",
  "Belice",
  "Bolivia",
  "Brasil",
  "Canadá",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Cuba",
  "Dominica",
  "Ecuador",
  "El Salvador",
  "Estados Unidos",
  "Granada",
  "Guatemala",
  "Guyana",
  "Haití",
  "Honduras",
  "Jamaica",
  "México",
  "Nicaragua",
  "Panamá",
  "Paraguay",
  "Perú",
  "Puerto Rico",
  "República Dominicana",
  "San Cristóbal y Nieves",
  "San Vicente y las Granadinas",
  "Santa Lucía",
  "Surinam",
  "Trinidad y Tobago",
  "Uruguay",
  "Venezuela"
];

const COUNTRIES_EUROPE = [
  "España",
  "Portugal",
  "Francia",
  "Inglaterra"
];

const isPredefinedCountry = (c: string) => {
  return COUNTRIES_AMERICA.includes(c) || COUNTRIES_EUROPE.includes(c);
};

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

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<{ id: string; nombre: string; rol: string }[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users) {
          setAgencyUsers(data.users.filter((u: any) => u.activo !== false));
        }
      })
      .catch(err => console.error("Error cargando usuarios:", err));
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter states
  const [filterDate, setFilterDate] = useState("");
  const [filterEmail, setFilterEmail] = useState("all"); // "all" | "with" | "without"
  const [filterPhone, setFilterPhone] = useState("all"); // "all" | "with" | "without"

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 8;

  // Edit client states
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    pais: "",
    empresa: "",
    link_usuario_plataforma: "",
    setter_original_id: ""
  });
  const [showCustomCountry, setShowCustomCountry] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleStartEditClient = (client: Client) => {
    setEditingClient(client);
    setEditForm({
      nombre: client.nombre || "",
      email: client.email || "",
      telefono: client.telefono || "",
      pais: client.pais || "",
      empresa: client.empresa || "",
      link_usuario_plataforma: client.link_usuario_plataforma || "",
      setter_original_id: client.setter_original_id || client.setter?.id || ""
    });
    const isPre = isPredefinedCountry(client.pais || "");
    setShowCustomCountry(client.pais ? !isPre : false);
    setEditError(null);
  };

  const handleSaveClientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editForm.nombre.trim()) {
      setEditError("El nombre del cliente es obligatorio.");
      return;
    }

    if (!editForm.email.trim() && !editForm.telefono.trim()) {
      setEditError("Debes ingresar al menos el correo electrónico (email) o el teléfono del cliente.");
      return;
    }

    setIsSavingClient(true);
    setEditError(null);

    try {
      const res = await fetch("/api/clients", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: editingClient.id,
          nombre: editForm.nombre.trim(),
          email: editForm.email.trim() || null,
          telefono: editForm.telefono.trim() || null,
          pais: editForm.pais.trim() || null,
          empresa: editForm.empresa.trim() || null,
          link_usuario_plataforma: editForm.link_usuario_plataforma.trim() || null,
          setter_original_id: editForm.setter_original_id || null
        })
      });

      const data = await res.json();
      if (data.success) {
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...data.client } : c));
        setEditingClient(null);
      } else {
        setEditError(data.error || "Error al actualizar el cliente.");
      }
    } catch (err) {
      console.error("Error updating client:", err);
      setEditError("Error de red al conectar con el servidor.");
    } finally {
      setIsSavingClient(false);
    }
  };

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

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchClients = async (query = "") => {
    try {
      setLoading(true);
      const url = query ? `/api/clients?search=${encodeURIComponent(query)}` : "/api/clients";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setClients(data.clients || []);
      } else {
        setError(data.error || "Error al obtener clientes.");
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Error de red al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients(debouncedSearch);
  }, [debouncedSearch]);

  // Apply filters client-side
  const filteredClients = clients.filter((client) => {
    if (filterDate) {
      const localDateStr = getLocalDateString(client.creado_en);
      if (localDateStr !== filterDate) return false;
    }
    if (filterEmail === "with") {
      if (!client.email) return false;
    } else if (filterEmail === "without") {
      if (client.email) return false;
    }
    if (filterPhone === "with") {
      if (!client.telefono) return false;
    } else if (filterPhone === "without") {
      if (client.telefono) return false;
    }
    return true;
  });

  const handleExportClientes = () => {
    if (filteredClients.length === 0) {
      alert("No hay clientes para exportar.");
      return;
    }

    const headers = ["Nombre", "Email", "Teléfono", "País", "Empresa", "Setter", "GHL ID", "Fecha Registro"];
    
    const escapeCsv = (val: string | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const clean = val.replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = filteredClients.map(client => [
      escapeCsv(client.nombre),
      escapeCsv(client.email),
      escapeCsv(client.telefono),
      escapeCsv(client.pais),
      escapeCsv(client.empresa),
      escapeCsv(client.setter?.nombre || "Sin Asignar"),
      escapeCsv(client.ghl_contact_id),
      escapeCsv(new Date(client.creado_en).toLocaleDateString("es-ES"))
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Clientes_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination Math
  const totalPages = Math.ceil(filteredClients.length / clientsPerPage);
  const startIndex = (currentPage - 1) * clientsPerPage;
  const endIndex = startIndex + clientsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, endIndex);

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>Clientes</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className={styles.btnPrimary}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", height: "42px", padding: "0 1rem", borderRadius: "8px", fontSize: "0.85rem" }}
            title="Importar clientes/proyectos desde CSV/Excel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Importar</span>
          </button>
          <button
            onClick={handleExportClientes}
            className={styles.btnSecondary}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", height: "42px", padding: "0 1rem", borderRadius: "8px", fontSize: "0.85rem" }}
            title="Exportar clientes a CSV"
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
              placeholder="Buscar clientes por nombre, empresa, email o teléfono..."
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

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Email:</span>
            <select
              className={styles.select}
              style={{ width: "130px", height: "42px", padding: "0 2rem 0 0.75rem" }}
              value={filterEmail}
              onChange={(e) => { setFilterEmail(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Todos</option>
              <option value="with">Con Email</option>
              <option value="without">Sin Email</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Teléfono:</span>
            <select
              className={styles.select}
              style={{ width: "140px", height: "42px", padding: "0 2rem 0 0.75rem" }}
              value={filterPhone}
              onChange={(e) => { setFilterPhone(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Todos</option>
              <option value="with">Con Teléfono</option>
              <option value="without">Sin Teléfono</option>
            </select>
          </div>

          {(filterDate || filterEmail !== "all" || filterPhone !== "all") && (
            <button
              onClick={() => {
                setFilterDate("");
                setFilterEmail("all");
                setFilterPhone("all");
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
      ) : filteredClients.length === 0 ? (
        <div className={styles.card} style={{ minHeight: "350px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#cbd5e1" }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className={styles.emptyStateText}>
              {search || filterDate || filterEmail !== "all" || filterPhone !== "all"
                ? "No se encontraron clientes que coincidan con los filtros aplicados."
                : "Aún no se han registrado clientes."}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {paginatedClients.map((client) => {
              return (
                <div key={client.id} className={styles.card} style={{ display: "flex", flexDirection: "column", padding: "1.5rem", transition: "transform 0.2s, box-shadow 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", maxWidth: "75%", minWidth: 0 }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={client.nombre}>
                        {client.nombre}
                      </h3>
                      <button
                        onClick={() => handleStartEditClient(client)}
                        className={styles.actionBtn}
                        style={{ padding: "4px", borderRadius: "4px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Editar cliente"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#64748b" }}>
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                    </div>
                    {client.ghl_contact_id ? (
                      <span className={styles.badgeSmallBlue} style={{ flexShrink: 0 }}>GHL</span>
                    ) : (
                      <span className={styles.badgeSmallGrey} style={{ flexShrink: 0 }}>Local</span>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #f1f5f9", padding: "1rem 0", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Setter:</span>
                      <span style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={client.setter?.nombre || "Sin Asignar"}>
                        {client.setter?.nombre || "Sin Asignar"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Empresa:</span>
                      <span style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={client.empresa || undefined}>
                        {client.empresa || "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Email:</span>
                      <span style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={client.email || undefined}>
                        {client.email || "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Teléfono:</span>
                      <span style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={client.telefono || undefined}>
                        {client.telefono || "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>País:</span>
                      <span style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={client.pais || undefined}>
                        {client.pais || "—"}
                      </span>
                    </div>
                    {client.link_usuario_plataforma && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Link Usuario:</span>
                        <a 
                          href={client.link_usuario_plataforma}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontWeight: 500, color: "#0052cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%", textDecoration: "underline" }}
                          title={client.link_usuario_plataforma}
                        >
                          Enlace
                        </a>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Registro:</span>
                      <span>
                        {new Date(client.creado_en).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "1rem" }}>
                    {client.email ? (
                      <a
                        href={`mailto:${client.email}`}
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span>Enviar Email</span>
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
                        Sin Email
                      </button>
                    )}

                    {client.telefono ? (
                      (() => {
                        const cleanPhone = client.telefono.replace(/\D/g, "");
                        return (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
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
                              borderColor: "#16a34a",
                              color: "#16a34a",
                              backgroundColor: "#f0fdf4",
                              borderRadius: "6px",
                              height: "36px",
                              padding: 0
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.503-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.413 9.863-9.85.001-2.63-1.023-5.101-2.885-6.965C16.588 1.976 14.12 .953 11.488.953c-5.438 0-9.862 4.414-9.865 9.852-.001 1.748.461 3.454 1.341 4.965l-.988 3.6 3.693-.97c1.503.82 3.19 1.253 4.888 1.254zm12.35-7.391c-.307-.154-1.82-.9-2.102-1.002-.281-.102-.486-.154-.69.154-.205.308-.794.998-.973 1.203-.178.205-.357.23-.665.077-1.393-.698-2.317-1.222-3.14-2.63-.223-.382.223-.355.639-1.183.077-.154.038-.288-.019-.397-.058-.109-.487-1.178-.667-1.613-.176-.423-.37-.365-.508-.372-.132-.007-.282-.008-.432-.008-.15 0-.395.056-.601.282-.207.226-.79.772-.79 1.883 0 1.111.808 2.185.92 2.339.112.154 1.59 2.43 3.853 3.407.538.232.957.371 1.283.475.54.172 1.03.148 1.417.09.432-.065 1.82-.744 2.078-1.46.257-.717.257-1.332.18-1.46-.078-.128-.282-.205-.59-.359z"/>
                            </svg>
                            <span>WhatsApp</span>
                          </a>
                        );
                      })()
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
                        Sin WhatsApp
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
                Mostrando <strong style={{ color: "#0f172a" }}>{startIndex + 1}</strong> a <strong style={{ color: "#0f172a" }}>{Math.min(endIndex, filteredClients.length)}</strong> de <strong style={{ color: "#0f172a" }}>{filteredClients.length}</strong> clientes
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

      {/* Edit Client Modal */}
      {editingClient && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "500px" }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Editar Cliente</h2>
              <button onClick={() => setEditingClient(null)} className={styles.closeBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {editError && (
              <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveClientEdit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Nombre Completo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Email <span style={{ fontWeight: "normal", color: "#64748b" }}>(mínimo uno entre email y teléfono)</span>
                </label>
                <input
                  type="email"
                  className={styles.input}
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Teléfono <span style={{ fontWeight: "normal", color: "#64748b" }}>(mínimo uno entre email y teléfono)</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Empresa</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={editForm.empresa}
                    onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>País</label>
                  <select
                    className={styles.select}
                    value={editForm.pais ? (isPredefinedCountry(editForm.pais) ? editForm.pais : "Otro") : (showCustomCountry ? "Otro" : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Otro") {
                        setShowCustomCountry(true);
                        setEditForm({ ...editForm, pais: "" });
                      } else {
                        setShowCustomCountry(false);
                        setEditForm({ ...editForm, pais: val });
                      }
                    }}
                  >
                    <option value="">Seleccionar país...</option>
                    <optgroup label="América">
                      {COUNTRIES_AMERICA.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    <optgroup label="Europa">
                      {COUNTRIES_EUROPE.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    <option value="Otro">Otro (Especificar)</option>
                  </select>
                </div>
              </div>

              {showCustomCountry && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Especificar País</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Escribe el nombre del país"
                    value={editForm.pais}
                    onChange={(e) => setEditForm({ ...editForm, pais: e.target.value })}
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Setter / Agendador Asignado</label>
                <select
                  className={styles.select}
                  value={editForm.setter_original_id}
                  onChange={(e) => setEditForm({ ...editForm, setter_original_id: e.target.value })}
                >
                  <option value="">Sin Asignar (Ninguno)</option>
                  {agencyUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.rol})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Enlace de Usuario/Plataforma</label>
                <input
                  type="text"
                  placeholder="https://..."
                  className={styles.input}
                  value={editForm.link_usuario_plataforma}
                  onChange={(e) => setEditForm({ ...editForm, link_usuario_plataforma: e.target.value })}
                />
              </div>

              <div className={styles.modalActions} style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className={styles.btnSecondary}
                  disabled={isSavingClient}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={isSavingClient}
                >
                  {isSavingClient ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchClients(debouncedSearch)}
      />
    </div>
  );
}
