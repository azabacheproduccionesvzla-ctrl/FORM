"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";

interface UserSession {
  username: string;
  name: string;
  role: "admin" | "ventas" | "auditor";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserSession | null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Error verificando sesión:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    
    checkSession();
  }, [router]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        router.push("/");
        router.refresh();
      } else {
        setLogoutLoading(false);
      }
    } catch (error) {
      console.error("Error cerrando sesión:", error);
      setLogoutLoading(false);
    }
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <div className={styles.loadingSpinner} style={{ borderTopColor: "#0052cc", width: "40px", height: "40px", borderWidth: "3px" }}></div>
      </div>
    );
  }

  if (!user) return null;

  const isUserAdmin = user.role === "admin";

  return (
    <div className={styles.layoutContainer}>
      <header className={styles.mobileHeader}>
        <div className={styles.sidebarBrand} style={{ marginBottom: 0 }}>
          <div className={styles.logoSquare} style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName} style={{ fontSize: "0.85rem" }}>Azabache</span>
          </div>
        </div>
        <button 
          className={styles.hamburgerBtn} 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </header>

      {sidebarOpen && (
        <div 
          className={`${styles.sidebarOverlay} ${styles.sidebarOverlayVisible}`} 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <div className={styles.logoSquare} style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Azabache producciones</span>
            <span className={styles.brandSubtext}>Workspace</span>
          </div>
        </div>

        <nav className={styles.sidebarMenu}>
          <Link 
            href="/dashboard" 
            className={`${styles.menuItem} ${isActive("/dashboard") ? styles.menuItemActive : ""}`}
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Dashboard</span>
          </Link>

          <Link 
            href="/dashboard/ventas" 
            className={`${styles.menuItem} ${isActive("/dashboard/ventas") ? styles.menuItemActive : ""}`}
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Ventas</span>
          </Link>

          {isUserAdmin && (
            <Link 
              href="/dashboard/ajustes" 
              className={`${styles.menuItem} ${isActive("/dashboard/ajustes") ? styles.menuItemActive : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Ajustes</span>
            </Link>
          )}
        </nav>

        <div className={styles.logoutButton}>
          <button 
            className={styles.menuItem} 
            style={{ width: "100%", textAlign: "left", background: "none", border: "none" }}
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {children}
      </main>

      {logoutLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingOverlayContent}>
            <div className={styles.loadingSpinnerOverlay}></div>
            <span className={styles.loadingTextOverlay}>Cerrando sesión...</span>
          </div>
        </div>
      )}
    </div>
  );
}
