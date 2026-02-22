const categories = ["Beleza", "Saúde", "Casa", "Educação", "Alimentação", "Pet","Carro","Eventos","Lazer","Esportes"];

export function CategoryChips() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {categories.map((category) => (
        <button
          key={category}
          className="rounded-full border border-blue-500 px-3 py-1 text-sm font-medium text-blue-900"
          style={{ WebkitTapHighlightColor: "transparent" }}
          type="button"
        >
          {category}
        </button>
      ))}
    </div>
  );
}
