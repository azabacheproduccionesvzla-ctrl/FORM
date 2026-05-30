"use client";

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkActiveSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated) {
          router.push("/dashboard");
        }
      } catch (e) {
        console.error("Session check error:", e);
      }
    }
    checkActiveSession();
  }, [router]);

  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState<string[]>(Array(6).fill(""));
  const [userName, setUserName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setError(null);
  }, [username, pin]);

  useEffect(() => {
    if (step === 2 && pinRefs.current[0]) {
      setTimeout(() => {
        pinRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Por favor, ingrese su nombre de usuario.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error al verificar el usuario.");
      }

      setUserName(data.name);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (fullPin: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin: fullPin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "PIN inválido.");
      }

      setSuccessMessage(data.message);

      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);

    } catch (err: any) {
      setError(err.message || "Código de seguridad incorrecto.");
      setPin(Array(6).fill(""));
      pinRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index: number, val: string) => {
    const cleanValue = val.replace(/[^0-9]/g, "").slice(-1);

    const newPin = [...pin];
    newPin[index] = cleanValue;
    setPin(newPin);

    if (cleanValue !== "" && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }

    const currentFullPin = newPin.join("");
    if (currentFullPin.length === 6) {
      handlePinSubmit(currentFullPin);
    }
  };

  const handlePinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (pin[index] === "" && index > 0) {
        const newPin = [...pin];
        newPin[index - 1] = "";
        setPin(newPin);
        pinRefs.current[index - 1]?.focus();
      } else {
        const newPin = [...pin];
        newPin[index] = "";
        setPin(newPin);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      pinRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();

    if (/^\d{6}$/.test(pastedData)) {
      const newPin = pastedData.split("");
      setPin(newPin);
      handlePinSubmit(pastedData);
    }
  };

  const handleGoBack = () => {
    setStep(1);
    setPin(Array(6).fill(""));
    setError(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.logoSquare} style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Azabache producciones</span>
            <span className={styles.brandSubtext}>Workspace</span>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleUsernameSubmit}>
            <h2 className={styles.title}>Iniciar sesión</h2>
            <p className={styles.description}>
              Ingresa tu nombre de usuario para acceder al workspace de la agencia.
            </p>

            {error && (
              <div className={styles.errorAlert}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="username" className={styles.label}>
                Nombre de usuario
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  id="username"
                  placeholder="Tu usuario de acceso"
                  className={`${styles.input} ${error ? styles.inputError : ""}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <button type="submit" className={styles.button} disabled={loading}>
              <span>Continuar</span>
            </button>
          </form>
        ) : (
          <div>
            <h2 className={styles.title}>Ingresa tu PIN</h2>

            <div className={styles.userInfoBadge}>
              <div className={styles.userDot}></div>
              <span>{userName} ({username})</span>
            </div>

            <p className={styles.description}>
              Hemos validado tu usuario. Para completar el acceso, introduce tu PIN de seguridad de 6 dígitos.
            </p>

            {error && (
              <div className={styles.errorAlert}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className={`${styles.errorAlert} ${styles.successAlert}`} style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            <div className={styles.pinContainer}>
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    pinRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`${styles.pinInput} ${digit !== "" ? styles.pinInputFilled : ""} ${error ? styles.inputError : ""}`}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  onPaste={handlePinPaste}
                  disabled={loading || successMessage !== null}
                  maxLength={1}
                />
              ))}
            </div>

            <button
              className={styles.backButton}
              onClick={handleGoBack}
              disabled={loading || successMessage !== null}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Usar otra cuenta</span>
            </button>
          </div>
        )}
      </div>

      {loading && step === 2 && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingOverlayContent}>
            <div className={styles.loadingSpinnerOverlay}></div>
            <span className={styles.loadingTextOverlay}>Iniciando sesión...</span>
          </div>
        </div>
      )}
    </div>
  );
}
