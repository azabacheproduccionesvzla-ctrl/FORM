"use client";

import { useState, useEffect, useRef } from "react";
import styles from "../dashboard.module.css";

interface User {
  id: string;
  username: string;
  nombre: string;
  rol: "admin" | "ventas" | "auditor";
  activo: boolean;
  creado_en: string;
}

interface IntegrationConfig {
  dropbox: boolean;
  trello: boolean;
  ghl_email: boolean;
  ghl_factura: boolean;
  zapier_whatsapp: boolean;
}

export default function AjustesPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: string } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    username: "",
    nombre: "",
    rol: "ventas",
    pin: "",
    activo: true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>({
    dropbox: true,
    trello: true,
    ghl_email: true,
    ghl_factura: true,
    zapier_whatsapp: true
  });
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
  const [pinPromptValue, setPinPromptValue] = useState<string[]>(Array(6).fill(""));
  const pinPromptRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingToggleKey, setPendingToggleKey] = useState<string | null>(null);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const [formPinDigits, setFormPinDigits] = useState<string[]>(Array(6).fill(""));
  const formPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFormPinChange = (index: number, val: string) => {
    const cleanValue = val.replace(/[^0-9]/g, "").slice(-1);
    const newPin = [...formPinDigits];
    newPin[index] = cleanValue;
    setFormPinDigits(newPin);

    if (cleanValue !== "" && index < 5) {
      formPinRefs.current[index + 1]?.focus();
    }
  };

  const handleFormPinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (formPinDigits[index] === "" && index > 0) {
        const newPin = [...formPinDigits];
        newPin[index - 1] = "";
        setFormPinDigits(newPin);
        formPinRefs.current[index - 1]?.focus();
      } else {
        const newPin = [...formPinDigits];
        newPin[index] = "";
        setFormPinDigits(newPin);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      formPinRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      formPinRefs.current[index + 1]?.focus();
    }
  };

  const handleFormPinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      setFormPinDigits(pastedData.split(""));
    }
  };

  const handlePinPromptChange = (index: number, val: string) => {
    const cleanValue = val.replace(/[^0-9]/g, "").slice(-1);
    const newPin = [...pinPromptValue];
    newPin[index] = cleanValue;
    setPinPromptValue(newPin);

    if (cleanValue !== "" && index < 5) {
      pinPromptRefs.current[index + 1]?.focus();
    }

    const currentFullPin = newPin.join("");
    if (currentFullPin.length === 6) {
      executeToggleChange(currentFullPin);
    }
  };

  const handlePinPromptKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (pinPromptValue[index] === "" && index > 0) {
        const newPin = [...pinPromptValue];
        newPin[index - 1] = "";
        setPinPromptValue(newPin);
        pinPromptRefs.current[index - 1]?.focus();
      } else {
        const newPin = [...pinPromptValue];
        newPin[index] = "";
        setPinPromptValue(newPin);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      pinPromptRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      pinPromptRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPromptPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      setPinPromptValue(pastedData.split(""));
      executeToggleChange(pastedData);
    }
  };

  const loadUsers = async () => {
    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.authenticated) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const role = sessionData.user.role;
      if (role !== "admin") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      setCurrentUser(sessionData.user);

      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();

      if (usersData.success) {
        setUsers(usersData.users);
      }

      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      if (configData.success) {
        setIntegrationConfig(configData.config);
      }
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openAddModal = () => {
    setFormData({
      id: "",
      username: "",
      nombre: "",
      rol: "ventas",
      pin: "",
      activo: true,
    });
    setFormPinDigits(Array(6).fill(""));
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setFormData({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol,
      pin: "",
      activo: user.activo,
    });
    setFormPinDigits(Array(6).fill(""));
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleToggleActivo = async (userToToggle: User) => {
    if (currentUser && currentUser.username === userToToggle.username) {
      alert("No puedes desactivar tu propio usuario.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userToToggle.id,
          username: userToToggle.username,
          nombre: userToToggle.nombre,
          rol: userToToggle.rol,
          activo: !userToToggle.activo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar el estado.");

      loadUsers();
    } catch (err: any) {
      alert(err.message || "Error al actualizar estado.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = formPinDigits.join("");
    if (!formData.username || !formData.nombre || !formData.rol || !pinStr) {
      setFormError("Todos los campos son obligatorios.");
      return;
    }

    if (pinStr.length !== 6) {
      setFormError("El PIN debe tener exactamente 6 dígitos numéricos.");
      return;
    }

    setActionLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          nombre: formData.nombre,
          rol: formData.rol,
          pin: pinStr,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear usuario.");

      setIsAddModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || "Error de red.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = formPinDigits.join("");
    if (!formData.username || !formData.nombre || !formData.rol) {
      setFormError("Los campos usuario, nombre y rol son obligatorios.");
      return;
    }

    if (pinStr && pinStr.length !== 6) {
      setFormError("Si ingresas un PIN nuevo, debe tener exactamente 6 dígitos numéricos.");
      return;
    }

    setActionLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pin: pinStr || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar usuario.");

      setIsEditModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || "Error de red.");
    } finally {
      setActionLoading(false);
    }
  };

  const allEnabled = integrationConfig.dropbox && integrationConfig.trello && integrationConfig.ghl_factura && integrationConfig.ghl_email && integrationConfig.zapier_whatsapp;

  const handleToggleAll = () => {
    const targetValue = !allEnabled;
    setPendingToggleKey("ALL");
    setPendingToggleValue(targetValue);
    setPinPromptValue(Array(6).fill(""));
    setConfigError(null);
    setConfigSuccess(null);
    setIsPinPromptOpen(true);
  };

  const handleToggleIntegration = (key: string, currentValue: boolean) => {
    setPendingToggleKey(key);
    setPendingToggleValue(!currentValue);
    setPinPromptValue(Array(6).fill(""));
    setConfigError(null);
    setConfigSuccess(null);
    setIsPinPromptOpen(true);
  };

  const executeToggleChange = async (pinStr: string) => {
    setActionLoading(true);
    setConfigError(null);
    try {
      const updatedConfig = pendingToggleKey === "ALL"
        ? {
          dropbox: pendingToggleValue,
          trello: pendingToggleValue,
          ghl_factura: pendingToggleValue,
          ghl_email: pendingToggleValue,
          zapier_whatsapp: pendingToggleValue
        }
        : {
          ...integrationConfig,
          [pendingToggleKey!]: pendingToggleValue
        };
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig, pin: pinStr })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar la configuración.");

      setIntegrationConfig(updatedConfig);
      setConfigSuccess("Configuración actualizada con éxito.");
      setTimeout(() => setConfigSuccess(null), 3000);
      setIsPinPromptOpen(false);
    } catch (err: any) {
      setConfigError(err.message || "Error al actualizar.");
      setPinPromptValue(Array(6).fill(""));
      setTimeout(() => pinPromptRefs.current[0]?.focus(), 100);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePinPromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = pinPromptValue.join("");
    if (pinStr.length !== 6) {
      setConfigError("El PIN debe tener exactamente 6 dígitos.");
      return;
    }
    await executeToggleChange(pinStr);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Ajustes</h1>
      </div>

      {!loading && authorized && (
        <div className={styles.card} style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 className={styles.cardTitle} style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            Configuración de Integraciones de Automatización
          </h2>
          <p className={styles.cardDescription} style={{ marginBottom: "1.5rem" }}>
            Activa o desactiva las integraciones de forma individual para pruebas locales o de producción. Las integraciones inactivas se marcarán como "DESACTIVADO" al registrar o reintentar ventas.
          </p>

          {configSuccess && (
            <div className={styles.alertSuccess} style={{ marginBottom: "1rem", backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534", padding: "0.75rem", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", borderWidth: "1px", borderStyle: "solid" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{configSuccess}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "10px", backgroundColor: "#f1f5f9", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontWeight: 700, color: "#0f172a", margin: 0, fontSize: "0.95rem" }}>Integraciones automatizadas</h3>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#475569" }}>Activar o desactivar todas las integraciones de automatización simultáneamente</p>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={allEnabled}
                onChange={handleToggleAll}
                disabled={actionLoading}
              />
              <span className={styles.slider}></span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
              <div>
                <h4 style={{ fontWeight: 600, color: "#1e293b", margin: 0, fontSize: "0.95rem" }}>Dropbox</h4>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Creación de carpeta de entrega</p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={integrationConfig.dropbox}
                  onChange={() => handleToggleIntegration("dropbox", integrationConfig.dropbox)}
                  disabled={actionLoading}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
              <div>
                <h4 style={{ fontWeight: 600, color: "#1e293b", margin: 0, fontSize: "0.95rem" }}>Trello</h4>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Creación de tarjeta de proyecto</p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={integrationConfig.trello}
                  onChange={() => handleToggleIntegration("trello", integrationConfig.trello)}
                  disabled={actionLoading}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
              <div>
                <h4 style={{ fontWeight: 600, color: "#1e293b", margin: 0, fontSize: "0.95rem" }}>Facturación (GHL)</h4>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Creación de contacto y factura</p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={integrationConfig.ghl_factura}
                  onChange={() => handleToggleIntegration("ghl_factura", integrationConfig.ghl_factura)}
                  disabled={actionLoading}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
              <div>
                <h4 style={{ fontWeight: 600, color: "#1e293b", margin: 0, fontSize: "0.95rem" }}>Notificaciones por Correo</h4>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Email interno por GHL</p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={integrationConfig.ghl_email}
                  onChange={() => handleToggleIntegration("ghl_email", integrationConfig.ghl_email)}
                  disabled={actionLoading}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
              <div>
                <h4 style={{ fontWeight: 600, color: "#1e293b", margin: 0, fontSize: "0.95rem" }}>Notificaciones WhatsApp</h4>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Mensajes grupales vía Zapier</p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={integrationConfig.zapier_whatsapp}
                  onChange={() => handleToggleIntegration("zapier_whatsapp", integrationConfig.zapier_whatsapp)}
                  disabled={actionLoading}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card} style={{ padding: "1.5rem" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "4rem" }}>
            <div className={styles.loadingSpinner} style={{ borderTopColor: "#0052cc" }}></div>
          </div>
        ) : !authorized ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ marginBottom: "1rem" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <h2 className={styles.pageTitle} style={{ color: "#ef4444", marginBottom: "0.5rem", fontSize: "1.5rem" }}>Acceso Denegado</h2>
            <p className={styles.cardDescription}>
              No tienes permisos suficientes para acceder a la configuración de usuarios de la agencia.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
              <h2 className={styles.cardTitle} style={{ fontSize: "1.1rem", margin: 0 }}>
                Gestión de Usuarios Autorizados
              </h2>
              <button className={styles.btnPrimary} onClick={openAddModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Agregar Usuario</span>
              </button>
            </div>

            <div className={styles.usersDesktopView}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th>Nombre</th>
                      <th>Nombre de usuario</th>
                      <th>Estado</th>
                      <th>Fecha de registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <span className={`${styles.badge} ${styles[`role${user.rol}`]}`}>
                            {user.rol.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "#0f172a" }}>{user.nombre}</td>
                        <td>{user.username}</td>
                        <td>
                          <span className={`${styles.badge} ${user.activo ? styles.badgeActive : styles.badgeInactive}`}>
                            {user.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td style={{ color: "#64748b" }}>
                          {new Date(user.creado_en).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                        <td>
                          <div className={styles.actionGroup} style={{ alignItems: "center" }}>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                              onClick={() => openEditModal(user)}
                              title="Editar usuario"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                              </svg>
                            </button>
                            <label className={styles.switch} title={user.activo ? "Desactivar usuario" : "Activar usuario"}>
                              <input
                                type="checkbox"
                                checked={user.activo}
                                onChange={() => handleToggleActivo(user)}
                                disabled={actionLoading || (currentUser?.username === user.username)}
                              />
                              <span className={styles.slider}></span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                          No hay usuarios registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.usersMobileView}>
              {users.map((user) => (
                <div key={user.id} className={styles.userMobileCard}>
                  <div className={styles.userMobileCardHeader}>
                    <span className={`${styles.badge} ${styles[`role${user.rol}`]}`}>
                      {user.rol.toUpperCase()}
                    </span>
                    <span className={`${styles.badge} ${user.activo ? styles.badgeActive : styles.badgeInactive}`}>
                      {user.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className={styles.userMobileCardBody}>
                    <div className={styles.userMobileCardRow}>
                      <span className={styles.userMobileCardLabel}>Nombre</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{user.nombre}</span>
                    </div>
                    <div className={styles.userMobileCardRow}>
                      <span className={styles.userMobileCardLabel}>Usuario</span>
                      <span>{user.username}</span>
                    </div>
                    <div className={styles.userMobileCardRow}>
                      <span className={styles.userMobileCardLabel}>Registro</span>
                      <span style={{ color: "#64748b" }}>
                        {new Date(user.creado_en).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.userMobileCardFooter}>
                    <button
                      className={styles.btnSecondary}
                      style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                      onClick={() => openEditModal(user)}
                      title="Editar usuario"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                      </svg>
                      <span>Editar</span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Acceso:</span>
                      <label className={styles.switch} title={user.activo ? "Desactivar usuario" : "Activar usuario"}>
                        <input
                          type="checkbox"
                          checked={user.activo}
                          onChange={() => handleToggleActivo(user)}
                          disabled={actionLoading || (currentUser?.username === user.username)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                  No hay usuarios registrados.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isAddModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Agregar Nuevo Usuario</h3>
              <button className={styles.closeBtn} onClick={() => setIsAddModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre de usuario</label>
                <input
                  type="text"
                  placeholder="Escribe el nombre de usuario"
                  className={styles.input}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Escribe el nombre completo"
                  className={styles.input}
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Rol en la Agencia</label>
                <select
                  className={styles.select}
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                >
                  <option value="admin">Administrador</option>
                  <option value="ventas">Ventas</option>
                  <option value="auditor">Auditor (Contable)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>PIN de Acceso (6 dígitos)</label>
                <div className={styles.pinConfirmInputs}>
                  {formPinDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        formPinRefs.current[index] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className={`${styles.pinConfirmInput} ${digit !== "" ? styles.pinConfirmInputFilled : ""}`}
                      value={digit}
                      onChange={(e) => handleFormPinChange(index, e.target.value)}
                      onKeyDown={(e) => handleFormPinKeyDown(index, e)}
                      onPaste={handleFormPinPaste}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsAddModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={actionLoading}>
                  {actionLoading ? "Creando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Editar Usuario</h3>
              <button className={styles.closeBtn} onClick={() => setIsEditModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre de usuario</label>
                <input
                  type="text"
                  className={styles.input}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre Completo</label>
                <input
                  type="text"
                  className={styles.input}
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Rol en la Agencia</label>
                <select
                  className={styles.select}
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                >
                  <option value="admin">Administrador</option>
                  <option value="ventas">Ventas</option>
                  <option value="auditor">Auditor (Contable)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nuevo PIN (Dejar vacío para conservar el actual)</label>
                <div className={styles.pinConfirmInputs}>
                  {formPinDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        formPinRefs.current[index] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className={`${styles.pinConfirmInput} ${digit !== "" ? styles.pinConfirmInputFilled : ""}`}
                      value={digit}
                      onChange={(e) => handleFormPinChange(index, e.target.value)}
                      onKeyDown={(e) => handleFormPinKeyDown(index, e)}
                      onPaste={handleFormPinPaste}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.formGroup} style={{ flexDirection: "row", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  id="activoCheckbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                />
                <label htmlFor="activoCheckbox" className={styles.label} style={{ cursor: "pointer" }}>
                  Usuario activo (Permitir acceso)
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={actionLoading}>
                  {actionLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPinPromptOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "400px" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Confirmar con PIN</h3>
              <button className={styles.closeBtn} onClick={() => setIsPinPromptOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {configError && (
              <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
                <span>{configError}</span>
              </div>
            )}

            <form onSubmit={handlePinPromptSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>PIN de Administrador (6 dígitos)</label>
                <div className={styles.pinConfirmInputs}>
                  {pinPromptValue.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        pinPromptRefs.current[index] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className={`${styles.pinConfirmInput} ${digit !== "" ? styles.pinConfirmInputFilled : ""}`}
                      value={digit}
                      onChange={(e) => handlePinPromptChange(index, e.target.value)}
                      onKeyDown={(e) => handlePinPromptKeyDown(index, e)}
                      onPaste={handlePinPromptPaste}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsPinPromptOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={actionLoading}>
                  {actionLoading ? "Confirmando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
