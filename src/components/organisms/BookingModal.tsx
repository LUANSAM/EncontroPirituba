"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
}

export function BookingModal({ open, onClose }: BookingModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow">
          <DialogTitle className="text-lg font-bold text-blue-900">Confirmar reserva</DialogTitle>
          <p className="mt-2">Ao confirmar, o booking será criado e o estoque decrementado.</p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg border px-4 py-2" onClick={onClose}>
              Cancelar
            </button>
            <button className="rounded-lg bg-blue-900 px-4 py-2 text-white">Confirmar</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
