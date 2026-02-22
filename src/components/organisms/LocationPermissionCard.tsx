"use client";

import { useEffect, useState } from "react";

type PermissionState = "idle" | "requesting" | "granted" | "denied" | "error";
const LOCATION_PERMISSION_STORAGE_KEY = "encontro-pirituba:gps-permission-granted";

export function LocationPermissionCard() {
  const [open, setOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [message, setMessage] = useState(
    "Ative sua localização para mostrar ofertas, profissionais e estabelecimentos próximos de você em Pirituba e região.",
  );

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;

    const schedulePrompt = () => {
      timeoutId = window.setTimeout(() => {
        if (isMounted) {
          setOpen(true);
        }
      }, 900);
    };

    const initializePermissionState = async () => {
      const hasStoredPermission = window.localStorage.getItem(LOCATION_PERMISSION_STORAGE_KEY) === "true";

      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: "geolocation" });

          if (!isMounted) {
            return;
          }

          if (status.state === "granted") {
            window.localStorage.setItem(LOCATION_PERMISSION_STORAGE_KEY, "true");
            setPermissionState("granted");
            return;
          }
        } catch {
          if (hasStoredPermission) {
            setPermissionState("granted");
            return;
          }
        }
      } else if (hasStoredPermission) {
        setPermissionState("granted");
        return;
      }

      schedulePrompt();
    };

    void initializePermissionState();

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const requestLocationPermission = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPermissionState("error");
      setMessage("Seu navegador não suporta geolocalização.");
      return;
    }

    setPermissionState("requesting");

    navigator.geolocation.getCurrentPosition(
      () => {
        setPermissionState("granted");
        window.localStorage.setItem(LOCATION_PERMISSION_STORAGE_KEY, "true");
        setMessage("Localização autorizada! Vamos priorizar conteúdo próximo de você.");
        window.setTimeout(() => {
          setOpen(false);
        }, 1200);
      },
      () => {
        setPermissionState("denied");
        setMessage("Permissão negada. Você pode continuar navegando normalmente sem compartilhar localização.");
        setOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-md rounded-xl border border-blue-500/25 bg-white p-4 shadow-lg">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Permitir acesso à localização?</p>
          <p className="text-sm text-graytext">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded-lg border border-blue-500/40 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-50"
            onClick={() => setOpen(false)}
            type="button"
          >
            Agora não
          </button>
          <button
            className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={permissionState === "requesting" || permissionState === "granted"}
            onClick={requestLocationPermission}
            type="button"
          >
            {permissionState === "requesting"
              ? "Solicitando..."
              : permissionState === "granted"
                ? "GPS autorizado"
                : "Permitir"}
          </button>
        </div>
      </div>
    </div>
  );
}
