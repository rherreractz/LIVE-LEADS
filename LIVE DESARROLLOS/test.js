// Script para extraer todas las etapas únicas de la API de Tresor
async function extraerEtapasUnicas() {
  const API_KEY = "rat_b5SFaaObq49RZo3U0b07lAueOIT5-AqCQpQJMBTjR3s"; // Tu key activa
  const pageSize = 100; // Máximo permitido por la API
  let page = 1;
  let totalPages = 1;
  const etapasUnicas = new Set();

  console.log("Extrayendo etapas de Tresor...");

  try {
    do {
      const url = `https://reporte-ads-tresor.vercel.app/api/public/contacts?page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
      });

      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

      const data = await res.json();
      totalPages = data.totalPages;

      // Extraer las etapas de esta página y agregarlas al Set (que elimina duplicados)
      data.data.forEach(lead => {
        if (lead.stage) {
          etapasUnicas.add(lead.stage);
        }
      });

      console.log(`Página ${page} de ${totalPages} procesada...`);
      page++;

    } while (page <= totalPages);

    console.log("\n✅ ETAPAS ÚNICAS ENCONTRADAS:");
    // Convertir el Set a Array, ordenarlo alfabéticamente e imprimirlo
    const listaEtapas = Array.from(etapasUnicas).sort();
    listaEtapas.forEach(etapa => console.log(`- ${etapa}`));

  } catch (error) {
    console.error("Error al extraer las etapas:", error);
  }
}

extraerEtapasUnicas();