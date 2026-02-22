import { readdir } from "node:fs/promises";
import path from "node:path";
import { Container } from "@/components/atoms/Container";
import { GridResponsive } from "@/components/atoms/GridResponsive";
import { CategoryChips } from "@/components/molecules/CategoryChips";
import { HeroCarousel } from "@/components/organisms/HeroCarousel";
import { ListingCard } from "@/components/molecules/ListingCard";
import { LocationPermissionCard } from "@/components/organisms/LocationPermissionCard";
import { AnimatedCounter } from "@/components/atoms/AnimatedCounter";
import { Footer } from "@/components/organisms/Footer";
import { supabase } from "@/lib/supabase/client";
import { ObjetivoCard } from "@/components/molecules/ObjetivoCard";
import { ComoFuncionaCard } from "@/components/molecules/ComoFuncionaCard";

async function getBannerImages() {
  try {
    const bannersDir = path.join(process.cwd(), "public", "images", "banners");
    const files = await readdir(bannersDir);

    return files
      .filter((file) => /\.(png|jpe?g|webp|avif)$/i.test(file))
      .sort((first, second) => first.localeCompare(second))
      .map((file) => `/images/banners/${file}`);
  } catch {
    return [];
  }
}

async function getAppNumbers() {
  const numbers = {
    clientes: 0,
    profissionais: 0,
    estabelecimentos: 0,
    pedidos: 0,
    vouchers: 0,
  };

  try {
    // Count users by role
    const { count: clientCount } = await supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("role", "cliente");
    numbers.clientes = clientCount || 0;

    const { count: profCount } = await supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("role", "profissional");
    numbers.profissionais = profCount || 0;

    const { count: estabCount } = await supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("role", "estabelecimento");
    numbers.estabelecimentos = estabCount || 0;

    // Count pedidos
    const { count: pedidosCount } = await supabase.from("pedidos").select("*", { count: "exact", head: true });
    numbers.pedidos = pedidosCount || 0;

    // Count vouchers
    const { count: vouchersCount } = await supabase.from("voucher").select("*", { count: "exact", head: true });
    numbers.vouchers = vouchersCount || 0;
  } catch (error) {
    console.error("Erro ao buscar números do app:", error);
  }

  return numbers;
}

export default async function HomePage() {
  const bannerImages = await getBannerImages();
  const numbers = await getAppNumbers();

  return (
    <>
      <main className="space-y-4 py-2">
        <Container>
          <HeroCarousel bannerImages={bannerImages} />
        </Container>

        <Container>
          <section className="rounded-lg border bg-white p-4 shadow">
            <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-orange-600">
              Números do app
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <AnimatedCounter end={numbers.clientes} label="Clientes" color="text-blue-900" />
              <AnimatedCounter end={numbers.profissionais} label="Profissionais" color="text-green-700" />
              <AnimatedCounter end={numbers.estabelecimentos} label="Estabelecimentos" color="text-orange-600" />
              <AnimatedCounter end={numbers.pedidos} label="Pedidos" color="text-blue-900" />
              <AnimatedCounter end={numbers.vouchers} label="Vouchers" color="text-green-700" />
            </div>
          </section>
        </Container>

        <Container>
          <LocationPermissionCard />
        </Container>

        <Container>
          <section className="rounded-lg border bg-white p-4 shadow">
            <h2 className="whitespace-nowrap text-[clamp(1.05rem,4.2vw,1.85rem)] font-bold leading-tight text-blue-900">
              Marketplace local e prático
            </h2>
            <p className="mt-2 text-justify text-[clamp(0.84rem,2.7vw,1.08rem)] leading-relaxed text-graytext">
              O Encontro Pirituba é um ecossistema digital exclusivo projetado para fortalecer a economia regional, conectando moradores a uma rede selecionada de profissionais e estabelecimentos sediados estritamente na Subprefeitura de Pirituba. Nossa missão é transformar a dinâmica de consumo local através de uma plataforma de confiança, onde usuários acessam serviços qualificados e benefícios exclusivos via vouchers, enquanto profissionais e empresas locais utilizam ferramentas estratégicas de visibilidade e gestão de reputação para impulsionar seus negócios.
            </p>
            <div className="mt-3">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
                Categorias em destaque
              </h3>
              <CategoryChips />
            </div>
          </section>
        </Container>

        <Container>
          <h2 className="mb-2 text-xl font-bold text-green-700">Como funciona</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <ComoFuncionaCard
              title="Cliente comum"
              subtitle="Acesso livre e gratuito para descobrir serviços locais"
              image="/images/como-funciona/cliente-comum.jpg"
            />
            <ComoFuncionaCard
              title="Profissionais"
              subtitle="Plano por tokens para promover serviços e ampliar alcance"
              image="/images/como-funciona/profissionais.jpg"
            />
            <ComoFuncionaCard
              title="Estabelecimentos"
              subtitle="Tokens para campanhas, vouchers e mais visibilidade na região"
              image="/images/como-funciona/estabelecimentos.jpg"
            />
          </div>
        </Container>

        <Container>
          <h2 className="mb-2 text-xl font-bold text-orange-600">Vouchers e destaques locais</h2>
          <GridResponsive>
            {Array.from({ length: 3 }).map((_, idx) => (
              <ListingCard
                key={`voucher-${idx}`}
                title={`Oferta local ${idx + 1}`}
                subtitle="Disponível para Pirituba"
              />
            ))}
          </GridResponsive>
        </Container>

        <Container>
          <h2 className="mb-2 text-xl font-bold text-blue-900">Objetivos do app</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Fortalecer a economia local",
                description: "Fortalecer a economia de Pirituba e entorno",
                image: "/images/objetivos/objetivo-1.jpg",
              },
              {
                title: "Conectar demanda e oferta",
                description: "Facilitar o encontro entre demanda e oferta local",
                image: "/images/objetivos/objetivo-2.jpg",
              },
              {
                title: "Experiência digital moderna",
                description: "Oferecer experiência digital moderna para o bairro",
                image: "/images/objetivos/objetivo-3.jpg",
              },
            ].map((objetivo, idx) => (
              <ObjetivoCard
                key={`goal-${idx}`}
                title={objetivo.title}
                description={objetivo.description}
                image={objetivo.image}
              />
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
