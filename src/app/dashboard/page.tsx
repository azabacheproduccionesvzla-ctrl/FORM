"use client";

import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";

interface Activity {
  id: string;
  accion_descripcion: string;
  creado_en: string;
  usuarios_agencia: {
    nombre: string;
    username: string;
  } | null;
}

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch("/api/activities");
        const data = await res.json();
        if (data.success) {
          setActivities(data.activities || []);
        } else {
          setError(data.error || "Error al obtener actividades.");
        }
      } catch (err) {
        console.error("Error fetching activities:", err);
        setError("Error de red al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, []);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Ventas Totales</span>
          <span className={styles.metricValue}>0</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Proyectos Activos</span>
          <span className={styles.metricValue}>0</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#475569" }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Historial de Actividades</span>
        </div>
        <p className={styles.cardDescription}>
          Registro y auditoría en tiempo real de las acciones administrativas del sistema.
        </p>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            <div className={styles.loadingSpinner} style={{ borderTopColor: "#0052cc" }}></div>
          </div>
        ) : error ? (
          <div className={styles.alertError} style={{ margin: "1rem 0" }}>
            <span>{error}</span>
          </div>
        ) : activities.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateText}>No se han registrado actividades aún.</span>
          </div>
        ) : (
          <div className={styles.timeline}>
            {activities.map((activity, index) => {
              const creatorName = activity.usuarios_agencia?.nombre || "Sistema";
              const creatorUsername = activity.usuarios_agencia?.username ? `@${activity.usuarios_agencia.username}` : "";
              const formattedDate = new Date(activity.creado_en).toLocaleString("es-ES", {
                dateStyle: "medium",
                timeStyle: "short"
              });

              return (
                <div key={activity.id} className={styles.timelineItem}>
                  <div className={`${styles.timelineBadge} ${index === 0 ? styles.timelineBadgeActive : ""}`} />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                      <span className={styles.timelineUser}>
                        {creatorName} <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "0.25rem" }}>{creatorUsername}</span>
                      </span>
                      <span className={styles.timelineTime}>{formattedDate}</span>
                    </div>
                    <p className={styles.timelineDesc}>{activity.accion_descripcion}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
