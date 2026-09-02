import { unstable_cache } from 'next/cache';

export async function fetchTresorContacts() {
  // Asegúrate de poner tu API Key en el archivo .env como TRESOR_CONTACTS_API_KEY
  const API_KEY = process.env.TRESOR_CONTACTS_API_KEY || "rat_b5SFaaObq49RZo3U0b07lAueOIT5-AqCQpQJMBTjR3s";
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const allContacts = [];

  try {
    do {
      const url = `https://reporte-ads-tresor.vercel.app/api/public/contacts?page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (data.data) {
        allContacts.push(...data.data);
      }
      
      totalPages = data.totalPages || 1;
      page++;
    } while (page <= totalPages);

    return allContacts;
  } catch (error) {
    console.error("Error obteniendo contactos de Tresor:", error);
    return [];
  }
}

// Cacheado por 60 segundos (mismo patrón que Sheets)
export const getCachedTresorContacts = unstable_cache(
  async () => fetchTresorContacts(),
  ['tresor-contacts-cache'],
  { revalidate: 60 }
);

export async function getTresorStatusMap() {
  const contacts = await getCachedTresorContacts();
  const map = new Map<string, any>();
  
  contacts.forEach((c: any) => {
    if (c.email) {
      map.set(c.email.trim().toLowerCase(), c);
    }
  });
  
  return map;
}