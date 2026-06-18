"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import styles from "../dashboard.module.css";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  cliente_pais: string;
  cliente_empresa: string;
  cliente_link_usuario: string;
  setter_username: string;
  
  // validation fields
  isValid: boolean;
  errorMsg?: string;
}

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedClients: number;
    totalProcessed: number;
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (file: File) => {
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (fileExt !== "csv" && fileExt !== "xlsx" && fileExt !== "xls") {
      setErrorMessage("Formato de archivo no soportado. Sube un archivo .csv, .xlsx o .xls");
      setFile(null);
      setParsedRows([]);
      return;
    }

    setFile(file);
    setErrorMessage(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of objects
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          setErrorMessage("El archivo está vacío.");
          setParsedRows([]);
          return;
        }

        // Standardize mapping (support spanish/english headers)
        const mapped: ParsedRow[] = rawJson.map((row) => {
          const clientName = (row["Cliente"] || row["Cliente Nombre"] || row["Client"] || row["Client Name"] || row["nombre"] || "").toString().trim();
          const email = (row["Email"] || row["Correo"] || row["Correo Electrónico"] || row["email"] || "").toString().trim();
          const phone = (row["Teléfono"] || row["Telefono"] || row["Phone"] || row["telefono"] || "").toString().trim();
          const country = (row["País"] || row["Pais"] || row["Country"] || row["pais"] || "").toString().trim();
          const company = (row["Empresa"] || row["Company"] || row["empresa"] || "").toString().trim();
          const linkUsuario = (row["Link Usuario Plataforma"] || row["Link Perfil"] || row["Platform Profile Link"] || "").toString().trim();
          const setterUsername = (row["Setter"] || row["Vendedor"] || "").toString().trim();

          // Validation
          let isValid = true;
          let errorMsg = "";

          if (!clientName) {
            isValid = false;
            errorMsg = "Falta el nombre del cliente. ";
          }
          
          // Require phone or email for new client creations
          if (!email && !phone) {
            errorMsg += "Falta email o teléfono (requerido para clientes nuevos).";
            isValid = false;
          }

          return {
            cliente_nombre: clientName,
            cliente_email: email,
            cliente_telefono: phone,
            cliente_pais: country,
            cliente_empresa: company,
            cliente_link_usuario: linkUsuario,
            setter_username: setterUsername,
            isValid,
            errorMsg
          };
        });

        setParsedRows(mapped);
      } catch (err: any) {
        console.error("Error parsing file:", err);
        setErrorMessage("Error al leer el archivo. Asegúrate de que sea un CSV o XLSX válido.");
        setParsedRows([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage("No hay filas válidas para importar.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al realizar la importación.");
      }

      setImportResult({
        success: data.success,
        importedClients: data.importedClients,
        totalProcessed: data.totalProcessed,
        errors: data.errors || []
      });

      // Clear loaded rows on success
      setParsedRows([]);
      setFile(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setParsedRows([]);
    setImportResult(null);
    setErrorMessage(null);
  };

  const handleDownloadTemplate = () => {
    // Generate template
    const headers = [
      "Cliente", "Email", "Teléfono", "País", "Empresa", "Link Usuario Plataforma", "Setter"
    ];
    const exampleRow = [
      "Ana Perez", "ana@empresa.com", "+34600123456", "España", "PerezCorp", "https://workana.com/u/anaperez", "VictoriaR"
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Importación");
    
    // Write and trigger download
    XLSX.writeFile(wb, "Plantilla_Importacion_Clientes.xlsx");
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
      <div className={styles.modalContent} style={{ maxWidth: "800px", width: "95%" }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar Clientes
          </h2>
          <button onClick={onClose} className={styles.closeBtn} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {errorMessage && (
          <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Upload Dropzone */}
        {!file && !importResult && (
          <div>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: "12px",
                padding: "3rem 2rem",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: "#f8fafc",
                transition: "all 0.2s ease",
                marginBottom: "1.5rem"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0052cc"; e.currentTarget.style.backgroundColor = "#f0f5ff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, .xlsx, .xls"
                style={{ display: "none" }}
              />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
              <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#1e293b", margin: "0 0 0.5rem 0" }}>
                Arrastra tu archivo CSV o Excel aquí
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
                O haz clic para explorar tus archivos (Formatos soportados: .csv, .xlsx, .xls)
              </p>
            </div>

            <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "1rem", fontSize: "0.85rem", color: "#1e3a8a" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontWeight: "700" }}>ℹ️ Requisitos del Formato</h4>
              <p style={{ margin: "0 0 0.75rem 0", lineHeight: "1.4" }}>
                El archivo debe contener columnas con encabezados como: <strong>Cliente</strong> (Nombre), <strong>Email</strong> y/o <strong>Teléfono</strong> (obligatorio uno de los dos para nuevos), y opcionalmente <strong>País</strong>, <strong>Empresa</strong>, <strong>Link Usuario Plataforma</strong>, etc.
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className={styles.btnSecondary}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem", height: "auto", display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "#0052cc", borderColor: "#bfdbfe" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar Plantilla de Ejemplo
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Preview parsed data */}
        {file && parsedRows.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Archivo seleccionado: </span>
                <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>{file.name}</strong>
              </div>
              <button
                onClick={resetImport}
                className={styles.btnSecondary}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", height: "auto", color: "#dc2626", borderColor: "#fca5a5" }}
              >
                Cambiar Archivo
              </button>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.85rem", color: "#166534", fontWeight: "500" }}>Listos para Importar</span>
                <strong style={{ fontSize: "1.5rem", color: "#15803d" }}>{validCount}</strong>
              </div>
              <div style={{ flex: 1, backgroundColor: invalidCount > 0 ? "#fef2f2" : "#f8fafc", border: `1px solid ${invalidCount > 0 ? "#fca5a5" : "#e2e8f0"}`, borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.85rem", color: invalidCount > 0 ? "#991b1b" : "#64748b", fontWeight: "500" }}>Con Errores (Se Omitirán)</span>
                <strong style={{ fontSize: "1.5rem", color: invalidCount > 0 ? "#b91c1c" : "#475569" }}>{invalidCount}</strong>
              </div>
            </div>

            {/* Scrollable Preview Table */}
            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 1, borderBottom: "2px solid #e2e8f0" }}>
                  <tr>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: "700", color: "#475569" }}>Fila</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: "700", color: "#475569" }}>Estado</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: "700", color: "#475569" }}>Cliente</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: "700", color: "#475569" }}>Email / Tel</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: "700", color: "#475569" }}>Empresa</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: "700", color: "#475569" }}>País</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: row.isValid ? undefined : "#fff5f5" }}>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>{idx + 1}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {row.isValid ? (
                          <span style={{ color: "#166534", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            OK
                          </span>
                        ) : (
                          <span style={{ color: "#991b1b", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "0.25rem" }} title={row.errorMsg}>
                            ❌ Error
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: "600", color: "#1e293b" }}>{row.cliente_nombre || "—"}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>
                        {row.cliente_email || row.cliente_telefono ? (
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{row.cliente_email || "—"}</span>
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{row.cliente_telefono || ""}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#dc2626" }}>Sin contacto</span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>{row.cliente_empresa || "—"}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>{row.cliente_pais || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={resetImport}
                className={styles.btnSecondary}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                className={styles.btnPrimary}
                disabled={loading || validCount === 0}
              >
                {loading ? "Importando..." : `Iniciar Importación (${validCount} filas)`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Results display */}
        {importResult && (
          <div>
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#dcfce7",
                color: "#15803d",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#1e293b", margin: "0 0 0.5rem 0" }}>
                ¡Importación Finalizada!
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: 0, maxWidth: "450px", marginLeft: "auto", marginRight: "auto" }}>
                El archivo ha sido procesado de manera correcta. Las integraciones de GHL y Trello se están ejecutando en segundo plano.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#166534" }}>Clientes Creados/Actualizados</span>
                <h4 style={{ fontSize: "1.75rem", margin: "0.25rem 0 0 0", color: "#15803d", fontWeight: "700" }}>{importResult.importedClients}</h4>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: "700", color: "#991b1b", margin: "0 0 0.5rem 0" }}>
                  ⚠️ Detalles de Filas Omitidas o Errores ({importResult.errors.length}):
                </h4>
                <div style={{ maxHeight: "150px", overflowY: "auto", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "0.75rem", fontSize: "0.8rem", color: "#991b1b" }}>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {importResult.errors.map((err, idx) => (
                      <li key={idx} style={{ marginBottom: "0.25rem" }}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                  resetImport();
                }}
                className={styles.btnPrimary}
                style={{ width: "200px", justifyContent: "center" }}
              >
                Cerrar y Actualizar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className={styles.loadingOverlay} style={{ zIndex: 1200 }}>
          <div className={styles.loadingOverlayContent} style={{ maxWidth: "350px", textAlign: "center" }}>
            <div className={styles.loadingSpinnerOverlay}></div>
            <h4 style={{ color: "#ffffff", margin: "1rem 0 0.5rem 0", fontWeight: "700" }}>Procesando Archivo</h4>
            <span className={styles.loadingTextOverlay} style={{ fontSize: "0.8rem", opacity: 0.85 }}>
              Insertando registros en base de datos. Por favor espera...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
