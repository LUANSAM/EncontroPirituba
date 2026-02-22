"use client";

import { useForm } from "react-hook-form";

interface AuthFormData {
  email: string;
  password: string;
}

export function AuthForm() {
  const { register, handleSubmit } = useForm<AuthFormData>();

  const onSubmit = (data: AuthFormData) => {
    console.info("auth", data);
  };

  return (
    <form className="space-y-3 rounded-lg bg-white p-4 shadow" onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} className="w-full rounded-lg border px-3 py-2" placeholder="Email" />
      <input
        {...register("password")}
        className="w-full rounded-lg border px-3 py-2"
        placeholder="Senha"
        type="password"
      />
      <button className="w-full rounded-lg bg-blue-900 px-4 py-2 text-white" type="submit">
        Entrar
      </button>
    </form>
  );
}
