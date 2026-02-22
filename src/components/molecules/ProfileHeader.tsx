import { Card } from "@/components/atoms/Card";

interface ProfileHeaderProps {
  type: "professional" | "establishment";
}

const tabs = ["Sobre", "Serviços e Preços", "Vouchers", "Avaliações", "Fotos"];

export function ProfileHeader({ type }: ProfileHeaderProps) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="h-48 rounded-lg bg-blue-100" />
        <h1 className="text-2xl font-bold text-blue-900">
          {type === "professional" ? "Profissional" : "Estabelecimento"} Exemplo
        </h1>
        <p>⭐ 4.8 • Pirituba • Serviços locais</p>
        <div className="flex gap-2">
          <button className="rounded-lg bg-blue-900 px-4 py-2 text-white">Solicitar</button>
          <button className="rounded-lg bg-blue-500 px-4 py-2 text-white">Reservar voucher</button>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} className="rounded-lg border px-3 py-2 text-sm">
            {tab}
          </button>
        ))}
      </div>
      <Card>
        Área para chat/contato (liberado após reserva/validação).
      </Card>
    </div>
  );
}
