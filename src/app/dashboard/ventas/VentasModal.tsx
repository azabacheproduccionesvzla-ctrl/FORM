"use client";

import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";

interface Client {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  pais?: string;
  empresa?: string;
  link_usuario_plataforma?: string;
  setter_original_id?: string;
}

interface User {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo?: boolean;
}

interface PriorSale {
  id: string;
  codigo_venta: string;
  proyecto_nombre: string;
  monto_total: number;
  monto_pagado?: number;
  tipo_proyecto?: string;
  proyecto_link?: string;
  proyecto_brief?: string;
  carpeta_dropbox?: string;
  descripcion_operativa?: string;
  deadline?: string;
  plataforma?: string;
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

interface VentasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialGatingStep?: "choose" | "extension" | "pago_parcial" | "none";
  initialUsers?: User[];
  editingSale?: any | null;
}

export default function VentasModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialGatingStep = "choose",
  initialUsers = [],
  editingSale = null
}: VentasModalProps) {
  
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>(initialUsers && initialUsers.length > 0 ? initialUsers : []);
  const [priorSales, setPriorSales] = useState<PriorSale[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0 && users.length === 0) {
      setUsers(initialUsers);
    }
  }, [initialUsers]);

  // New state variables for projects selection
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [gatingProjSearchQuery, setGatingProjSearchQuery] = useState("");
  const [showGatingProjSuggestions, setShowGatingProjSuggestions] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [manuals, setManuals] = useState<any>({});

  
  const [gatingStep, setGatingStep] = useState<"choose" | "extension" | "pago_parcial" | "none">("choose");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedPriorProject, setSelectedPriorProject] = useState<string>("");
  const [montoCCPagadoPrevio, setMontoCCPagadoPrevio] = useState<number>(0);
  const [montoCCTotalPrevio, setMontoCCTotalPrevio] = useState<number>(0);

  
  const [modifyProjectData, setModifyProjectData] = useState(false);
  const [modifyClientData, setModifyClientData] = useState(false);
  const [modifyPaymentMode, setModifyPaymentMode] = useState(false);

  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  
  const [gatingSearchQuery, setGatingSearchQuery] = useState("");
  const [showGatingSuggestions, setShowGatingSuggestions] = useState(false);
  const [mainSearchQuery, setMainSearchQuery] = useState("");
  const [showMainSuggestions, setShowMainSuggestions] = useState(false);

  
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [confirmPin, setConfirmPin] = useState<string[]>(Array(6).fill(""));
  const [pinError, setPinError] = useState<string | null>(null);

  
  const [isPagoParcial, setIsPagoParcial] = useState(true);
  const [montoPorHora, setMontoPorHora] = useState("");
  const [cantidadHoras, setCantidadHoras] = useState("");

  
  const [closingParticipants, setClosingParticipants] = useState<string[]>([]);
  const [setterAdicionalId, setSetterAdicionalId] = useState("");
  const [actualizarCliente, setActualizarCliente] = useState(false);
  const [agregarSetterAdicional, setAgregarSetterAdicional] = useState(false);

  
  const [showCustomGating, setShowCustomGating] = useState(false);
  const [showCustomEdit, setShowCustomEdit] = useState(false);
  const [showCustomNew, setShowCustomNew] = useState(false);

  // Estados para el modal de confirmación de regeneración de integraciones al editar
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerateChoice, setRegenerateChoice] = useState<boolean | null>(null);

  // Estados para el sistema de borradores (localStorage)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<any>(null);

  const isDraftEmpty = (draft: any) => {
    if (!draft || !draft.formData) return true;
    const fd = draft.formData;
    return (
      !fd.cliente_nombre?.trim() &&
      !fd.cliente_id &&
      !fd.proyecto_nombre?.trim() &&
      !fd.monto_total?.trim() &&
      !fd.monto_pagado?.trim() &&
      !fd.proyecto_previo_id &&
      !fd.proyecto_id
    );
  };

  const [formData, setFormData] = useState({
    
    es_continuacion: false,
    tipo_continuacion: "", 
    proyecto_previo_id: "",
    proyecto_id: "",

    
    tipo_venta: "Nueva Venta", 
    tipo_proyecto: "Precio Fijo", 
    tipo_proyecto_otro: "",
    status_pago: "Pago Parcial", 
    plataforma: "Workana",

    
    cliente_nuevo: true,
    cliente_id: "",
    cliente_nombre: "",
    cliente_telefono: "",
    cliente_email: "",
    cliente_pais: "",
    cliente_empresa: "",
    cliente_link_usuario: "",

    
    proyecto_nombre: "",
    proyecto_link: "",
    proyecto_brief: "",
    descripcion_operativa: "",
    deadline: "",
    urgente: false,
    motivo_urgencia: "",

    
    moneda: "USD",
    moneda_otra: "",
    monto_total: "",
    monto_explicacion: "",
    monto_pagado: "",
    comision_total: "",
    fecha_pago: "",
    fecha_liberacion_pendiente: false,
    comprobante_link: "",
    comprobante_no_aplica: true, 

    
    setter_principal_id: "",
    setters_adicionales_ids: [] as string[],
    closer_principal_id: "",
    closers_adicionales_ids: [] as string[],

    
    tipo_cierre: "Cierre por closer",
    notas_internas: "",
    manual_rama: "",
    manual_categoria: "",
    manual_servicio: "",
    manual_enlace: "",
    manuales_servicios: [] as Array<{ id?: string | number; rama: string; categoria: string; servicio: string; enlace: string; }>
  });

  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  
  const resetToDefaultStates = () => {
    setGatingStep(initialGatingStep);
    setSelectedClient("");
    setSelectedPriorProject("");
    setGatingProjSearchQuery("");
    setShowGatingProjSuggestions(false);
    setSelectedProject(null);
    setMontoCCPagadoPrevio(0);
    setMontoCCTotalPrevio(0);
    setModifyProjectData(false);
    setModifyClientData(false);
    setModifyPaymentMode(false);
    setStep(1);
    setFormError(null);
    setGatingSearchQuery("");
    setShowGatingSuggestions(false);
    setMainSearchQuery("");
    setShowMainSuggestions(false);
    setShowPinConfirm(false);
    setConfirmPin(Array(6).fill(""));
    setPinError(null);
    setIsPagoParcial(true);
    setMontoPorHora("");
    setCantidadHoras("");
    setClosingParticipants([]);
    setSetterAdicionalId("");
    setActualizarCliente(false);
    setAgregarSetterAdicional(false);

    setFormData({
      es_continuacion: false,
      tipo_continuacion: "",
      proyecto_previo_id: "",
      proyecto_id: "",
      tipo_venta: "Nueva Venta",
      tipo_proyecto: "Precio Fijo",
      tipo_proyecto_otro: "",
      status_pago: "Pago Parcial",
      plataforma: "Workana",
      cliente_nuevo: true,
      cliente_id: "",
      cliente_nombre: "",
      cliente_telefono: "",
      cliente_email: "",
      cliente_pais: "",
      cliente_empresa: "",
      cliente_link_usuario: "",
      proyecto_nombre: "",
      proyecto_link: "",
      proyecto_brief: "",
      descripcion_operativa: "",
      deadline: "",
      urgente: false,
      motivo_urgencia: "",
      moneda: "USD",
      moneda_otra: "",
      monto_total: "",
      monto_explicacion: "",
      monto_pagado: "",
      comision_total: "",
      fecha_pago: "",
      fecha_liberacion_pendiente: false,
      comprobante_link: "",
      comprobante_no_aplica: true,
      setter_principal_id: "",
      setters_adicionales_ids: [],
      closer_principal_id: "",
      closers_adicionales_ids: [],
      tipo_cierre: "Cierre por closer",
      notas_internas: "",
      manual_rama: "",
      manual_categoria: "",
      manual_servicio: "",
      manual_enlace: "",
      manuales_servicios: []
    });
  };

  useEffect(() => {
    if (isOpen && editingSale) {
      setGatingStep("none");
      setShowRegenerateConfirm(false);
      setRegenerateChoice(null);

      setSelectedClient(editingSale.cliente_id || "");
      setMainSearchQuery(editingSale.clientes?.nombre || "");
      setGatingProjSearchQuery(editingSale.proyecto_nombre || "");
      setIsPagoParcial(editingSale.status_pago === "Pago Parcial");
      setModifyClientData(true);
      setModifyProjectData(true);
      setModifyPaymentMode(true);
      setActualizarCliente(true);

      if (editingSale.setters_adicionales_ids && editingSale.setters_adicionales_ids.length > 0) {
        setAgregarSetterAdicional(true);
        setSetterAdicionalId(editingSale.setters_adicionales_ids[0]);
      } else {
        setAgregarSetterAdicional(false);
        setSetterAdicionalId("");
      }

      setFormData({
        es_continuacion: editingSale.es_continuacion || false,
        tipo_continuacion: editingSale.tipo_continuacion || "",
        proyecto_previo_id: editingSale.proyecto_previo_id || "",
        proyecto_id: "",
        tipo_venta: editingSale.tipo_venta || "Nueva Venta",
        tipo_proyecto: editingSale.tipo_proyecto || "Precio Fijo",
        tipo_proyecto_otro: editingSale.tipo_proyecto_otro || "",
        status_pago: editingSale.status_pago || "Pago Parcial",
        plataforma: editingSale.plataforma || "Workana",
        cliente_nuevo: !editingSale.cliente_id,
        cliente_id: editingSale.cliente_id || "",
        cliente_nombre: editingSale.clientes?.nombre || "",
        cliente_telefono: editingSale.clientes?.telefono || "",
        cliente_email: editingSale.clientes?.email || "",
        cliente_pais: editingSale.clientes?.pais || "",
        cliente_empresa: editingSale.clientes?.empresa || "",
        cliente_link_usuario: editingSale.clientes?.link_usuario_plataforma || "",
        proyecto_nombre: editingSale.proyecto_nombre || "",
        proyecto_link: editingSale.proyecto_link || "",
        proyecto_brief: editingSale.proyecto_brief || "",
        descripcion_operativa: editingSale.descripcion_operativa || "",
        deadline: editingSale.deadline ? editingSale.deadline.split("T")[0] : "",
        urgente: editingSale.urgente || false,
        motivo_urgencia: editingSale.motivo_urgencia || "",
        moneda: editingSale.moneda || "USD",
        moneda_otra: editingSale.moneda_otra || "",
        monto_total: editingSale.monto_total ? String(editingSale.monto_total) : "",
        monto_explicacion: editingSale.monto_explicacion || "",
        monto_pagado: editingSale.monto_pagado ? String(editingSale.monto_pagado) : "",
        comision_total: editingSale.comision_total ? String(editingSale.comision_total) : "",
        fecha_pago: editingSale.fecha_pago ? editingSale.fecha_pago.split("T")[0] : "",
        fecha_liberacion_pendiente: editingSale.fecha_liberacion_pendiente || false,
        comprobante_link: editingSale.comprobante_link || "",
        comprobante_no_aplica: editingSale.comprobante_no_aplica ?? true,
        setter_principal_id: editingSale.setter_principal_id || "",
        setters_adicionales_ids: editingSale.setters_adicionales_ids || [],
        closer_principal_id: editingSale.closer_principal_id || "",
        closers_adicionales_ids: editingSale.closers_adicionales_ids || [],
        tipo_cierre: editingSale.tipo_cierre || "Cierre por closer",
        notas_internas: editingSale.notas_internas || "",
        manual_rama: editingSale.manual_rama || "",
        manual_categoria: editingSale.manual_categoria || "",
        manual_servicio: editingSale.manual_servicio || "",
        manual_enlace: editingSale.manual_enlace || "",
        manuales_servicios: editingSale.manuales_servicios || []
      });

      const closers = [editingSale.closer_principal_id, ...(editingSale.closers_adicionales_ids || [])].filter(Boolean);
      setClosingParticipants(closers);
    }
  }, [isOpen, editingSale]);

  // Cargar catálogos siempre al abrir el modal
  useEffect(() => {
    if (isOpen) {
      async function loadAuxiliaryData() {
        setLoadingData(true);
        try {
          const results = await Promise.allSettled([
            fetch("/api/clients").then(r => r.json()),
            fetch("/api/users").then(r => r.json()),
            fetch("/api/projects").then(r => r.json()),
            fetch("/api/config/manuals").then(r => r.json())
          ]);

          if (results[0].status === "fulfilled" && results[0].value?.success) {
            setClients(results[0].value.clients || []);
          }
          if (results[1].status === "fulfilled" && results[1].value?.success) {
            const fetchedUsers = results[1].value.users || [];
            if (fetchedUsers.length > 0) {
              setUsers(fetchedUsers);
            }
          }
          if (results[2].status === "fulfilled" && results[2].value?.success) {
            setAllProjects(results[2].value.projects || []);
          }
          if (results[3].status === "fulfilled" && results[3].value?.success) {
            setManuals(results[3].value.manuals || {});
          }
        } catch (error) {
          console.error("Error al cargar datos del formulario:", error);
        } finally {
          setLoadingData(false);
        }
      }
      loadAuxiliaryData();
    }
  }, [isOpen]);

  // Verificar si hay borrador guardado en localStorage al abrir
  useEffect(() => {
    if (isOpen) {
      if (editingSale) {
        setShowDraftPrompt(false);
        setDraftToRestore(null);
        return;
      }
      const draftStr = localStorage.getItem("sales_draft");
      let parsedDraft = null;
      try {
        if (draftStr) parsedDraft = JSON.parse(draftStr);
      } catch (e) {
        console.error("Error al parsear borrador de venta:", e);
      }

      if (parsedDraft && !isDraftEmpty(parsedDraft)) {
        setDraftToRestore(parsedDraft);
        setShowDraftPrompt(true);
      } else {
        setShowDraftPrompt(false);
        setDraftToRestore(null);
        resetToDefaultStates();
      }
    }
  }, [isOpen, initialGatingStep, editingSale]);

  // Guardar borrador automáticamente ante cualquier cambio de estado (solo si no es edición)
  useEffect(() => {
    if (isOpen && !showDraftPrompt && !editingSale) {
      const draftData = {
        formData,
        step,
        gatingStep,
        modifyProjectData,
        modifyClientData,
        modifyPaymentMode,
        isPagoParcial,
        montoPorHora,
        cantidadHoras,
        closingParticipants,
        setterAdicionalId,
        actualizarCliente,
        agregarSetterAdicional,
        selectedProject,
        selectedClient
      };

      if (!isDraftEmpty(draftData)) {
        localStorage.setItem("sales_draft", JSON.stringify(draftData));
      }
    }
  }, [
    isOpen,
    showDraftPrompt,
    editingSale,
    formData,
    step,
    gatingStep,
    modifyProjectData,
    modifyClientData,
    modifyPaymentMode,
    isPagoParcial,
    montoPorHora,
    cantidadHoras,
    closingParticipants,
    setterAdicionalId,
    actualizarCliente,
    agregarSetterAdicional,
    selectedProject,
    selectedClient
  ]);

  const handleRestoreDraft = () => {
    if (!draftToRestore) return;
    const d = draftToRestore;
    if (d.formData) setFormData(d.formData);
    if (d.step !== undefined) setStep(d.step);
    if (d.gatingStep !== undefined) setGatingStep(d.gatingStep);
    if (d.modifyProjectData !== undefined) setModifyProjectData(d.modifyProjectData);
    if (d.modifyClientData !== undefined) setModifyClientData(d.modifyClientData);
    if (d.modifyPaymentMode !== undefined) setModifyPaymentMode(d.modifyPaymentMode);
    if (d.isPagoParcial !== undefined) setIsPagoParcial(d.isPagoParcial);
    if (d.montoPorHora !== undefined) setMontoPorHora(d.montoPorHora);
    if (d.cantidadHoras !== undefined) setCantidadHoras(d.cantidadHoras);
    if (d.closingParticipants !== undefined) setClosingParticipants(d.closingParticipants);
    if (d.setterAdicionalId !== undefined) setSetterAdicionalId(d.setterAdicionalId);
    if (d.actualizarCliente !== undefined) setActualizarCliente(d.actualizarCliente);
    if (d.agregarSetterAdicional !== undefined) setAgregarSetterAdicional(d.agregarSetterAdicional);
    if (d.selectedProject !== undefined) setSelectedProject(d.selectedProject);
    if (d.selectedClient !== undefined) setSelectedClient(d.selectedClient);

    if (d.selectedProject) {
      setGatingProjSearchQuery(d.selectedProject.nombre || "");
    }
    if (d.selectedClient) {
      setMainSearchQuery(d.formData?.cliente_nombre || "");
      setGatingSearchQuery(d.formData?.cliente_nombre || "");
    }

    setShowDraftPrompt(false);
    setDraftToRestore(null);
  };

  const handleDiscardDraft = () => {
    const confirmDiscard = window.confirm("¿Estás seguro? Tu venta sin registrar se va a descartar de forma permanente.");
    if (!confirmDiscard) return;

    localStorage.removeItem("sales_draft");
    setShowDraftPrompt(false);
    setDraftToRestore(null);
    resetToDefaultStates();
  };

  
  useEffect(() => {
    if (selectedClient && (gatingStep === "extension" || gatingStep === "pago_parcial")) {
      async function loadPriorSales() {
        try {
          const res = await fetch(`/api/sales?cliente_id=${selectedClient}`);
          const data = await res.json();
          if (data.success) {
            setPriorSales(data.sales || []);
          }
        } catch (error) {
          console.error("Error al cargar proyectos del cliente:", error);
        }
      }
      loadPriorSales();
    } else {
      setPriorSales([]);
      setSelectedPriorProject("");
    }
  }, [selectedClient, gatingStep]);

  
  useEffect(() => {
    if (formData.cliente_id) {
      const client = clients.find(c => c.id === formData.cliente_id);
      if (client) {
        setMainSearchQuery(client.nombre);
        
        setFormData(prev => ({
          ...prev,
          cliente_telefono: client.telefono || "",
          cliente_email: client.email || "",
          cliente_pais: client.pais || "",
          cliente_empresa: client.empresa || "",
          cliente_link_usuario: client.link_usuario_plataforma || ""
        }));
      }
    } else {
      setMainSearchQuery("");
    }
  }, [formData.cliente_id, clients]);

  useEffect(() => {
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient);
      if (client) {
        setGatingSearchQuery(client.nombre);
      }
    } else {
      setGatingSearchQuery("");
    }
  }, [selectedClient, clients]);

  useEffect(() => {
    if (formData.cliente_pais) {
      const isPre = isPredefinedCountry(formData.cliente_pais);
      if (!isPre) {
        setShowCustomGating(true);
        setShowCustomEdit(true);
        setShowCustomNew(true);
      } else {
        setShowCustomGating(false);
        setShowCustomEdit(false);
        setShowCustomNew(false);
      }
    } else {
      setShowCustomGating(false);
      setShowCustomEdit(false);
      setShowCustomNew(false);
    }
  }, [formData.cliente_pais]);

  
  useEffect(() => {
    if (formData.tipo_proyecto === "Por Hora") {
      setIsPagoParcial(false);
      setFormData(prev => ({
        ...prev,
        status_pago: "Pago Adelantado",
        monto_pagado: ""
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        status_pago: isPagoParcial ? "Pago Parcial" : "Pago Adelantado"
      }));
    }
  }, [formData.tipo_proyecto, isPagoParcial]);

  
  useEffect(() => {
    if (formData.tipo_proyecto === "Por Hora" && montoPorHora) {
      const hrs = cantidadHoras ? parseFloat(cantidadHoras) : 0;
      const calculated = (parseFloat(montoPorHora) * hrs).toFixed(2);
      setFormData(prev => ({ ...prev, monto_total: calculated }));
    }
  }, [formData.tipo_proyecto, montoPorHora, cantidadHoras]);

  
  const formatUrl = (value: string): string => {
    if (!value) return "";
    const trimmed = value.trim();
    if (trimmed.includes(".") && !/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  
  const handlePriorProjectSelect = (projectId: string) => {
    setSelectedPriorProject(projectId);
    const sale = priorSales.find(s => s.id === projectId);
    if (sale) {
      setMontoCCTotalPrevio(sale.monto_total);
      setMontoCCPagadoPrevio(sale.monto_pagado || sale.monto_total);
    }
  };

  
  const handleConfirmGating = () => {
    if (gatingStep === "extension" || gatingStep === "pago_parcial") {
      if (!selectedProject) {
        setFormError("Por favor, selecciona el proyecto previo.");
        return;
      }
      if (!formData.cliente_nuevo && !formData.cliente_id) {
        setFormError("Por favor, selecciona o crea un cliente para este proyecto.");
        return;
      }
      if (formData.cliente_nuevo && !formData.cliente_nombre) {
        setFormError("Por favor, ingresa el nombre para el nuevo cliente.");
        return;
      }
      if (formData.cliente_nuevo && !formData.cliente_email?.trim() && !formData.cliente_telefono?.trim()) {
        setFormError("Por favor, ingresa al menos el correo electrónico (email) o el teléfono para el nuevo cliente.");
        return;
      }

      const priorSaleId = selectedProject.venta_id || "";

      setFormData(prev => ({
        ...prev,
        es_continuacion: true,
        tipo_continuacion: gatingStep,
        proyecto_previo_id: priorSaleId,
        proyecto_id: selectedProject.id,
        tipo_venta: gatingStep === "extension" ? "Extensión de Proyecto" : "Pago Parcial",
        status_pago: gatingStep === "pago_parcial" ? "Pago Parcial" : prev.status_pago,
        proyecto_nombre: gatingStep === "extension" ? `Extensión - ${selectedProject.nombre}` : selectedProject.nombre,
        proyecto_link: selectedProject.link_trello || "",
        carpeta_dropbox: selectedProject.carpeta_dropbox || "",
        proyecto_brief: selectedProject.ventas?.proyecto_brief || "",
        descripcion_operativa: selectedProject.ventas?.descripcion_operativa || "",
        deadline: selectedProject.ventas?.deadline || "",
        tipo_proyecto: selectedProject.ventas?.tipo_proyecto || "Precio Fijo",
        moneda: selectedProject.ventas?.moneda || "USD"
      }));

      if (selectedProject.ventas?.tipo_proyecto === "Por Hora") {
        setMontoPorHora(selectedProject.ventas.monto_total?.toString() || "");
      }

      setGatingStep("none");
      setFormError(null);
    } else {
      setGatingStep("none");
    }
  };

  
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    
    if (step === 1) {
      if (!formData.cliente_nuevo && !formData.cliente_id) {
        setFormError("Debes seleccionar un cliente existente o cambiar a Cliente Nuevo.");
        return;
      }
      if (formData.cliente_nuevo && !formData.cliente_nombre) {
        setFormError("Debes ingresar el nombre del cliente nuevo.");
        return;
      }
      if (!formData.cliente_email?.trim() && !formData.cliente_telefono?.trim()) {
        setFormError("Debes ingresar al menos el correo electrónico (email) o el teléfono del cliente para poder registrar la venta.");
        return;
      }
      if (!formData.proyecto_nombre) {
        setFormError("El nombre del proyecto es obligatorio.");
        return;
      }
      if (!formData.monto_total) {
        setFormError("El monto total es obligatorio.");
        return;
      }

      
      if (formData.tipo_proyecto === "Por Hora") {
        if (!montoPorHora) {
          setFormError("Debes ingresar el monto por hora.");
          return;
        }
        if (formData.es_continuacion && !cantidadHoras) {
          setFormError("Debes ingresar la cantidad de horas.");
          return;
        }
      }

      
      if (formData.tipo_proyecto === "Precio Fijo" && isPagoParcial && !formData.monto_pagado) {
        setFormError("Debes ingresar el monto parcial ya pagado.");
        return;
      }

      
      const clientObj = formData.cliente_nuevo ? null : clients.find(c => c.id === formData.cliente_id);
      const hasSetterOriginal = clientObj && clientObj.setter_original_id;

      if (formData.cliente_nuevo || !hasSetterOriginal) {
        if (!formData.setter_principal_id) {
          setFormError("Debes seleccionar a la persona que oferta (Setter).");
          return;
        }
      } else {
        if (agregarSetterAdicional && !setterAdicionalId) {
          setFormError("Debes seleccionar el nuevo setter adicional.");
          return;
        }
      }

      
      setFormData(prev => ({
        ...prev,
        proyecto_link: formatUrl(prev.proyecto_link),
        proyecto_brief: formatUrl(prev.proyecto_brief),
        cliente_link_usuario: formatUrl(prev.cliente_link_usuario),
      }));

      setStep(2);
      return;
    }

    
    if (step === 2) {
      if (closingParticipants.length === 0) {
        setFormError("Debes seleccionar al menos un participante en el proceso de cierre.");
        return;
      }

      if (formData.moneda === "Otra" && !formData.moneda_otra) {
        setFormError("Especifica el tipo de moneda.");
        return;
      }

      if (formData.urgente && !formData.motivo_urgencia) {
        setFormError("Especifica el motivo de la urgencia.");
        return;
      }

      
      setStep(3);
    }
  };

  
  const handleOpenPinModal = () => {
    if (editingSale) {
      const origClient = (editingSale.clientes?.nombre || "").trim().toLowerCase();
      const newClient = (formData.cliente_nombre || "").trim().toLowerCase();
      const origProj = (editingSale.proyecto_nombre || "").trim().toLowerCase();
      const newProj = (formData.proyecto_nombre || "").trim().toLowerCase();

      if ((newClient && origClient !== newClient) || (newProj && origProj !== newProj)) {
        setShowRegenerateConfirm(true);
        return;
      }
    }
    proceedToPinModal(false);
  };

  const proceedToPinModal = (shouldRegenerate: boolean) => {
    setRegenerateChoice(shouldRegenerate);
    setShowRegenerateConfirm(false);
    setPinError(null);
    setConfirmPin(Array(6).fill(""));
    setShowPinConfirm(true);
    setTimeout(() => {
      const firstInput = document.getElementById("pin-input-0");
      if (firstInput) firstInput.focus();
    }, 100);
  };

  
  const handleConfirmPinSubmit = async () => {
    if (submitting) return;
    setPinError(null);
    setSubmitting(true);

    const pinStr = confirmPin.join("");

    
    const closerPrincipal = closingParticipants[0] || "";
    const closersAdicionales = closingParticipants.slice(1);

    
    let setterPrincipal = formData.setter_principal_id;
    let settersAdicionales: string[] = [];

    const clientObj = formData.cliente_nuevo ? null : clients.find(c => c.id === formData.cliente_id);
    const hasSetterOriginal = clientObj && clientObj.setter_original_id;

    if (!formData.cliente_nuevo && hasSetterOriginal) {
      if (agregarSetterAdicional && setterAdicionalId) {
        setterPrincipal = setterAdicionalId; 
        settersAdicionales = [clientObj.setter_original_id!]; 
      } else {
        setterPrincipal = clientObj.setter_original_id!; 
        settersAdicionales = [];
      }
    }
    const finalPayload = {
      ...(editingSale ? { id: editingSale.id, regenerateIntegrations: !!regenerateChoice } : {}),
      ...formData,
      setter_principal_id: setterPrincipal,
      setters_adicionales_ids: settersAdicionales,
      closer_principal_id: closerPrincipal,
      closers_adicionales_ids: closersAdicionales,
      actualizar_cliente: isExtension ? modifyClientData : actualizarCliente,
      pin: pinStr
    };

    // Remove draft immediately so page reloads during network wait don't duplicate submission
    localStorage.removeItem("sales_draft");

    try {
      const res = await fetch("/api/sales", {
        method: editingSale ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error al ${editingSale ? "modificar" : "registrar"} la venta.`);

      const sale = data.sale;
      if (sale && !editingSale) {
        const failed = [];
        if (sale.status_ghl === "ERROR" || sale.status_ghl_contacto === "ERROR" || sale.status_ghl_factura === "ERROR") failed.push("GoHighLevel");
        if (sale.status_trello === "ERROR") failed.push("Trello");
        if (sale.status_dropbox === "ERROR") failed.push("Dropbox");
        if (sale.status_email === "ERROR") failed.push("Email");
        if (sale.status_whatsapp === "ERROR") failed.push("WhatsApp");
        if (sale.status_sheets === "ERROR") failed.push("Google Sheets");

        if (failed.length > 0) {
          alert(`La venta fue registrada en la base de datos, pero las siguientes integraciones fallaron: ${failed.join(", ")}. Puedes reintentarlas desde el panel de control.`);
        }
      }

      localStorage.removeItem("sales_draft");
      onSuccess();
      setShowPinConfirm(false);
      onClose();
    } catch (err: any) {
      setPinError(err.message || "Error al conectar con el servidor.");
      setConfirmPin(Array(6).fill(""));
      
      setTimeout(() => {
        const firstInput = document.getElementById("pin-input-0");
        if (firstInput) firstInput.focus();
      }, 50);
    } finally {
      setSubmitting(false);
    }
  };

  
  const handlePinChange = (index: number, value: string) => {
    if (value !== "" && !/^[0-9]$/.test(value)) return;

    const newPin = [...confirmPin];
    newPin[index] = value;
    setConfirmPin(newPin);

    
    if (value !== "" && index < 5) {
      const nextInput = document.getElementById(`pin-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (confirmPin[index] === "" && index > 0) {
        const newPin = [...confirmPin];
        newPin[index - 1] = "";
        setConfirmPin(newPin);
        const prevInput = document.getElementById(`pin-input-${index - 1}`);
        if (prevInput) prevInput.focus();
      } else {
        const newPin = [...confirmPin];
        newPin[index] = "";
        setConfirmPin(newPin);
      }
    }
  };

  
  const activeUsers = users.filter(u => u.activo !== false);

  let setters = activeUsers.filter(u => {
    if (!u.rol) return true;
    const r = String(u.rol).toLowerCase().trim();
    return r === "ventas" || r === "admin" || r === "setter" || r === "closer" || r === "sales" || r === "director";
  });
  if (setters.length === 0 && activeUsers.length > 0) {
    setters = activeUsers;
  }

  let closingCandidates = activeUsers.filter(u => {
    if (!u.rol) return true;
    const r = String(u.rol).toLowerCase().trim();
    return r === "ventas" || r === "admin" || r === "setter" || r === "closer" || r === "sales" || r === "director";
  });
  if (closingCandidates.length === 0 && activeUsers.length > 0) {
    closingCandidates = activeUsers;
  }

  const handleAddServiceToPackage = (srvToInsert?: any) => {
    const r = formData.manual_rama;
    const s = srvToInsert || (formData.manual_rama && manuals && manuals[formData.manual_rama]
      ? manuals[formData.manual_rama].find((item: any) => item.item === formData.manual_servicio)
      : null);

    if (!r || !s) return;

    const newItem = {
      id: s.id,
      rama: r,
      categoria: s.categoria || "",
      servicio: s.item,
      enlace: s.enlace || ""
    };

    setFormData(prev => {
      const currentList = prev.manuales_servicios || [];
      const exists = currentList.some(item => item.servicio === newItem.servicio && item.categoria === newItem.categoria && item.rama === newItem.rama);
      if (exists) return prev;

      const newList = [...currentList, newItem];
      
      let updatedProjName = prev.proyecto_nombre;
      if (!updatedProjName || currentList.map(i => i.servicio).includes(updatedProjName)) {
        updatedProjName = newList.map(i => i.servicio).join(" + ");
      }

      return {
        ...prev,
        manuales_servicios: newList,
        manual_rama: newList[0]?.rama || "",
        manual_categoria: newList[0]?.categoria || "",
        manual_servicio: newList.map(i => i.servicio).join(", "),
        manual_enlace: newList[0]?.enlace || "",
        proyecto_nombre: updatedProjName
      };
    });
  };

  const handleRemoveServiceFromPackage = (index: number) => {
    setFormData(prev => {
      const currentList = prev.manuales_servicios || [];
      const newList = currentList.filter((_, idx) => idx !== index);
      return {
        ...prev,
        manuales_servicios: newList,
        manual_rama: newList[0]?.rama || "",
        manual_categoria: newList[0]?.categoria || "",
        manual_servicio: newList.map(i => i.servicio).join(", "),
        manual_enlace: newList[0]?.enlace || ""
      };
    });
  };

  
  const filteredProjectsGating = allProjects.filter((p) => {
    if (!gatingProjSearchQuery || gatingProjSearchQuery.trim() === "") return true;
    const q = gatingProjSearchQuery.trim().toLowerCase();
    if (editingSale && q === (editingSale.proyecto_nombre || "").trim().toLowerCase()) return true;
    return (
      p.nombre?.toLowerCase().includes(q) ||
      p.clientes?.nombre?.toLowerCase().includes(q) ||
      (p.ventas?.codigo_venta && p.ventas.codigo_venta.toLowerCase().includes(q))
    );
  }).slice(0, 5);

  const handleProjectSelect = (proj: any) => {
    setSelectedProject(proj);
    setGatingProjSearchQuery(proj.nombre);
    setShowGatingProjSuggestions(false);

    if (proj.venta_id) {
      setSelectedPriorProject(proj.venta_id);
      const amount = proj.ventas?.monto_total || 0;
      setMontoCCTotalPrevio(amount);
      setMontoCCPagadoPrevio(proj.ventas?.monto_pagado || amount);
    } else {
      setSelectedPriorProject("");
      setMontoCCTotalPrevio(0);
      setMontoCCPagadoPrevio(0);
    }

    const client = proj.clientes;
    const isGenericClient = client && client.nombre === "Cliente Trello Sin Clasificar";

    if (client && !isGenericClient) {
      setSelectedClient(client.id);
      setGatingSearchQuery(client.nombre);
      setFormData(prev => ({
        ...prev,
        cliente_nuevo: false,
        cliente_id: client.id,
        cliente_nombre: client.nombre,
        cliente_telefono: client.telefono || "",
        cliente_email: client.email || "",
        cliente_pais: client.pais || "",
        cliente_empresa: client.empresa || "",
        cliente_link_usuario: client.link_usuario_plataforma || ""
      }));
    } else {
      setSelectedClient("");
      setGatingSearchQuery("");
      setFormData(prev => ({
        ...prev,
        cliente_id: "",
        cliente_nuevo: false,
        cliente_nombre: "",
        cliente_telefono: "",
        cliente_email: "",
        cliente_pais: "",
        cliente_empresa: "",
        cliente_link_usuario: ""
      }));
    }
  };

  const filteredClientsGating = clients.filter(c =>
    c.nombre.toLowerCase().includes(gatingSearchQuery.toLowerCase())
  ).slice(0, 5);

  const filteredClientsMain = clients.filter(c =>
    c.nombre.toLowerCase().includes(mainSearchQuery.toLowerCase())
  ).slice(0, 5);

  if (!isOpen) return null;

  
  let modalWidth = "680px";
  if (showDraftPrompt) {
    modalWidth = "480px";
  } else if (gatingStep === "choose") {
    modalWidth = "640px";
  } else if (gatingStep === "extension" || gatingStep === "pago_parcial") {
    modalWidth = "480px";
  }

  
  const isExtension = !editingSale && formData.es_continuacion;
  const disableClientFields = !editingSale && isExtension && !modifyClientData;
  const disableProjectFields = !editingSale && isExtension && !modifyProjectData;
  const disablePaymentFields = !editingSale && isExtension && !modifyPaymentMode;

  
  const clientObj = formData.cliente_nuevo ? null : clients.find(c => c.id === formData.cliente_id);
  const hasSetterOriginal = clientObj && clientObj.setter_original_id;
  const origSetterObj = hasSetterOriginal ? users.find(u => u.id === clientObj.setter_original_id) : null;

  const isAnyAutocompleteOpen = showGatingProjSuggestions || showGatingSuggestions || showMainSuggestions;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: modalWidth, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "95vh" }}>

        
        <div className={styles.modalHeader} style={{ padding: "1.25rem 1.5rem", marginBottom: 0, borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
          <h3 className={styles.modalTitle} style={{ margin: 0, fontSize: "1.25rem", fontWeight: "500", color: "#0f172a" }}>
            {editingSale ? `Editar Venta (${editingSale.codigo_venta})` : "Nueva venta"}
          </h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={submitting}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {formError && (
          <div className={styles.alertError} style={{ margin: "1rem 1.5rem 0 1.5rem", boxSizing: "border-box" }}>
            <span>{formError}</span>
          </div>
        )}

        {}
        {showDraftPrompt ? (
          <div style={{ flexGrow: 1, overflowY: "auto", padding: "1.5rem 1.5rem 2.5rem 1.5rem", display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
            <span className={styles.gatingTitle} style={{ alignSelf: "center", marginBottom: "0.5rem", fontWeight: "500", fontSize: "1.15rem", textAlign: "center" }}>
              Borrador de venta detectado
            </span>
            <p style={{ fontSize: "0.85rem", color: "#64748b", textAlign: "center", marginBottom: "1.5rem", marginTop: 0 }}>
              Tienes una venta sin registrar. ¿Deseas continuar desde donde lo dejaste o empezar una nueva venta?
            </p>

            <div style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "1.25rem",
              marginBottom: "2rem",
              fontSize: "0.9rem",
              color: "#334155"
            }}>
              <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", fontWeight: "600", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
                Resumen del Borrador
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.5rem 1rem", alignItems: "start" }}>
                {draftToRestore?.formData?.cliente_nombre ? (
                  <>
                    <strong style={{ color: "#475569" }}>Cliente:</strong>
                    <span style={{ fontWeight: "500", color: "#0f172a" }}>{draftToRestore.formData.cliente_nombre}</span>
                  </>
                ) : draftToRestore?.formData?.cliente_id ? (
                  <>
                    <strong style={{ color: "#475569" }}>Cliente ID:</strong>
                    <span style={{ fontWeight: "500", color: "#0f172a" }}>
                      {clients.find(c => c.id === draftToRestore.formData.cliente_id)?.nombre || draftToRestore.formData.cliente_id}
                    </span>
                  </>
                ) : null}

                {draftToRestore?.formData?.proyecto_nombre && (
                  <>
                    <strong style={{ color: "#475569" }}>Proyecto:</strong>
                    <span style={{ fontWeight: "500", color: "#0f172a" }}>{draftToRestore.formData.proyecto_nombre}</span>
                  </>
                )}

                {draftToRestore?.formData?.tipo_venta && (
                  <>
                    <strong style={{ color: "#475569" }}>Tipo de Venta:</strong>
                    <span style={{ fontWeight: "500", color: "#0f172a" }}>{draftToRestore.formData.tipo_venta}</span>
                  </>
                )}

                {draftToRestore?.formData?.plataforma && (
                  <>
                    <strong style={{ color: "#475569" }}>Plataforma:</strong>
                    <span style={{ fontWeight: "500", color: "#0f172a" }}>{draftToRestore.formData.plataforma}</span>
                  </>
                )}

                {draftToRestore?.formData?.monto_total && (
                  <>
                    <strong style={{ color: "#475569" }}>Monto:</strong>
                    <span style={{ fontWeight: "600", color: "#0f172a" }}>
                      {draftToRestore.formData.monto_total} {draftToRestore.formData.moneda || "USD"}
                    </span>
                  </>
                )}

                {draftToRestore?.step && (
                  <>
                    <strong style={{ color: "#475569" }}>Último paso:</strong>
                    <span style={{ fontWeight: "500", color: "#0f172a" }}>Paso {draftToRestore.step} de 3</span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", width: "100%", marginTop: "1.5rem" }}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{
                  flex: 1,
                  padding: "0.75rem 0.5rem",
                  minHeight: "44px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  lineHeight: "1.2",
                  borderColor: "#cbd5e1",
                  color: "#64748b"
                }}
                onClick={handleDiscardDraft}
              >
                Registrar nueva venta
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{
                  flex: 1,
                  padding: "0.75rem 0.5rem",
                  minHeight: "44px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center"
                }}
                onClick={handleRestoreDraft}
              >
                Continuar venta
              </button>
            </div>
          </div>
        ) : gatingStep !== "none" ? (
          <div style={{ flexGrow: 1, overflowY: isAnyAutocompleteOpen ? "visible" : "auto", padding: "1.5rem 1.5rem 2.5rem 1.5rem" }} className={styles.modalBodyScrollable}>
            {gatingStep === "choose" && (
              <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                <span className={styles.gatingTitle} style={{ alignSelf: "center", marginBottom: "0.25rem", fontWeight: "500", fontSize: "1.1rem" }}>¿Qué tipo de registro deseas realizar?</span>
                <p style={{ fontSize: "0.85rem", color: "#64748b", textAlign: "center", marginBottom: "1.25rem" }}>
                  Selecciona una opción para guiar el proceso de registro de la venta.
                </p>
                <div className={styles.gatingGrid}>
                  <div className={styles.gatingCard} onClick={() => setGatingStep("none")}>
                    <div className={styles.gatingCardIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                      </svg>
                    </div>
                    <span className={styles.gatingCardTitle} style={{ fontWeight: "600" }}>Proyecto Nuevo</span>
                    <span className={styles.gatingCardDesc}>Registrar una venta desde cero para un cliente nuevo o existente</span>
                  </div>

                  <div className={styles.gatingCard} onClick={() => setGatingStep("extension")}>
                    <div className={styles.gatingCardIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        <path d="M12 11h6"></path>
                        <path d="M15 8l3 3-3 3"></path>
                      </svg>
                    </div>
                    <span className={styles.gatingCardTitle} style={{ fontWeight: "600" }}>Extensión</span>
                    <span className={styles.gatingCardDesc}>Añadir alcance o ampliación a un proyecto que ya existe</span>
                  </div>

                  <div className={styles.gatingCard} onClick={() => setGatingStep("pago_parcial")}>
                    <div className={styles.gatingCardIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                        <line x1="7" y1="15" x2="13" y2="15"></line>
                      </svg>
                    </div>
                    <span className={styles.gatingCardTitle} style={{ fontWeight: "600" }}>Pago completo o cierre</span>
                    <span className={styles.gatingCardDesc}>Registrar abonos o cuotas pendientes de un proyecto anterior</span>
                  </div>
                </div>
              </div>
            )}

            {(gatingStep === "extension" || gatingStep === "pago_parcial") && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem", textAlign: "left" }}>
                <span className={styles.gatingTitle} style={{ textAlign: "center", marginBottom: "0.25rem", fontWeight: "500" }}>
                  {gatingStep === "extension" ? "Extensión de Proyecto" : "Pago Completo o Cierre de Proyecto"}
                </span>

                {/* 1. Selección de Proyecto Previo */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Proyecto Previo *</label>
                  <div className={styles.autocompleteWrapper}>
                    <input
                      type="text"
                      placeholder="Buscar por nombre de proyecto, cliente o código..."
                      className={styles.input}
                      value={gatingProjSearchQuery}
                      onChange={(e) => {
                        setGatingProjSearchQuery(e.target.value);
                        setSelectedProject(null);
                        setSelectedClient("");
                        setGatingSearchQuery("");
                        setShowGatingProjSuggestions(true);
                      }}
                      onFocus={() => setShowGatingProjSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowGatingProjSuggestions(false), 200)}
                      disabled={submitting}
                    />
                    {showGatingProjSuggestions && (
                      <div className={styles.autocompleteResults}>
                        {filteredProjectsGating.length > 0 ? (
                          filteredProjectsGating.map(p => {
                            const clientLabel = p.clientes && p.clientes.nombre !== "Cliente Trello Sin Clasificar"
                              ? p.clientes.nombre
                              : "Sin cliente clasificado";
                            const saleCodeLabel = p.ventas?.codigo_venta ? ` [${p.ventas.codigo_venta}]` : "";
                            return (
                              <div
                                key={p.id}
                                className={styles.autocompleteItem}
                                onClick={() => handleProjectSelect(p)}
                              >
                                <strong>{p.nombre}</strong>{saleCodeLabel} <span style={{ fontSize: "0.85rem", color: "#64748b" }}>- {clientLabel}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className={styles.autocompleteNoResults}>No se encontraron proyectos</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Información/Asignación de Cliente */}
                {selectedProject && (
                  (() => {
                    const client = selectedProject.clientes;
                    const isGenericClient = !client || client.nombre === "Cliente Trello Sin Clasificar";

                    if (!isGenericClient) {
                      return (
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Cliente asociado</label>
                          <input
                            type="text"
                            className={styles.input}
                            value={`${client.nombre} ${client.empresa ? `(${client.empresa})` : ""}`}
                            disabled
                          />
                        </div>
                      );
                    }

                    // No tiene cliente real -> Mostrar asignación
                    return (
                      <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#d97706", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          ⚠️ Este proyecto no tiene un cliente asignado
                        </span>
                        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>
                          Por favor, selecciona un cliente existente o registra uno nuevo para este proyecto.
                        </p>

                        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                          <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontWeight: 500, color: "#374151" }}>
                            <input
                              type="radio"
                              name="gatingClientType"
                              checked={!formData.cliente_nuevo}
                              onChange={() => {
                                setFormData(prev => ({ ...prev, cliente_nuevo: false, cliente_id: "" }));
                                setGatingSearchQuery("");
                                setSelectedClient("");
                              }}
                            />
                            Cliente Existente
                          </label>
                          <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontWeight: 500, color: "#374151" }}>
                            <input
                              type="radio"
                              name="gatingClientType"
                              checked={formData.cliente_nuevo}
                              onChange={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  cliente_nuevo: true,
                                  cliente_id: "",
                                  cliente_nombre: "",
                                  cliente_email: "",
                                  cliente_telefono: "",
                                  cliente_empresa: "",
                                  cliente_pais: ""
                                }));
                              }}
                            />
                            Cliente Nuevo
                          </label>
                        </div>

                        {!formData.cliente_nuevo ? (
                          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <label className={styles.label}>Seleccionar Cliente</label>
                            <div className={styles.autocompleteWrapper}>
                              <input
                                type="text"
                                placeholder="Buscar cliente..."
                                className={styles.input}
                                value={gatingSearchQuery}
                                onChange={(e) => {
                                  setGatingSearchQuery(e.target.value);
                                  setSelectedClient("");
                                  setFormData(prev => ({ ...prev, cliente_id: "" }));
                                  setShowGatingSuggestions(true);
                                }}
                                onFocus={() => setShowGatingSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowGatingSuggestions(false), 200)}
                              />
                              {showGatingSuggestions && (
                                <div className={styles.autocompleteResults}>
                                  {filteredClientsGating.length > 0 ? (
                                    filteredClientsGating.map(c => (
                                      <div
                                        key={c.id}
                                        className={styles.autocompleteItem}
                                        onClick={() => {
                                          setSelectedClient(c.id);
                                          setGatingSearchQuery(c.nombre);
                                          setFormData(prev => ({ ...prev, cliente_id: c.id, cliente_nombre: c.nombre }));
                                          setShowGatingSuggestions(false);
                                        }}
                                      >
                                        {c.nombre}
                                      </div>
                                    ))
                                  ) : (
                                    <div className={styles.autocompleteNoResults}>No se encontraron clientes</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                              <label className={styles.label}>Nombre del Cliente Nuevo *</label>
                              <input
                                type="text"
                                placeholder="Nombre completo"
                                className={styles.input}
                                value={formData.cliente_nombre}
                                onChange={(e) => setFormData(prev => ({ ...prev, cliente_nombre: e.target.value }))}
                              />
                            </div>
                             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                               <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                 <label className={styles.label}>Email **</label>
                                 <input
                                   type="email"
                                   placeholder="correo@ejemplo.com"
                                   className={styles.input}
                                   value={formData.cliente_email}
                                   onChange={(e) => setFormData(prev => ({ ...prev, cliente_email: e.target.value }))}
                                 />
                               </div>
                               <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                 <label className={styles.label}>Teléfono **</label>
                                 <input
                                   type="text"
                                   placeholder="Ej: +34..."
                                   className={styles.input}
                                   value={formData.cliente_telefono}
                                   onChange={(e) => setFormData(prev => ({ ...prev, cliente_telefono: e.target.value }))}
                                 />
                               </div>
                             </div>
                             <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem", marginBottom: "0.25rem", gridColumn: "span 2" }}>
                               ** Se requiere al menos un correo (email) o teléfono para GoHighLevel.
                             </span>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                <label className={styles.label}>Empresa</label>
                                <input
                                  type="text"
                                  placeholder="Nombre empresa"
                                  className={styles.input}
                                  value={formData.cliente_empresa}
                                  onChange={(e) => setFormData(prev => ({ ...prev, cliente_empresa: e.target.value }))}
                                />
                              </div>
                              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                <label className={styles.label}>País</label>
                                <select
                                  className={styles.select}
                                  value={formData.cliente_pais ? (isPredefinedCountry(formData.cliente_pais) ? formData.cliente_pais : "Otro") : (showCustomGating ? "Otro" : "")}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "Otro") {
                                      setShowCustomGating(true);
                                      setFormData(prev => ({ ...prev, cliente_pais: "" }));
                                    } else {
                                      setShowCustomGating(false);
                                      setFormData(prev => ({ ...prev, cliente_pais: val }));
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
                                {(showCustomGating || (formData.cliente_pais && !isPredefinedCountry(formData.cliente_pais))) ? (
                                  <input
                                    type="text"
                                    placeholder="Especifica el país"
                                    className={styles.input}
                                    style={{ marginTop: "0.5rem" }}
                                    value={formData.cliente_pais}
                                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_pais: e.target.value }))}
                                  />
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}

                {/* 3. Datos de pago parcial / cierre si corresponde */}
                {gatingStep === "pago_parcial" && selectedProject?.venta_id && (
                  <div className={styles.prefilledInfoBlock}>
                    <div className={styles.prefilledRow}>
                      <span className={styles.prefilledLabel}>Monto C/C Pagado:</span>
                      <span className={styles.prefilledValue}>${montoCCPagadoPrevio} USD</span>
                    </div>
                    <div className={styles.prefilledRow}>
                      <span className={styles.prefilledLabel}>Monto C/C Total:</span>
                      <span className={styles.prefilledValue}>${montoCCTotalPrevio} USD</span>
                    </div>
                    <div className={styles.formGroup} style={{ marginTop: "0.75rem" }}>
                      <label className={styles.label}>Monto C/C a ingresar en este pago</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ingresa el monto del pago"
                        className={styles.input}
                        value={formData.monto_pagado}
                        onChange={(e) => setFormData({ ...formData, monto_pagado: e.target.value, monto_total: (montoCCTotalPrevio).toString() })}
                      />
                    </div>
                  </div>
                )}

                <div className={styles.modalActions} style={{ marginTop: "0.5rem" }}>
                  <button className={styles.btnSecondary} onClick={() => setGatingStep("choose")}>
                    Atrás
                  </button>
                  <button className={styles.btnPrimary} onClick={handleConfirmGating}>
                    Confirmar e Ir al Formulario
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* FORMULARIO BASADO EN PASOS */
          <form onSubmit={handleNextStep} className={styles.form} style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: isAnyAutocompleteOpen ? "visible" : "hidden", gap: 0 }}>

            <div style={{ backgroundColor: "#f8fafc", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0" }}>
              <div className={styles.stepperHeader} style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>
                <div className={styles.stepItem}>
                  <div className={`${styles.stepCircle} ${step === 1 ? styles.stepCircleActive : styles.stepCircleCompleted}`}>
                    {step > 1 ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : "1"}
                  </div>
                  <span className={`${styles.stepLabel} ${step === 1 ? styles.stepLabelActive : ""}`}>Datos generales</span>
                </div>
                <div className={`${styles.stepDivider} ${step > 1 ? styles.stepDividerActive : ""}`} style={{ marginBottom: 0 }} />

                <div className={styles.stepItem}>
                  <div className={`${styles.stepCircle} ${step === 2 ? styles.stepCircleActive : step === 3 ? styles.stepCircleCompleted : ""}`}>
                    {step > 2 ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : "2"}
                  </div>
                  <span className={`${styles.stepLabel} ${step === 2 ? styles.stepLabelActive : ""}`}>Ajustes avanzados</span>
                </div>
                <div className={`${styles.stepDivider} ${step === 3 ? styles.stepDividerActive : ""}`} style={{ marginBottom: 0 }} />

                <div className={styles.stepItem}>
                  <div className={`${styles.stepCircle} ${step === 3 ? styles.stepCircleActive : ""}`}>3</div>
                  <span className={`${styles.stepLabel} ${step === 3 ? styles.stepLabelActive : ""}`}>Resumen de venta</span>
                </div>
              </div>
            </div>

            {}
            <div style={{ flexGrow: 1, overflowY: "auto", padding: "1.5rem 1.5rem 3.5rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }} className={styles.modalBodyScrollable}>

              {}
              {step === 1 && (
                <>
                  {isExtension && (
                    <div className={styles.switchesContainer}>
                      <span className={styles.label} style={{ color: "#1e3a8a", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                        PROYECTO EXISTENTE / CONTINUACIÓN: Los campos se han cargado bloqueados. Usa estos interruptores para habilitar edición:
                      </span>
                      <div className={styles.switchRow}>
                        <span className={styles.switchLabel}>¿Modificar datos del cliente?</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={modifyClientData}
                            onChange={(e) => setModifyClientData(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span className={styles.switchLabel}>¿Modificar datos del proyecto?</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={modifyProjectData}
                            onChange={(e) => setModifyProjectData(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span className={styles.switchLabel}>¿Modificar modalidad de pago?</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={modifyPaymentMode}
                            onChange={(e) => setModifyPaymentMode(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className={styles.sectionTitle}>Datos del Cliente</div>

                  {!isExtension && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>¿El cliente es nuevo o existente?</label>
                      <div className={styles.toggleTabs}>
                        <button
                          type="button"
                          className={`${styles.toggleTab} ${!formData.cliente_nuevo ? styles.toggleTabActive : ""}`}
                          onClick={() => {
                            setFormData({ ...formData, cliente_nuevo: false });
                            setActualizarCliente(editingSale ? true : false);
                          }}
                          disabled={editingSale ? false : (formData.es_continuacion || disableClientFields)}
                        >
                          Existente
                        </button>
                        <button
                          type="button"
                          className={`${styles.toggleTab} ${formData.cliente_nuevo ? styles.toggleTabActive : ""}`}
                          onClick={() => {
                            setFormData({ ...formData, cliente_nuevo: true, cliente_id: "" });
                            setActualizarCliente(false);
                          }}
                          disabled={editingSale ? false : (formData.es_continuacion || disableClientFields)}
                        >
                          Nuevo
                        </button>
                      </div>
                    </div>
                  )}

                  {!formData.cliente_nuevo ? (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Cliente</label>
                        <div className={styles.autocompleteWrapper}>
                          <input
                            type="text"
                            placeholder="Seleccionar cliente..."
                            className={styles.input}
                            value={mainSearchQuery}
                            onChange={(e) => {
                              setMainSearchQuery(e.target.value);
                              setFormData({ ...formData, cliente_id: "" });
                              setShowMainSuggestions(true);
                              setActualizarCliente(false);
                            }}
                            onFocus={() => setShowMainSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowMainSuggestions(false), 200)}
                            disabled={editingSale ? false : (formData.es_continuacion || disableClientFields || submitting)}
                          />
                          {showMainSuggestions && (
                            <div className={styles.autocompleteResults}>
                              {filteredClientsMain.length > 0 ? (
                                filteredClientsMain.map(c => (
                                  <div
                                    key={c.id}
                                    className={styles.autocompleteItem}
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        cliente_id: c.id,
                                        cliente_nombre: c.nombre || "",
                                        cliente_email: c.email || "",
                                        cliente_telefono: c.telefono || "",
                                        cliente_pais: c.pais || "",
                                        cliente_empresa: c.empresa || "",
                                        cliente_link_usuario: c.link_usuario_plataforma || ""
                                      }));
                                      setMainSearchQuery(c.nombre);
                                      setSelectedClient(c.id);
                                      setShowMainSuggestions(false);
                                    }}
                                  >
                                    {c.nombre}
                                  </div>
                                ))
                              ) : (
                                <div className={styles.autocompleteNoResults}>No se encontraron clientes</div>
                              )}
                            </div>
                          )}
                        </div>
                        {formData.cliente_id && (
                          <div style={{ padding: "0.25rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {!isExtension && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem", padding: "0.25rem 0" }}>
                                <span style={{ fontSize: "0.85rem", fontWeight: "500", color: "#334155" }}>
                                  ¿Desea actualizar los datos de este cliente?
                                </span>
                                <label className={styles.switch}>
                                  <input
                                    type="checkbox"
                                    checked={actualizarCliente}
                                    onChange={(e) => setActualizarCliente(e.target.checked)}
                                    disabled={submitting}
                                  />
                                  <span className={styles.slider}></span>
                                </label>
                              </div>
                            )}

                             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem" }}>
                               <div className={styles.formGroup}>
                                 <label className={styles.label}>Teléfono **</label>
                                 <input
                                   type="text"
                                   placeholder="Ingresa el número de teléfono"
                                   className={styles.input}
                                   value={formData.cliente_telefono}
                                   onChange={(e) => setFormData({ ...formData, cliente_telefono: e.target.value })}
                                   disabled={isExtension ? !modifyClientData : !actualizarCliente}
                                 />
                               </div>
                               <div className={styles.formGroup}>
                                 <label className={styles.label}>Email **</label>
                                 <input
                                   type="email"
                                   placeholder="Ingresa el correo electrónico"
                                   className={styles.input}
                                   value={formData.cliente_email}
                                   onChange={(e) => setFormData({ ...formData, cliente_email: e.target.value })}
                                   disabled={isExtension ? !modifyClientData : !actualizarCliente}
                                 />
                               </div>
                             </div>
                             <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "-0.5rem", marginBottom: "0.5rem", gridColumn: "span 2" }}>
                               ** Se requiere al menos un correo o teléfono.
                             </span>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem" }}>
                              <div className={styles.formGroup}>
                                <label className={styles.label}>País</label>
                                <select
                                  className={styles.select}
                                  value={formData.cliente_pais ? (isPredefinedCountry(formData.cliente_pais) ? formData.cliente_pais : "Otro") : (showCustomEdit ? "Otro" : "")}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "Otro") {
                                      setShowCustomEdit(true);
                                      setFormData({ ...formData, cliente_pais: "" });
                                    } else {
                                      setShowCustomEdit(false);
                                      setFormData({ ...formData, cliente_pais: val });
                                    }
                                  }}
                                  disabled={isExtension ? !modifyClientData : !actualizarCliente}
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
                                {(showCustomEdit || (formData.cliente_pais && !isPredefinedCountry(formData.cliente_pais))) ? (
                                  <input
                                    type="text"
                                    placeholder="Especifica el país"
                                    className={styles.input}
                                    style={{ marginTop: "0.5rem" }}
                                    value={formData.cliente_pais}
                                    onChange={(e) => setFormData({ ...formData, cliente_pais: e.target.value })}
                                    disabled={isExtension ? !modifyClientData : !actualizarCliente}
                                  />
                                ) : null}
                              </div>
                              <div className={styles.formGroup}>
                                <label className={styles.label}>Empresa</label>
                                <input
                                  type="text"
                                  placeholder="Coloca el nombre de la empresa"
                                  className={styles.input}
                                  value={formData.cliente_empresa}
                                  onChange={(e) => setFormData({ ...formData, cliente_empresa: e.target.value })}
                                  disabled={isExtension ? !modifyClientData : !actualizarCliente}
                                />
                              </div>
                              <div className={styles.formGroup} style={{ gridColumn: "span 2" }}>
                                <label className={styles.label}>Link plataforma de origen</label>
                                <input
                                  type="text"
                                  placeholder="Pega el enlace del usuario en la plataforma"
                                  className={styles.input}
                                  value={formData.cliente_link_usuario}
                                  onChange={(e) => setFormData({ ...formData, cliente_link_usuario: e.target.value })}
                                  disabled={isExtension ? !modifyClientData : !actualizarCliente}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Nombre del cliente *</label>
                        <input
                          type="text"
                          placeholder="Coloca el nombre del cliente"
                          className={styles.input}
                          value={formData.cliente_nombre}
                          onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })}
                          disabled={disableClientFields}
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Teléfono **</label>
                        <input
                          type="text"
                          placeholder="Ingresa el número de teléfono"
                          className={styles.input}
                          value={formData.cliente_telefono}
                          onChange={(e) => setFormData({ ...formData, cliente_telefono: e.target.value })}
                          disabled={disableClientFields}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Email **</label>
                        <input
                          type="email"
                          placeholder="Ingresa el correo electrónico"
                          className={styles.input}
                          value={formData.cliente_email}
                          onChange={(e) => setFormData({ ...formData, cliente_email: e.target.value })}
                          disabled={disableClientFields}
                        />
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "-0.5rem", marginBottom: "0.5rem", gridColumn: "span 2" }}>
                        ** Se requiere al menos un correo (email) o teléfono del cliente.
                      </span>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>País</label>
                        <select
                          className={styles.select}
                          value={formData.cliente_pais ? (isPredefinedCountry(formData.cliente_pais) ? formData.cliente_pais : "Otro") : (showCustomNew ? "Otro" : "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Otro") {
                              setShowCustomNew(true);
                              setFormData({ ...formData, cliente_pais: "" });
                            } else {
                              setShowCustomNew(false);
                              setFormData({ ...formData, cliente_pais: val });
                            }
                          }}
                          disabled={disableClientFields}
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
                        {(showCustomNew || (formData.cliente_pais && !isPredefinedCountry(formData.cliente_pais))) ? (
                          <input
                            type="text"
                            placeholder="Especifica el país"
                            className={styles.input}
                            style={{ marginTop: "0.5rem" }}
                            value={formData.cliente_pais}
                            onChange={(e) => setFormData({ ...formData, cliente_pais: e.target.value })}
                            disabled={disableClientFields}
                          />
                        ) : null}
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Empresa</label>
                        <input
                          type="text"
                          placeholder="Coloca el nombre de la empresa"
                          className={styles.input}
                          value={formData.cliente_empresa}
                          onChange={(e) => setFormData({ ...formData, cliente_empresa: e.target.value })}
                          disabled={disableClientFields}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Link plataforma de origen</label>
                        <input
                          type="text"
                          placeholder="Pega el enlace del usuario en la plataforma"
                          className={styles.input}
                          value={formData.cliente_link_usuario}
                          onChange={(e) => setFormData({ ...formData, cliente_link_usuario: e.target.value })}
                          disabled={disableClientFields}
                        />
                      </div>
                    </div>
                  )}

                  {isExtension && (
                    <div style={{ paddingTop: "0.5rem", marginBottom: "1rem" }}>
                      {hasSetterOriginal ? (
                        <div className={styles.formGroup} style={{ gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.85rem", color: "#475569", fontWeight: 500 }}>
                            Este cliente tiene un setter asignado: <span style={{ color: "#0052cc", fontWeight: 600 }}>{origSetterObj?.nombre || "Cargando..."}</span>
                          </span>

                          <label className={styles.checkboxLabel} style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={agregarSetterAdicional}
                              onChange={(e) => {
                                setAgregarSetterAdicional(e.target.checked);
                                if (!e.target.checked) setSetterAdicionalId("");
                              }}
                              disabled={disableClientFields}
                            />
                            <span>Este cliente tiene un setter, ¿quieres agregar un nuevo setter adicional?</span>
                          </label>

                          {agregarSetterAdicional && (
                            <div className={styles.formGroup} style={{ marginTop: "0.5rem" }}>
                              <label className={styles.label}>Selecciona el nuevo setter adicional *</label>
                              <select
                                className={styles.select}
                                value={setterAdicionalId}
                                onChange={(e) => setSetterAdicionalId(e.target.value)}
                                disabled={disableClientFields}
                                required
                              >
                                <option value="">{loadingData && setters.length === 0 ? "Cargando lista de setters..." : "Seleccionar Setter"}</option>
                                {setters.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={styles.formGroup}>
                          <label className={styles.label}>¿Quién oferta? (Setter) *</label>
                          <select
                            className={styles.select}
                            value={formData.setter_principal_id}
                            onChange={(e) => setFormData({ ...formData, setter_principal_id: e.target.value })}
                            disabled={disableClientFields}
                            required
                          >
                            <option value="">{loadingData && setters.length === 0 ? "Cargando lista de setters..." : "Seleccionar Setter"}</option>
                            {setters.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.sectionTitle}>Datos del Proyecto</div>

                  {/* Manual / Servicio Selectors */}
                  <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
                    <label className={styles.label}>Rama de Servicio</label>
                    <select
                      className={styles.select}
                      value={formData.manual_rama || ""}
                      onChange={(e) => {
                        const rama = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          manual_rama: rama,
                          manual_categoria: "",
                          manual_servicio: "",
                          manual_enlace: ""
                        }));
                      }}
                      style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                    >
                      <option value="">Selecciona una rama</option>
                      {manuals && Object.keys(manuals).map(rama => (
                        <option key={rama} value={rama} style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>{rama}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                    <label className={styles.label}>Servicio</label>
                    <select
                      className={styles.select}
                      value={formData.manual_servicio ? (
                        formData.manual_rama && manuals && manuals[formData.manual_rama]
                          ? manuals[formData.manual_rama].find((s: any) => s.item === formData.manual_servicio)?.id?.toString() || ""
                          : ""
                      ) : ""}
                      onChange={(e) => {
                        const srvId = e.target.value;
                        const ramaList = formData.manual_rama && manuals ? manuals[formData.manual_rama] || [] : [];
                        const srv = ramaList.find((s: any) => s.id.toString() === srvId);
                        if (srv) {
                          handleAddServiceToPackage(srv);
                        }
                      }}
                      disabled={!formData.manual_rama}
                      style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                    >
                      <option value="">Selecciona un servicio</option>
                      {formData.manual_rama && manuals && manuals[formData.manual_rama] &&
                        manuals[formData.manual_rama]
                          .filter((m: any) => m.activo !== false)
                          .map((srv: any) => (
                            <option key={srv.id} value={srv.id.toString()} style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>{srv.item}</option>
                          ))
                      }
                    </select>
                  </div>

                  {/* Lista de Servicios de la Venta */}
                  {formData.manuales_servicios && formData.manuales_servicios.length > 0 && (
                    <div 
                      style={{ 
                        marginBottom: "1.25rem", 
                        backgroundColor: "#f8fafc", 
                        border: "1px solid #e2e8f0", 
                        borderLeft: "4px solid #3b82f6",
                        borderRadius: "10px", 
                        padding: "1rem",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                            Servicios de la Venta
                          </span>
                          <span style={{ backgroundColor: "#3b82f6", color: "#ffffff", borderRadius: "12px", padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
                            {formData.manuales_servicios.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              manual_rama: "",
                              manual_categoria: "",
                              manual_servicio: "",
                              manual_enlace: ""
                            }));
                          }}
                          style={{
                            backgroundColor: "#ffffff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            borderRadius: "6px",
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.775rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                          }}
                        >
                          <span>+ Añadir otro servicio</span>
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {formData.manuales_servicios.map((srv, idx) => (
                          <div 
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              padding: "0.65rem 0.9rem",
                              gap: "0.75rem"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>
                                {srv.servicio}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                <span style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "0.12rem 0.45rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 500 }}>
                                  {srv.rama}
                                </span>
                                <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>•</span>
                                <span style={{ backgroundColor: "#f1f5f9", color: "#475569", padding: "0.12rem 0.45rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 500 }}>
                                  {srv.categoria}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                              {srv.enlace && (
                                <a
                                  href={srv.enlace}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.3rem",
                                    backgroundColor: "#eff6ff",
                                    color: "#2563eb",
                                    border: "1px solid #bfdbfe",
                                    borderRadius: "6px",
                                    padding: "0.35rem 0.65rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    textDecoration: "none"
                                  }}
                                >
                                  <span>Enlace de manual</span>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                  </svg>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveServiceFromPackage(idx)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "#fef2f2",
                                  color: "#ef4444",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  padding: "0.35rem 0.55rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                                title="Quitar servicio de la venta"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingSale && (
                    <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                      <label className={styles.label}>Proyecto vinculado</label>
                      <input
                        type="text"
                        list="proyectos-vinculados-list"
                        placeholder="Escribe o selecciona un proyecto para vincular..."
                        className={styles.input}
                        value={gatingProjSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGatingProjSearchQuery(val);
                          const match = allProjects.find(p => 
                            p.nombre === val || 
                            p.nombre.toLowerCase() === val.toLowerCase() ||
                            `${p.nombre} [${p.ventas?.codigo_venta || ''}]` === val
                          );
                          if (match) {
                            const priorSaleId = match.venta_id || match.ventas?.id || match.id;
                            setFormData(prev => ({
                              ...prev,
                              proyecto_previo_id: priorSaleId,
                              proyecto_nombre: match.nombre,
                              cliente_id: match.cliente_id || prev.cliente_id,
                              cliente_nombre: match.clientes?.nombre || prev.cliente_nombre,
                              cliente_telefono: match.clientes?.telefono || prev.cliente_telefono,
                              cliente_email: match.clientes?.email || prev.cliente_email,
                              cliente_pais: match.clientes?.pais || prev.cliente_pais,
                              cliente_empresa: match.clientes?.empresa || prev.cliente_empresa,
                              cliente_link_usuario: match.clientes?.link_usuario_plataforma || prev.cliente_link_usuario
                            }));
                            if (match.clientes?.nombre) setMainSearchQuery(match.clientes.nombre);
                          } else {
                            setFormData(prev => ({ ...prev, proyecto_nombre: val }));
                          }
                        }}
                        onFocus={(e) => {
                          try { e.target.select(); } catch (err) {}
                        }}
                        disabled={submitting}
                      />
                      <datalist id="proyectos-vinculados-list">
                        {allProjects.map(p => {
                          const clientText = p.clientes?.nombre ? ` - ${p.clientes.nombre}` : "";
                          const codeText = p.ventas?.codigo_venta ? ` [${p.ventas.codigo_venta}]` : "";
                          return (
                            <option key={p.id} value={p.nombre}>
                              {`${p.nombre}${codeText}${clientText}`}
                            </option>
                          );
                        })}
                      </datalist>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Nombre del proyecto *</label>
                      <input
                        type="text"
                        placeholder="Escribe el nombre del proyecto"
                        className={styles.input}
                        value={formData.proyecto_nombre}
                        onChange={(e) => setFormData({ ...formData, proyecto_nombre: e.target.value })}
                        disabled={editingSale ? false : disableProjectFields}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Link del proyecto</label>
                      <input
                        type="text"
                        placeholder="Pega el enlace del proyecto"
                        className={styles.input}
                        value={formData.proyecto_link}
                        onChange={(e) => setFormData({ ...formData, proyecto_link: e.target.value })}
                        disabled={disableProjectFields}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Brief (URL)</label>
                      <input
                        type="text"
                        placeholder="Pega el enlace del brief en Dropbox"
                        className={styles.input}
                        value={formData.proyecto_brief}
                        onChange={(e) => setFormData({ ...formData, proyecto_brief: e.target.value })}
                        disabled={disableProjectFields}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Deadline (Día/Mes/Año)</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        onClick={(e) => {
                          try {
                            (e.target as any).showPicker();
                          } catch (err) {}
                        }}
                        disabled={disableProjectFields}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Descripción</label>
                    <textarea
                      rows={2}
                      placeholder="Resumen breve del alcance y objetivos del proyecto..."
                      className={styles.input}
                      value={formData.descripcion_operativa}
                      onChange={(e) => setFormData({ ...formData, descripcion_operativa: e.target.value })}
                      disabled={disableProjectFields}
                    />
                  </div>

                  {!isExtension && (
                    <div style={{ paddingTop: "0.5rem" }}>
                      {hasSetterOriginal ? (
                        <div className={styles.formGroup} style={{ gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.85rem", color: "#475569", fontWeight: 500 }}>
                            Este cliente tiene un setter asignado: <span style={{ color: "#0052cc", fontWeight: 600 }}>{origSetterObj?.nombre || "Cargando..."}</span>
                          </span>

                          <label className={styles.checkboxLabel} style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={agregarSetterAdicional}
                              onChange={(e) => {
                                setAgregarSetterAdicional(e.target.checked);
                                if (!e.target.checked) setSetterAdicionalId("");
                              }}
                              disabled={disableClientFields}
                            />
                            <span>Este cliente tiene un setter, ¿quieres agregar un nuevo setter adicional?</span>
                          </label>

                          {agregarSetterAdicional && (
                            <div className={styles.formGroup} style={{ marginTop: "0.5rem" }}>
                              <label className={styles.label}>Selecciona el nuevo setter adicional *</label>
                              <select
                                className={styles.select}
                                value={setterAdicionalId}
                                onChange={(e) => setSetterAdicionalId(e.target.value)}
                                disabled={disableClientFields}
                                required
                              >
                                <option value="">{loadingData && setters.length === 0 ? "Cargando lista de setters..." : "Seleccionar Setter"}</option>
                                {setters.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={styles.formGroup}>
                          <label className={styles.label}>¿Quién oferta? (Setter) *</label>
                          <select
                            className={styles.select}
                            value={formData.setter_principal_id}
                            onChange={(e) => setFormData({ ...formData, setter_principal_id: e.target.value })}
                            disabled={disableClientFields}
                            required
                          >
                            <option value="">{loadingData && setters.length === 0 ? "Cargando lista de setters..." : "Seleccionar Setter"}</option>
                            {setters.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {}
                  <div className={styles.sectionTitle}>Modalidad de Pago</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Plataforma</label>
                      <select
                        className={styles.select}
                        value={formData.plataforma}
                        onChange={(e) => setFormData({ ...formData, plataforma: e.target.value })}
                        disabled={disablePaymentFields}
                      >
                        <option value="Workana">Workana</option>
                        <option value="Freelancer">Freelancer</option>
                        <option value="Freelancer con Reclutador">Freelancer con Reclutador</option>
                        <option value="Shopify">Shopify</option>
                        <option value="Paypal">Paypal</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Binance">Binance</option>
                        <option value="Zelle">Zelle</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Condiciones de pago</label>
                      <select
                        className={styles.select}
                        value={formData.tipo_proyecto}
                        onChange={(e) => setFormData({ ...formData, tipo_proyecto: e.target.value })}
                        disabled={disablePaymentFields}
                      >
                        <option value="Precio Fijo">Precio Fijo</option>
                        <option value="Por Hora">Precio por hora</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Moneda</label>
                      <select
                        className={styles.select}
                        value={formData.moneda}
                        onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                        disabled={disablePaymentFields}
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="VES">VES</option>
                        <option value="COP">COP</option>
                        <option value="Otra">Otra</option>
                      </select>
                    </div>
                    {formData.moneda === "Otra" && (
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Especificar moneda *</label>
                        <input
                          type="text"
                          placeholder="Ingresa las siglas de la divisa"
                          className={styles.input}
                          value={formData.moneda_otra}
                          onChange={(e) => setFormData({ ...formData, moneda_otra: e.target.value })}
                          disabled={disablePaymentFields}
                          required
                        />
                      </div>
                    )}
                  </div>

                  {formData.moneda !== "USD" && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Aclaración o conversión manual a USD</label>
                      <input
                        type="text"
                        placeholder="Aclara la equivalencia o conversión de la divisa"
                        className={styles.input}
                        value={formData.monto_explicacion}
                        onChange={(e) => setFormData({ ...formData, monto_explicacion: e.target.value })}
                        disabled={disablePaymentFields}
                      />
                    </div>
                  )}

                  {formData.tipo_proyecto === "Precio Fijo" && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>¿Es un pago parcial?</label>
                        <div className={styles.toggleTabs}>
                          <button
                            type="button"
                            className={`${styles.toggleTab} ${isPagoParcial ? styles.toggleTabActive : ""}`}
                            onClick={() => setIsPagoParcial(true)}
                            disabled={disablePaymentFields}
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            className={`${styles.toggleTab} ${!isPagoParcial ? styles.toggleTabActive : ""}`}
                            onClick={() => setIsPagoParcial(false)}
                            disabled={disablePaymentFields}
                          >
                            No
                          </button>
                        </div>
                      </div>

                      {isPagoParcial ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Monto total del proyecto *</label>
                            <input
                              type="text"
                              placeholder="Ingresa el monto total"
                              className={styles.input}
                              value={formData.monto_total}
                              onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                              disabled={disablePaymentFields}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Monto parcial (Abono) *</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ingresa el abono parcial"
                              className={styles.input}
                              value={formData.monto_pagado}
                              onChange={(e) => setFormData({ ...formData, monto_pagado: e.target.value })}
                              disabled={disablePaymentFields}
                              required
                            />
                          </div>
                        </div>
                      ) : (
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Monto total del proyecto *</label>
                          <input
                            type="text"
                            placeholder="Ingresa el monto total"
                            className={styles.input}
                            value={formData.monto_total}
                            onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                            disabled={disablePaymentFields}
                            required
                          />
                        </div>
                      )}
                    </>
                  )}

                  {formData.tipo_proyecto === "Por Hora" && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Monto por hora *</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ingresa el monto por hora"
                            className={styles.input}
                            value={montoPorHora}
                            onChange={(e) => setMontoPorHora(e.target.value)}
                            disabled={formData.es_continuacion || disablePaymentFields}
                            required
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Cantidad de horas{formData.es_continuacion ? " *" : ""}</label>
                          <input
                            type="number"
                            placeholder="Ingresa la cantidad de horas"
                            className={styles.input}
                            value={cantidadHoras}
                            onChange={(e) => setCantidadHoras(e.target.value)}
                            disabled={disablePaymentFields}
                            required={formData.es_continuacion}
                          />
                        </div>
                      </div>

                      {montoPorHora && cantidadHoras && (
                        <div style={{ fontSize: "0.85rem", fontWeight: "500", color: "#475569", backgroundColor: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          Monto total calculado para la transacción: ${formData.monto_total} USD
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div className={styles.sectionTitle}>Ajustes de Oferta y Cierre</div>

                  {}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>¿Es un proyecto urgente?</label>
                    <div className={styles.toggleTabs}>
                      <button
                        type="button"
                        className={`${styles.toggleTab} ${formData.urgente ? styles.toggleTabActive : ""}`}
                        onClick={() => setFormData({ ...formData, urgente: true })}
                        disabled={disableProjectFields}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleTab} ${!formData.urgente ? styles.toggleTabActive : ""}`}
                        onClick={() => setFormData({ ...formData, urgente: false, motivo_urgencia: "" })}
                        disabled={disableProjectFields}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {formData.urgente && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Motivo de urgencia *</label>
                      <input
                        type="text"
                        placeholder="Escribe la razón de la urgencia"
                        className={styles.input}
                        value={formData.motivo_urgencia}
                        onChange={(e) => setFormData({ ...formData, motivo_urgencia: e.target.value })}
                        disabled={disableProjectFields}
                        required
                      />
                    </div>
                  )}



                  <div className={styles.formGroup}>
                    <label className={styles.label}>Notas internas</label>
                    <textarea
                      rows={3}
                      placeholder="Información adicional útil para producción..."
                      className={styles.input}
                      value={formData.notas_internas}
                      onChange={(e) => setFormData({ ...formData, notas_internas: e.target.value })}
                    />
                  </div>

                  {}
                  <div className={styles.formGroup} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                    <label className={styles.label} style={{ fontSize: "0.85rem", color: "#334155" }}>
                      ¿Quiénes participaron en el proceso de cierre? *
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                      {closingCandidates.map(c => {
                        const isSelected = closingParticipants.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                setClosingParticipants(closingParticipants.filter(id => id !== c.id));
                              } else {
                                setClosingParticipants([...closingParticipants, c.id]);
                              }
                            }}
                          >
                            <span>{c.nombre}</span>
                            {isSelected && <span style={{ marginLeft: "0.35rem", fontSize: "0.8rem" }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <span className={styles.gatingTitle} style={{ alignSelf: "center", marginBottom: "0.25rem", fontWeight: "500" }}>Resumen de Registro de Venta</span>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", textAlign: "center", marginBottom: "1rem" }}>
                    Por favor, confirma que toda la información ingresada es correcta antes de proceder a la firma digital por PIN.
                  </p>

                  <div className={styles.summarySection}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.25rem" }}>DATOS DEL CLIENTE</span>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Tipo de Cliente:</span>
                      <span className={styles.summaryValue}>{formData.cliente_nuevo ? "Nuevo" : "Existente"}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Nombre:</span>
                      <span className={styles.summaryValue}>
                        {formData.cliente_nuevo ? formData.cliente_nombre : (clients.find(c => c.id === formData.cliente_id)?.nombre || "N/A")}
                      </span>
                    </div>
                    {(formData.cliente_nuevo || formData.cliente_id) && (
                      <>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Teléfono:</span>
                          <span className={styles.summaryValue}>
                            {formData.cliente_nuevo ? formData.cliente_telefono : (clients.find(c => c.id === formData.cliente_id)?.telefono || "N/A")}
                          </span>
                        </div>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Email:</span>
                          <span className={styles.summaryValue}>
                            {formData.cliente_nuevo ? formData.cliente_email : (clients.find(c => c.id === formData.cliente_id)?.email || "N/A")}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className={styles.summarySection}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.25rem" }}>DATOS DEL PROYECTO</span>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Nombre del Proyecto:</span>
                      <span className={styles.summaryValue}>{formData.proyecto_nombre}</span>
                    </div>
                    {formData.proyecto_link && (
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Enlace del Proyecto:</span>
                        <span className={styles.summaryValue}>{formData.proyecto_link}</span>
                      </div>
                    )}
                    {formData.proyecto_brief && (
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Brief (URL):</span>
                        <span className={styles.summaryValue}>{formData.proyecto_brief}</span>
                      </div>
                    )}
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Urgencia:</span>
                      <span className={styles.summaryValue}>
                        {formData.urgente ? `Sí (${formData.motivo_urgencia})` : "No"}
                      </span>
                    </div>
                    {formData.deadline && (
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Deadline:</span>
                        <span className={styles.summaryValue}>{formData.deadline}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.summarySection}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.25rem" }}>FINANCIERO Y PAGO</span>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Plataforma:</span>
                      <span className={styles.summaryValue}>{formData.plataforma}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Modalidad de Pago:</span>
                      <span className={styles.summaryValue}>{formData.tipo_proyecto === "Por Hora" ? "Precio por Hora" : "Precio Fijo"}</span>
                    </div>
                    {formData.tipo_proyecto === "Por Hora" ? (
                      <>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Monto por Hora:</span>
                          <span className={styles.summaryValue}>${montoPorHora} USD</span>
                        </div>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Cantidad de Horas:</span>
                          <span className={styles.summaryValue}>{cantidadHoras} hrs</span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>¿Pago Parcial?:</span>
                        <span className={styles.summaryValue}>{isPagoParcial ? "Sí" : "No"}</span>
                      </div>
                    )}
                    {isPagoParcial && formData.tipo_proyecto === "Precio Fijo" && (
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Monto Inicial (Abono):</span>
                        <span className={styles.summaryValue}>${formData.monto_pagado} {formData.moneda}</span>
                      </div>
                    )}
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel} style={{ fontSize: "0.95rem", color: "#0052cc" }}>Monto Total de Venta:</span>
                      <span className={styles.summaryValue} style={{ fontSize: "0.95rem", color: "#0052cc", fontWeight: "600" }}>
                        ${formData.monto_total} {formData.moneda}
                      </span>
                    </div>
                  </div>

                  <div className={styles.summarySection}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.25rem" }}>EQUIPO PARTICIPANTE</span>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>¿Quién oferta?:</span>
                      <span className={styles.summaryValue}>
                        {formData.cliente_nuevo || !hasSetterOriginal ? (
                          users.find(u => u.id === formData.setter_principal_id)?.nombre || "N/A"
                        ) : (
                          agregarSetterAdicional ? (
                            `${users.find(u => u.id === setterAdicionalId)?.nombre || ""} (Nuevo) y ${origSetterObj?.nombre || ""} (Original)`
                          ) : (
                            origSetterObj?.nombre || "N/A"
                          )
                        )}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Proceso de Cierre:</span>
                      <span className={styles.summaryValue}>
                        {closingParticipants.map(id => users.find(u => u.id === id)?.nombre).filter(Boolean).join(", ") || "Ninguno"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalActions} style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid #e2e8f0", marginTop: 0, backgroundColor: "#ffffff", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              {step > 1 && (
                <button type="button" className={styles.btnSecondary} onClick={() => setStep((step - 1) as any)} disabled={submitting}>
                  Atrás
                </button>
              )}
              {step < 3 ? (
                <button type="submit" className={styles.btnPrimary}>
                  Siguiente
                </button>
              ) : (
                <button type="button" className={styles.btnPrimary} onClick={handleOpenPinModal} disabled={submitting}>
                  Confirmar y Guardar
                </button>
              )}
            </div>

          </form>
        )}

      </div>

      {showRegenerateConfirm && (
        <div className={styles.modalOverlay} style={{ zIndex: 2000 }}>
          <div className={styles.modalContent} style={{ maxWidth: "460px", padding: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#d97706" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "600", color: "#1e293b" }}>
                  Cambio de Cliente o Proyecto Detectado
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
                Has modificado el <strong>Cliente</strong> o el <strong>Nombre del Proyecto</strong> asociado a esta venta. ¿Deseas regenerar nuevamente todas las integraciones (Trello, Dropbox, GHL, Sheets, etc.)?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => proceedToPinModal(true)}
                  style={{ backgroundColor: "#0052cc", justifyContent: "center" }}
                >
                  Sí, regenerar integraciones
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => proceedToPinModal(false)}
                  style={{ justifyContent: "center" }}
                >
                  No, solo actualizar en BD
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowRegenerateConfirm(false)}
                  style={{ borderColor: "transparent", color: "#64748b", justifyContent: "center" }}
                >
                  Cancelar edición
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPinConfirm && (
        <div className={styles.modalOverlay} style={{ zIndex: 2000 }}>
          <div className={styles.modalContent} style={{ maxWidth: "380px", overflowY: "hidden" }}>
            <div className={styles.pinConfirmPrompt}>
              <span className={styles.pinConfirmTitle} style={{ fontWeight: "500" }}>Firma de Confirmación</span>
              <p className={styles.pinConfirmDesc}>
                Por seguridad, ingresa tu PIN de 6 dígitos para autorizar {editingSale ? "la modificación" : "el registro"} de esta venta.
              </p>

              <div className={styles.pinConfirmInputs}>
                {confirmPin.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`pin-input-${idx}`}
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    className={`${styles.pinConfirmInput} ${digit ? styles.pinConfirmInputFilled : ""} ${pinError ? styles.inputError : ""}`}
                    disabled={submitting}
                  />
                ))}
              </div>

              {pinError && (
                <div className={styles.alertError} style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem" }}>
                  <span>{pinError}</span>
                </div>
              )}

              <div className={styles.modalActions} style={{ width: "100%", justifyContent: "space-between", marginTop: "1rem" }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setShowPinConfirm(false);
                    setConfirmPin(Array(6).fill(""));
                    setPinError(null);
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleConfirmPinSubmit}
                  disabled={submitting || confirmPin.some(d => !d)}
                >
                  {submitting ? "Firmando..." : editingSale ? "Confirmar Edición" : "Confirmar Venta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitting && !showPinConfirm && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingOverlayContent}>
            <div className={styles.loadingSpinnerOverlay}></div>
            <span className={styles.loadingTextOverlay}>{editingSale ? "Actualizando venta..." : "Guardando venta..."}</span>
          </div>
        </div>
      )}
    </div>
  );
}
