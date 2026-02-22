const rows = [
  { id: "1", type: "Profissional", name: "João Silva", status: "pendente" },
  { id: "2", type: "Estabelecimento", name: "Barbearia Pirituba", status: "em análise" },
];

export function AdminReviewTable() {
  return (
    <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2">Tipo</th>
            <th className="py-2">Nome</th>
            <th className="py-2">Status</th>
            <th className="py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-2">{row.type}</td>
              <td className="py-2">{row.name}</td>
              <td className="py-2">{row.status}</td>
              <td className="py-2">
                <div className="flex gap-2">
                  <button className="rounded bg-blue-900 px-3 py-1 text-white">Aprovar</button>
                  <button className="rounded border px-3 py-1">Rejeitar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
