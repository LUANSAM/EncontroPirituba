import { Card } from "@/components/atoms/Card";

export function VoucherCard() {
  return (
    <Card className="space-y-3">
      <h1 className="text-2xl font-bold text-blue-900">Voucher Especial</h1>
      <p>Descrição do voucher, validade e condições.</p>
      <p>Quantidade disponível: 20</p>
      <button className="rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white">Reservar</button>
    </Card>
  );
}
