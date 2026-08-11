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
  email_destinatarios?: string;
  trello_default_members?: string[];
}

interface ManualItem {
  id: number;
  categoria: string;
  item: string;
  enlace: string;
  activo?: boolean;
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
    zapier_whatsapp: true,
    email_destinatarios: ""
  });
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
  const [pinPromptValue, setPinPromptValue] = useState<string[]>(Array(6).fill(""));
  const pinPromptRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingToggleKey, setPendingToggleKey] = useState<string | null>(null);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean | string | string[]>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [trelloMembers, setTrelloMembers] = useState<{ id: string; fullName: string; username: string }[]>([]);
  const [syncModal, setSyncModal] = useState({
    isOpen: false,
    progress: 0,
    status: "syncing", // "syncing" | "success" | "error"
    inserted: 0,
    updated: 0,
    total: 0,
    errorMsg: "",
    type: "trello" // "trello" | "ghl"
  });

  // Manuals state
  const [manuals, setManuals] = useState<Record<string, ManualItem[]>>({});
  const [activeTab, setActiveTab] = useState<string>("Diseño Grafico");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [manualsLoading, setManualsLoading] = useState<boolean>(true);
  const [originalManuals, setOriginalManuals] = useState<string>("");

  const [editingManual, setEditingManual] = useState<{ id: number; sheet: string; categoria: string; item: string; enlace: string; activo?: boolean } | null>(null);
  const [addingManual, setAddingManual] = useState<{ sheet: string; categoria: string; item: string; enlace: string } | null>(null);
  const [showAddingRamaSuggestions, setShowAddingRamaSuggestions] = useState(false);
  const [showAddingCatSuggestions, setShowAddingCatSuggestions] = useState(false);
  const [showEditingCatSuggestions, setShowEditingCatSuggestions] = useState(false);

  const [isManualsPinOpen, setIsManualsPinOpen] = useState<boolean>(false);
  const [manualsPin, setManualsPin] = useState<string[]>(Array(6).fill(""));
  const [manualsError, setManualsError] = useState<string | null>(null);
  const manualsPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleTriggerSync = (syncType: "SYNC_TRELLO" | "SYNC_GHL") => {
    setPendingToggleKey(syncType);
    setPinPromptValue(Array(6).fill(""));
    setConfigError(null);
    setConfigSuccess(null);
    setIsPinPromptOpen(true);
  };

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

  // Manuals handlers
  const handleToggleManualActivo = (sheetName: string, itemId: number) => {
    setManuals(prev => {
      const updatedSheet = (prev[sheetName] || []).map(item => {
        if (item.id === itemId) {
          return { ...item, activo: item.activo === false ? true : false };
        }
        return item;
      });
      return { ...prev, [sheetName]: updatedSheet };
    });
  };

  const handleOpenEditManual = (sheetName: string, item: ManualItem) => {
    setEditingManual({
      id: item.id,
      sheet: sheetName,
      categoria: item.categoria,
      item: item.item,
      enlace: item.enlace,
      activo: item.activo !== false
    });
  };

  const handleSaveEditManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingManual) return;

    setManuals(prev => {
      const updatedSheet = (prev[editingManual.sheet] || []).map(item => {
        if (item.id === editingManual.id) {
          return {
            ...item,
            categoria: editingManual.categoria,
            item: editingManual.item,
            enlace: editingManual.enlace,
            activo: editingManual.activo
          };
        }
        return item;
      });
      return { ...prev, [editingManual.sheet]: updatedSheet };
    });
    setEditingManual(null);
  };

  const handleOpenAddManual = () => {
    setAddingManual({
      sheet: activeTab,
      categoria: "",
      item: "",
      enlace: ""
    });
  };

  const handleSaveAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingManual) return;

    let maxId = 0;
    Object.values(manuals).forEach(items => {
      items.forEach(item => {
        if (item.id > maxId) maxId = item.id;
      });
    });
    const newId = maxId + 1;

    setManuals(prev => {
      const sheetItems = prev[addingManual.sheet] || [];
      const updatedSheet = [
        ...sheetItems,
        {
          id: newId,
          categoria: addingManual.categoria || addingManual.sheet,
          item: addingManual.item,
          enlace: addingManual.enlace,
          activo: true
        }
      ];
      return { ...prev, [addingManual.sheet]: updatedSheet };
    });
    setAddingManual(null);
  };

  const handleManualsPinChange = (index: number, val: string) => {
    const cleanValue = val.replace(/[^0-9]/g, "").slice(-1);
    const newPin = [...manualsPin];
    newPin[index] = cleanValue;
    setManualsPin(newPin);

    if (cleanValue !== "" && index < 5) {
      manualsPinRefs.current[index + 1]?.focus();
    }

    const currentFullPin = newPin.join("");
    if (currentFullPin.length === 6) {
      saveManualsWithPin(currentFullPin);
    }
  };

  const handleManualsPinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (manualsPin[index] === "" && index > 0) {
        const newPin = [...manualsPin];
        newPin[index - 1] = "";
        setManualsPin(newPin);
        manualsPinRefs.current[index - 1]?.focus();
      } else {
        const newPin = [...manualsPin];
        newPin[index] = "";
        setManualsPin(newPin);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      manualsPinRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      manualsPinRefs.current[index + 1]?.focus();
    }
  };

  const handleManualsPinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      setManualsPin(pastedData.split(""));
      saveManualsWithPin(pastedData);
    }
  };

  const saveManualsWithPin = async (pinStr: string) => {
    setActionLoading(true);
    setManualsError(null);

    try {
      const res = await fetch("/api/config/manuals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuals, pin: pinStr })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar los manuales.");

      setOriginalManuals(JSON.stringify(manuals));
      setConfigSuccess("Base de datos de manuales actualizada con éxito.");
      setTimeout(() => setConfigSuccess(null), 3000);
      setIsManualsPinOpen(false);
      setManualsPin(Array(6).fill(""));
    } catch (err: any) {
      setManualsError(err.message || "Error al actualizar los manuales.");
      setManualsPin(Array(6).fill(""));
    } finally {
      setActionLoading(false);
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

      const trelloRes = await fetch("/api/trello/members");
      const trelloData = await trelloRes.json();
      if (trelloData.success) {
        setTrelloMembers(trelloData.members);
      }

      // Cargar manuales
      setManualsLoading(true);
      const manualsRes = await fetch("/api/config/manuals");
      const manualsData = await manualsRes.json();
      if (manualsData.success) {
        setManuals(manualsData.manuals);
        setOriginalManuals(JSON.stringify(manualsData.manuals));
        const sheets = Object.keys(manualsData.manuals);
        if (sheets.length > 0) {
          setActiveTab(sheets[0]);
        }
      }
      setManualsLoading(false);
    } catch (error) {
      console.error("Error al cargar usuarios o manuales:", error);
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

    if (pendingToggleKey === "SYNC_TRELLO" || pendingToggleKey === "SYNC_GHL") {
      setIsPinPromptOpen(false);
      const isTrello = pendingToggleKey === "SYNC_TRELLO";
      setSyncModal({
        isOpen: true,
        progress: 0,
        status: "syncing",
        inserted: 0,
        updated: 0,
        total: 0,
        errorMsg: "",
        type: isTrello ? "trello" : "ghl"
      });

      const interval = setInterval(() => {
        setSyncModal(prev => {
          if (prev.progress >= 92) {
            clearInterval(interval);
            return prev;
          }
          const inc = Math.floor(Math.random() * 8) + 2;
          return { ...prev, progress: Math.min(prev.progress + inc, 92) };
        });
      }, 250);

      try {
        const endpoint = isTrello ? "/api/projects/sync" : "/api/clients";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinStr })
        });
        const data = await res.json();
        clearInterval(interval);

        if (data.success) {
          setSyncModal(prev => ({
            ...prev,
            progress: 100,
            status: "success",
            inserted: data.insertedCount,
            updated: data.updatedCount,
            total: data.totalSynced
          }));
        } else {
          setSyncModal(prev => ({
            ...prev,
            status: "error",
            errorMsg: data.error || `Error al sincronizar con ${isTrello ? "Trello" : "GHL"}.`
          }));
        }
      } catch (err) {
        clearInterval(interval);
        setSyncModal(prev => ({
          ...prev,
          status: "error",
          errorMsg: `Error de conexión al sincronizar con ${isTrello ? "Trello" : "GHL"}.`
        }));
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      let updatedConfig: IntegrationConfig;
      if (pendingToggleKey === "ALL") {
        const val = pendingToggleValue as boolean;
        updatedConfig = {
          dropbox: val,
          trello: val,
          ghl_factura: val,
          ghl_email: val,
          zapier_whatsapp: val,
          email_destinatarios: integrationConfig.email_destinatarios,
          trello_default_members: integrationConfig.trello_default_members
        };
      } else if (pendingToggleKey === "email_destinatarios") {
        updatedConfig = {
          ...integrationConfig,
          email_destinatarios: pendingToggleValue as string
        };
      } else if (pendingToggleKey === "trello_default_members") {
        updatedConfig = {
          ...integrationConfig,
          trello_default_members: pendingToggleValue as unknown as string[]
        };
      } else {
        updatedConfig = {
          ...integrationConfig,
          [pendingToggleKey!]: pendingToggleValue as boolean
        };
      }
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

  const handleToggleTrelloMember = (memberId: string) => {
    const currentList = integrationConfig.trello_default_members || [];
    let newList: string[];
    if (currentList.includes(memberId)) {
      newList = currentList.filter(id => id !== memberId);
    } else {
      newList = [...currentList, memberId];
    }
    
    setPendingToggleKey("trello_default_members");
    setPendingToggleValue(newList);
    setPinPromptValue(Array(6).fill(""));
    setConfigError(null);
    setConfigSuccess(null);
    setIsPinPromptOpen(true);
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "10px", backgroundColor: "#f1f5f9", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontWeight: 700, color: "#0f172a", margin: 0, fontSize: "0.95rem" }}>Habilitar integraciones automáticas</h3>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#475569" }}>Activar o desactivar la ejecución de todo el flujo de automatizaciones (Trello, Dropbox, GHL, WhatsApp y Email) al registrar ventas.</p>
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

          <div style={{ padding: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "10px", backgroundColor: "#ffffff", marginTop: "1rem" }}>
            <h3 style={{ fontWeight: 700, color: "#0f172a", margin: 0, fontSize: "0.95rem" }}>Destinatarios de Notificación por Correo</h3>
            <p style={{ margin: "0.25rem 0 1rem 0", fontSize: "0.8rem", color: "#475569" }}>
              Direcciones de correo electrónico (separadas por comas) que recibirán la notificación cuando se registre una venta.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <input
                type="text"
                className={styles.input}
                style={{ flexGrow: 1, padding: "0.5rem 0.75rem", fontSize: "0.875rem", margin: 0 }}
                placeholder="correo1@test.com, correo2@test.com"
                value={integrationConfig.email_destinatarios || ""}
                onChange={(e) => setIntegrationConfig({ ...integrationConfig, email_destinatarios: e.target.value })}
              />
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ padding: "0.55rem 1.25rem", fontSize: "0.85rem", height: "42px", margin: 0, whiteSpace: "nowrap" }}
                disabled={actionLoading}
                onClick={() => {
                  setPendingToggleKey("email_destinatarios");
                  setPendingToggleValue(integrationConfig.email_destinatarios || "");
                  setPinPromptValue(Array(6).fill(""));
                  setConfigError(null);
                  setConfigSuccess(null);
                  setIsPinPromptOpen(true);
                }}
              >
                Guardar
              </button>
            </div>
          </div>

          {integrationConfig.trello && (
            <div style={{ padding: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "10px", backgroundColor: "#ffffff", marginTop: "1rem" }}>
              <h3 style={{ fontWeight: 700, color: "#0f172a", margin: 0, fontSize: "0.95rem" }}>Miembros Asignados por Defecto en Trello</h3>
              <p style={{ margin: "0.25rem 0 1rem 0", fontSize: "0.8rem", color: "#475569" }}>
                Selecciona qué miembros se asignarán de manera automática al crear la tarjeta en Trello. Estas configuraciones requieren confirmación de PIN al modificarse.
              </p>
              {trelloMembers.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {trelloMembers.map(member => {
                    const isSelected = (integrationConfig.trello_default_members || []).includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
                        disabled={actionLoading}
                        onClick={() => handleToggleTrelloMember(member.id)}
                      >
                        <span>{member.fullName} (@{member.username})</span>
                        {isSelected && <span style={{ marginLeft: "0.35rem", fontSize: "0.8rem" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>Cargando miembros de Trello o credenciales incompletas...</p>
              )}
            </div>
          )}
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

      <div className={styles.card} style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
        <h2 className={styles.cardTitle} style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          Sincronización Manual de Datos
        </h2>
        <p className={styles.cardDescription} style={{ marginBottom: "1.5rem" }}>
          Sincroniza manualmente los datos de las plataformas externas con la base de datos. Estas acciones requieren confirmación de PIN.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button
            className={styles.btnPrimary}
            onClick={() => handleTriggerSync("SYNC_TRELLO")}
            disabled={actionLoading}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Sincronizar Proyectos (Trello)</span>
          </button>

          <button
            className={styles.btnPrimary}
            onClick={() => handleTriggerSync("SYNC_GHL")}
            disabled={actionLoading}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#0284c7", borderColor: "#0284c7" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Sincronizar Clientes (GHL)</span>
          </button>
        </div>
      </div>

      {/* CARD 4: Gestión de Manuales de Producción */}
      <div className={styles.card} style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <h2 className={styles.cardTitle} style={{ fontSize: "1.1rem", margin: 0 }}>
            Gestión de Manuales de Producción
          </h2>
          <button 
            type="button" 
            className={styles.btnPrimary} 
            onClick={handleOpenAddManual}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Agregar Servicio</span>
          </button>
        </div>
        <p className={styles.cardDescription} style={{ marginBottom: "1.5rem" }}>
          Administra las categorías, servicios y enlaces a manuales de producción.
        </p>

        {manualsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "2rem" }}>
            <div className={styles.loadingSpinner} style={{ borderTopColor: "#0052cc" }}></div>
          </div>
        ) : (
          <div>
            {/* Sheet Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
              {Object.keys(manuals).map(sheetName => {
                const isActive = activeTab === sheetName;
                return (
                  <button
                    key={sheetName}
                    type="button"
                    className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                    onClick={() => {
                      setActiveTab(sheetName);
                      setSearchQuery("");
                    }}
                    style={{
                      borderRadius: "6px",
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.85rem",
                      border: isActive ? "none" : "1px solid #cbd5e1",
                      backgroundColor: isActive ? "#0052cc" : "#ffffff",
                      color: isActive ? "#ffffff" : "#475569",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {sheetName}
                  </button>
                );
              })}
            </div>

            {/* Filter Search Input */}
            <div style={{ marginBottom: "1rem" }}>
              <input
                type="text"
                placeholder="Buscar por nombre de servicio o categoría..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={styles.input}
                style={{ width: "100%", maxWidth: "400px", fontSize: "0.875rem", padding: "0.5rem 0.75rem", backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
              />
            </div>

            {/* Table representation */}
            <div className={styles.tableContainer} style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: "#ffffff" }}>
              <table className={styles.table}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 1 }}>
                    <th style={{ width: "60px", backgroundColor: "#f8fafc" }}>ID</th>
                    <th style={{ width: "200px", backgroundColor: "#f8fafc" }}>Categoría</th>
                    <th style={{ backgroundColor: "#f8fafc" }}>Servicio</th>
                    <th style={{ backgroundColor: "#f8fafc" }}>Enlace de manual</th>
                    <th style={{ width: "100px", backgroundColor: "#f8fafc" }}>Estado</th>
                    <th style={{ width: "120px", backgroundColor: "#f8fafc" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sheetItems = manuals[activeTab] || [];
                    const filteredItems = sheetItems.filter(item => {
                      const query = searchQuery.toLowerCase().trim();
                      if (query === "") return true;
                      return item.item.toLowerCase().includes(query) || item.categoria.toLowerCase().includes(query);
                    });

                    if (filteredItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            No se encontraron servicios.
                          </td>
                        </tr>
                      );
                    }

                    return filteredItems.map(item => {
                      const isActivo = item.activo !== false;
                      return (
                        <tr key={item.id} style={{ opacity: isActivo ? 1 : 0.6 }}>
                          <td>{item.id}</td>
                          <td style={{ fontWeight: 500, color: "#334155" }}>{item.categoria}</td>
                          <td style={{ fontWeight: 600, color: "#0f172a" }}>{item.item}</td>
                          <td>
                            {item.enlace ? (
                              <a
                                href={item.enlace}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#0052cc", textDecoration: "underline", fontSize: "0.85rem", wordBreak: "break-all" }}
                              >
                                Ver Manual ↗
                              </a>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin enlace</span>
                            )}
                          </td>
                          <td>
                            <span className={`${styles.badge} ${isActivo ? styles.badgeActive : styles.badgeInactive}`}>
                              {isActivo ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actionGroup} style={{ alignItems: "center" }}>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                                onClick={() => handleOpenEditManual(activeTab, item)}
                                title="Editar servicio"
                                type="button"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                                </svg>
                              </button>
                              <label className={styles.switch} title={isActivo ? "Desactivar servicio" : "Activar servicio"}>
                                <input
                                  type="checkbox"
                                  checked={isActivo}
                                  onChange={() => handleToggleManualActivo(activeTab, item.id)}
                                />
                                <span className={styles.slider}></span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            {originalManuals !== JSON.stringify(manuals) && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1.5rem", padding: "1rem", backgroundColor: "#fffbeb", borderRadius: "6px", border: "1px solid #fef3c7" }}>
                <span style={{ alignSelf: "center", fontSize: "0.875rem", color: "#b45309", fontWeight: 500 }}>
                  ⚠️ Tienes cambios sin guardar en la base de datos de manuales.
                </span>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setManuals(JSON.parse(originalManuals));
                  }}
                  disabled={actionLoading}
                >
                  Descartar
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => {
                    setManualsPin(Array(6).fill(""));
                    setManualsError(null);
                    setIsManualsPinOpen(true);
                  }}
                  disabled={actionLoading}
                  style={{ backgroundColor: "#d97706", borderColor: "#d97706" }}
                >
                  Guardar Cambios
                </button>
              </div>
            )}
          </div>
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

      {syncModal.isOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className={styles.card} style={{
            width: "100%",
            maxWidth: "450px",
            padding: "2.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            {syncModal.status === "syncing" && (
              <>
                <div className={styles.loadingSpinner} style={{ width: "45px", height: "45px", borderTopColor: "#0052cc", borderWidth: "3px", marginBottom: "1.5rem" }}></div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0f172a", marginBottom: "0.5rem" }}>
                  Sincronizando con {syncModal.type === "trello" ? "Trello" : "GHL"}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#64748b", textAlign: "center", marginBottom: "2rem" }}>
                  Por favor espera. Importando datos y vinculando registros en base de datos.
                </p>

                <div style={{ width: "100%", backgroundColor: "#e2e8f0", borderRadius: "9999px", height: "8px", overflow: "hidden", position: "relative", marginBottom: "0.5rem" }}>
                  <div style={{
                    width: `${syncModal.progress}%`,
                    backgroundColor: "#0052cc",
                    height: "100%",
                    borderRadius: "9999px",
                    transition: "width 0.4s ease-out"
                  }}></div>
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: "700", color: "#0052cc" }}>{syncModal.progress}%</span>
              </>
            )}

            {syncModal.status === "success" && (
              <>
                <div style={{
                  width: "55px",
                  height: "55px",
                  borderRadius: "50%",
                  backgroundColor: "#ecfdf5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                  border: "2px solid #a7f3d0",
                  marginBottom: "1.5rem"
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0f172a", marginBottom: "0.5rem" }}>Sincronización Exitosa</h3>
                <p style={{ fontSize: "0.875rem", color: "#64748b", textAlign: "center", marginBottom: "1.5rem" }}>
                  Se completó el proceso de importación masiva desde {syncModal.type === "trello" ? "Trello" : "GHL"}.
                </p>

                <div style={{
                  width: "100%",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                  padding: "1rem 1.25rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.875rem",
                  color: "#475569",
                  marginBottom: "2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Procesados:</span>
                    <strong style={{ color: "#0f172a" }}>{syncModal.total}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Nuevos Registros:</span>
                    <strong style={{ color: "#10b981" }}>+{syncModal.inserted}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Actualizados:</span>
                    <strong style={{ color: "#0052cc" }}>{syncModal.updated}</strong>
                  </div>
                </div>

                <button onClick={() => setSyncModal(prev => ({ ...prev, isOpen: false }))} className={styles.btnPrimary} style={{ width: "100%" }}>
                  Entendido
                </button>
              </>
            )}

            {syncModal.status === "error" && (
              <>
                <div style={{
                  width: "55px",
                  height: "55px",
                  borderRadius: "50%",
                  backgroundColor: "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  border: "2px solid #fca5a5",
                  marginBottom: "1.5rem"
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0f172a", marginBottom: "0.5rem" }}>Sincronización Fallida</h3>
                <p style={{ fontSize: "0.875rem", color: "#ef4444", textAlign: "center", marginBottom: "2rem" }}>
                  {syncModal.errorMsg}
                </p>
                <button onClick={() => setSyncModal(prev => ({ ...prev, isOpen: false }))} className={styles.btnPrimary} style={{ width: "100%", backgroundColor: "#ef4444", borderColor: "#ef4444" }}>
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Cambio en Manuales con PIN */}
      {isManualsPinOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "400px", backgroundColor: "#ffffff", color: "#0f172a" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: "#0f172a" }}>Confirmar con PIN</h3>
              <button className={styles.closeBtn} onClick={() => setIsManualsPinOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {manualsError && (
              <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
                <span>{manualsError}</span>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); }} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label} style={{ color: "#334155" }}>PIN de Administrador (6 dígitos)</label>
                <div className={styles.pinConfirmInputs}>
                  {manualsPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        manualsPinRefs.current[index] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className={`${styles.pinConfirmInput} ${digit !== "" ? styles.pinConfirmInputFilled : ""}`}
                      value={digit}
                      onChange={(e) => handleManualsPinChange(index, e.target.value)}
                      onKeyDown={(e) => handleManualsPinKeyDown(index, e)}
                      onPaste={handleManualsPinPaste}
                      autoFocus={index === 0}
                      style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsManualsPinOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className={styles.btnPrimary} onClick={() => { const pinStr = manualsPin.join(""); if (pinStr.length === 6) saveManualsWithPin(pinStr); }} disabled={actionLoading}>
                  {actionLoading ? "Confirmando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Agregar Manual */}
      {addingManual && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "500px", backgroundColor: "#ffffff", color: "#0f172a" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: "#0f172a" }}>Agregar Servicio a {addingManual.sheet}</h3>
              <button className={styles.closeBtn} onClick={() => setAddingManual(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveAddManual} className={styles.form}>
              <div className={styles.formGroup} style={{ position: "relative" }}>
                <label className={styles.label} style={{ color: "#334155" }}>Rama</label>
                <input
                  type="text"
                  value={addingManual.sheet}
                  onChange={e => setAddingManual(prev => prev ? { ...prev, sheet: e.target.value } : null)}
                  onFocus={() => setShowAddingRamaSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAddingRamaSuggestions(false), 200)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                  placeholder="Ej: Diseño Gráfico o escribe una nueva..."
                  required
                />
                {showAddingRamaSuggestions && (
                  <div className={styles.autocompleteResults} style={{ backgroundColor: "#ffffff" }}>
                    {(() => {
                      const filteredRamas = Object.keys(manuals).filter(sheetName =>
                        sheetName.toLowerCase().includes(addingManual.sheet.toLowerCase())
                      );
                      if (filteredRamas.length > 0) {
                        return filteredRamas.map(sheetName => (
                          <div
                            key={sheetName}
                            className={styles.autocompleteItem}
                            onClick={() => {
                              setAddingManual(prev => prev ? { ...prev, sheet: sheetName } : null);
                              setShowAddingRamaSuggestions(false);
                            }}
                          >
                            {sheetName}
                          </div>
                        ));
                      } else {
                        return <div className={styles.autocompleteNoResults}>Usar "{addingManual.sheet}" como nueva rama</div>;
                      }
                    })()}
                  </div>
                )}
              </div>

              <div className={styles.formGroup} style={{ position: "relative" }}>
                <label className={styles.label} style={{ color: "#334155" }}>Categoría</label>
                <input
                  type="text"
                  value={addingManual.categoria}
                  onChange={e => setAddingManual(prev => prev ? { ...prev, categoria: e.target.value } : null)}
                  onFocus={() => setShowAddingCatSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAddingCatSuggestions(false), 200)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                  placeholder="Ej: Identidad de Marca o escribe una nueva..."
                  required
                />
                {showAddingCatSuggestions && (
                  <div className={styles.autocompleteResults} style={{ backgroundColor: "#ffffff" }}>
                    {(() => {
                      const existingCats = addingManual.sheet && manuals[addingManual.sheet]
                        ? Array.from(new Set(manuals[addingManual.sheet].map((m: any) => m.categoria))) as string[]
                        : [];
                      const filteredCats = existingCats.filter((cat: string) => 
                        cat.toLowerCase().includes(addingManual.categoria.toLowerCase())
                      );

                      if (filteredCats.length > 0) {
                        return filteredCats.map(cat => (
                          <div
                            key={cat}
                            className={styles.autocompleteItem}
                            onClick={() => {
                              setAddingManual(prev => prev ? { ...prev, categoria: cat } : null);
                              setShowAddingCatSuggestions(false);
                            }}
                          >
                            {cat}
                          </div>
                        ));
                      } else {
                        return <div className={styles.autocompleteNoResults}>Usar "{addingManual.categoria}" como nueva categoría</div>;
                      }
                    })()}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} style={{ color: "#334155" }}>Nombre del Servicio</label>
                <input
                  type="text"
                  value={addingManual.item}
                  onChange={e => setAddingManual(prev => prev ? { ...prev, item: e.target.value } : null)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                  placeholder="Ej: Logo Corporativo"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} style={{ color: "#334155" }}>Enlace de manual (URL de Gamma/Drive)</label>
                <input
                  type="url"
                  value={addingManual.enlace}
                  onChange={e => setAddingManual(prev => prev ? { ...prev, enlace: e.target.value } : null)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                  placeholder="https://gamma.app/docs/..."
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setAddingManual(null)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Agregar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Manual */}
      {editingManual && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "500px", backgroundColor: "#ffffff", color: "#0f172a" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: "#0f172a" }}>Editar Servicio #{editingManual.id}</h3>
              <button className={styles.closeBtn} onClick={() => setEditingManual(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEditManual} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label} style={{ color: "#334155" }}>Rama</label>
                <input
                  type="text"
                  value={editingManual.sheet}
                  disabled
                  className={styles.input}
                  style={{ backgroundColor: "#f1f5f9", color: "#64748b", borderColor: "#cbd5e1" }}
                />
              </div>

              <div className={styles.formGroup} style={{ position: "relative" }}>
                <label className={styles.label} style={{ color: "#334155" }}>Categoría</label>
                <input
                  type="text"
                  value={editingManual.categoria}
                  onChange={e => setEditingManual(prev => prev ? { ...prev, categoria: e.target.value } : null)}
                  onFocus={() => setShowEditingCatSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowEditingCatSuggestions(false), 200)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                  required
                />
                {showEditingCatSuggestions && (
                  <div className={styles.autocompleteResults} style={{ backgroundColor: "#ffffff" }}>
                    {(() => {
                      const existingCats = editingManual.sheet && manuals[editingManual.sheet]
                        ? Array.from(new Set(manuals[editingManual.sheet].map((m: any) => m.categoria))) as string[]
                        : [];
                      const filteredCats = existingCats.filter((cat: string) => 
                        cat.toLowerCase().includes(editingManual.categoria.toLowerCase())
                      );

                      if (filteredCats.length > 0) {
                        return filteredCats.map(cat => (
                          <div
                            key={cat}
                            className={styles.autocompleteItem}
                            onClick={() => {
                              setEditingManual(prev => prev ? { ...prev, categoria: cat } : null);
                              setShowEditingCatSuggestions(false);
                            }}
                          >
                            {cat}
                          </div>
                        ));
                      } else {
                        return <div className={styles.autocompleteNoResults}>Usar "{editingManual.categoria}" como nueva categoría</div>;
                      }
                    })()}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} style={{ color: "#334155" }}>Nombre del Servicio</label>
                <input
                  type="text"
                  value={editingManual.item}
                  onChange={e => setEditingManual(prev => prev ? { ...prev, item: e.target.value } : null)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} style={{ color: "#334155" }}>Enlace de manual (URL de Gamma/Drive)</label>
                <input
                  type="url"
                  value={editingManual.enlace}
                  onChange={e => setEditingManual(prev => prev ? { ...prev, enlace: e.target.value } : null)}
                  className={styles.input}
                  style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
                />
              </div>

              <div className={styles.switchRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", width: "100%" }}>
                <span className={styles.switchLabel} style={{ fontWeight: 600, color: "#334155", fontSize: "0.8125rem" }}>Servicio activo y visible</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={editingManual.activo}
                    onChange={e => setEditingManual(prev => prev ? { ...prev, activo: e.target.checked } : null)}
                  />
                  <span className={`${styles.slider} ${styles.round}`}></span>
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEditingManual(null)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Actualizar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
