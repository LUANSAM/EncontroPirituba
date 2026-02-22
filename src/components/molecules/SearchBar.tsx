"use client";

import { useForm } from "react-hook-form";
import { Card } from "@/components/atoms/Card";

type SearchFormData = {
  term: string;
  location: string;
};

export function SearchBar() {
  const { register, handleSubmit } = useForm<SearchFormData>({
    defaultValues: {
      term: "",
      location: "Pirituba",
    },
  });

  const onSubmit = (data: SearchFormData) => {
    console.info("search", data);
  };

  return (
    <Card>
      <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={handleSubmit(onSubmit)}>
        <input
          {...register("term")}
          className="rounded-lg border px-3 py-2 md:col-span-2"
          placeholder="Serviço ou categoria"
        />
        <input {...register("location")} className="rounded-lg border px-3 py-2" placeholder="Localização" />
        <button className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-accent" type="submit">
          Buscar
        </button>
      </form>
    </Card>
  );
}
