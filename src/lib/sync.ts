import { supabase } from "@/lib/supabase";

async function fetchAllRows(tableName: string, selectFields: string) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .range(from, from + limit - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += limit;
      if (data.length < limit) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

export interface SyncResult {
  success: boolean;
  insertedCount: number;
  updatedCount: number;
  totalSynced: number;
  error?: string;
}

export async function syncTrelloProjects(): Promise<SyncResult> {
  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    let boardId = process.env.TRELLO_ID_BOARD;
    const listNuevos = process.env.TRELLO_ID_LIST_NUEVOS;
    const listRecurrentes = process.env.TRELLO_ID_LIST_RECURRENTES;

    if (!key || !token) {
      return {
        success: false,
        insertedCount: 0,
        updatedCount: 0,
        totalSynced: 0,
        error: "Las credenciales de Trello no están configuradas en las variables de entorno."
      };
    }

    // Auto-detect boardId from lists if missing
    if (!boardId || boardId === "67484dfb1f7d084e3110eb2b") {
      const targetList = listNuevos || listRecurrentes;
      if (targetList) {
        console.log(`[Sync Helper] Auto-detectando ID del tablero desde la lista: ${targetList}`);
        const listUrl = `https://api.trello.com/1/lists/${targetList}?key=${key}&token=${token}&fields=idBoard`;
        try {
          const listRes = await fetch(listUrl);
          if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.idBoard) {
              boardId = listData.idBoard;
              console.log(`[Sync Helper] Tablero detectado dinámicamente: ${boardId}`);
            }
          }
        } catch (err) {
          console.error("[Sync Helper] Error al intentar auto-detectar tablero:", err);
        }
      }
    }

    if (!boardId) {
      return {
        success: false,
        insertedCount: 0,
        updatedCount: 0,
        totalSynced: 0,
        error: "El ID del tablero no está configurado y no pudo ser auto-detectado."
      };
    }

    console.log(`[Sync Helper] Pre-cargando datos de Supabase para optimización...`);
    const [dbProjects, dbClients, dbSales] = await Promise.all([
      fetchAllRows("proyectos", "id, venta_id, carpeta_dropbox, link_trello, activo, trello_card_id, trello_list_id"),
      fetchAllRows("clientes", "id, nombre, setter_original_id"),
      fetchAllRows("ventas", "id, codigo_venta, cliente_id, carpeta_dropbox, proyecto_brief, deadline")
    ]);

    const projectsMapByCardId = new Map<string, any>();
    for (const p of dbProjects) {
      if (p.trello_card_id) projectsMapByCardId.set(p.trello_card_id, p);
    }

    const clientsMapByName = new Map<string, any>();
    const clientsMapById = new Map<string, any>();
    for (const c of dbClients) {
      if (c.nombre) clientsMapByName.set(c.nombre.toLowerCase().trim(), c);
      clientsMapById.set(c.id, c);
    }

    const salesMapByCode = new Map<string, any>();
    const salesMapById = new Map<string, any>();
    for (const s of dbSales) {
      if (s.codigo_venta) salesMapByCode.set(s.codigo_venta.toUpperCase().trim(), s);
      salesMapById.set(s.id, s);
    }

    console.log(`[Sync Helper] Obteniendo tarjetas (abiertas y archivadas) del tablero Trello ID: ${boardId}...`);

    // Added filter=all to retrieve archived/closed cards too
    const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}&filter=all&fields=id,name,desc,url,shortUrl,idList,closed,due`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Error al obtener tarjetas de Trello: ${res.statusText}`);
    }
    const allCards = await res.json();
    console.log(`[Sync Helper] Sincronizando ${allCards.length} tarjetas de Trello.`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const card of allCards) {
      let clientName = "";
      let projectName = card.name;

      let parts = card.name.split(" - ");
      if (parts.length < 2) {
        parts = card.name.split("   ");
      }
      if (parts.length < 2) {
        parts = card.name.split("  ");
      }

      if (parts.length >= 2) {
        clientName = parts[parts.length - 1].trim();
        projectName = parts.slice(0, -1).join(" - ").trim();
      }

      if (clientName) {
        clientName = clientName.replace(/^[-\s.¡!¿?]+|[-\s.¡!¿?]+$/g, "").trim();
      }

      if (projectName && projectName.length > 255) {
        projectName = projectName.substring(0, 252) + "...";
      }

      let brief = "";
      let dropboxUrl = "";
      if (card.desc) {
        const dbMatch = card.desc.match(/(https?:\/\/(?:www\.)?dropbox\.com\S+)/i);
        if (dbMatch) {
          dropboxUrl = dbMatch[1].replace(/[)\],.;]+$/, "");
        }
        
        const briefMatch = card.desc.match(/Brief:\s*([^\n\r]+)/i);
        if (briefMatch) {
          brief = briefMatch[1].trim();
        }

        const materialMatch = card.desc.match(/Material:\s*([^\n\r]+)/i);
        if (materialMatch && !dropboxUrl) {
          const matVal = materialMatch[1].trim();
          if (matVal.includes("dropbox.com")) {
            const dbUrlInMat = matVal.match(/(https?:\/\/(?:www\.)?dropbox\.com\S+)/i);
            if (dbUrlInMat) {
              dropboxUrl = dbUrlInMat[1].replace(/[)\],.;]+$/, "");
            }
          }
        }
      }

      if (dropboxUrl) {
        dropboxUrl = dropboxUrl.split(/[\[\]()]/)[0].trim();
        if (dropboxUrl.length > 255) {
          dropboxUrl = dropboxUrl.substring(0, 255);
        }
      }

      if (brief && brief.length > 255) {
        brief = brief.substring(0, 255);
      }

      const existingProj = projectsMapByCardId.get(card.id);
      const cardCreatedDate = new Date(parseInt(card.id.substring(0, 8), 16) * 1000).toISOString();

      if (existingProj) {
        // Only trigger DB update if something actually changed and is not already set in DB
        const needsListUpdate = existingProj.trello_list_id !== card.idList;
        const needsActivoUpdate = existingProj.activo !== !card.closed;
        const needsLinkUpdate = !existingProj.link_trello && (card.shortUrl || card.url);
        const needsDropboxUpdate = !existingProj.carpeta_dropbox && dropboxUrl;

        if (needsListUpdate || needsActivoUpdate || needsLinkUpdate || needsDropboxUpdate) {
          const updatePayload: any = {
            trello_list_id: card.idList,
            activo: !card.closed,
            actualizado_en: new Date().toISOString()
          };

          // Rule of gold: Supabase is source of truth. Do not overwrite if already set.
          if (needsLinkUpdate) {
            updatePayload.link_trello = card.shortUrl || card.url;
          }
          if (needsDropboxUpdate) {
            updatePayload.carpeta_dropbox = dropboxUrl;
          }

          const { error: updErr } = await supabase
            .from("proyectos")
            .update(updatePayload)
            .eq("id", existingProj.id);

          if (!updErr) {
            updatedCount++;
            // Update in-memory copy
            existingProj.trello_list_id = card.idList;
            existingProj.activo = !card.closed;
            if (needsLinkUpdate) existingProj.link_trello = card.shortUrl || card.url;
            if (needsDropboxUpdate) existingProj.carpeta_dropbox = dropboxUrl;
          } else {
            console.error(`[Sync Helper] Error actualizando proyecto ${projectName}: ${updErr.message} (Código: ${updErr.code}, Detalles: ${updErr.details || 'ninguno'})`);
          }
        }

        if (existingProj.venta_id) {
          const existingSale = salesMapById.get(existingProj.venta_id);
          if (existingSale) {
            const saleUpdate: any = {};
            const needsSaleDropbox = !existingSale.carpeta_dropbox && dropboxUrl;
            const needsSaleBrief = !existingSale.proyecto_brief && brief;
            const needsSaleDeadline = !existingSale.deadline && card.due;

            if (needsSaleDropbox) {
              saleUpdate.carpeta_dropbox = dropboxUrl;
            }
            if (needsSaleBrief) {
              saleUpdate.proyecto_brief = brief;
            }
            if (needsSaleDeadline) {
              saleUpdate.deadline = card.due.split("T")[0];
            }

            if (Object.keys(saleUpdate).length > 0) {
              const { error: saleUpdErr } = await supabase
                .from("ventas")
                .update(saleUpdate)
                .eq("id", existingProj.venta_id);
              if (!saleUpdErr) {
                // Update in-memory copy
                if (needsSaleDropbox) existingSale.carpeta_dropbox = dropboxUrl;
                if (needsSaleBrief) existingSale.proyecto_brief = brief;
                if (needsSaleDeadline) existingSale.deadline = card.due.split("T")[0];
              }
            }
          }
        }
      } else {
        const codeMatch = card.name.match(/(AZ-\d+)/i);
        const codigoVenta = codeMatch ? codeMatch[1].toUpperCase() : null;

        let ventaId = null;
        let clienteId = null;

        if (codigoVenta) {
          const matchedSale = salesMapByCode.get(codigoVenta);
          if (matchedSale) {
            ventaId = matchedSale.id;
            clienteId = matchedSale.cliente_id;
          }
        }

        if (!clienteId && clientName) {
          const matchedClient = clientsMapByName.get(clientName.toLowerCase());
          if (matchedClient) {
            clienteId = matchedClient.id;
          }
        }

        if (!clienteId) {
          const genericName = "Cliente Trello Sin Clasificar";
          let genClient = clientsMapByName.get(genericName.toLowerCase());

          if (genClient) {
            clienteId = genClient.id;
          } else {
            const { data: newGenClient, error: genClientInsErr } = await supabase
              .from("clientes")
              .insert([{ nombre: genericName }])
              .select()
              .single();

            if (genClientInsErr) {
              console.error(`[Sync Helper] Error insertando cliente genérico:`, genClientInsErr);
            } else if (newGenClient) {
              clienteId = newGenClient.id;
              // Add to maps
              clientsMapByName.set(genericName.toLowerCase(), newGenClient);
              clientsMapById.set(newGenClient.id, newGenClient);
            }
          }
        }

        if (clienteId) {
          const { data: newProj, error: insErr } = await supabase
            .from("proyectos")
            .insert([
              {
                nombre: projectName,
                cliente_id: clienteId,
                venta_id: ventaId,
                trello_card_id: card.id,
                trello_list_id: card.idList,
                link_trello: card.shortUrl || card.url,
                carpeta_dropbox: dropboxUrl || null,
                activo: !card.closed,
                creado_en: cardCreatedDate,
                actualizado_en: new Date().toISOString()
              },
            ])
            .select()
            .single();

          if (!insErr && newProj) {
            insertedCount++;
            projectsMapByCardId.set(card.id, newProj);

            if (ventaId) {
              const existingSale = salesMapById.get(ventaId);
              if (existingSale) {
                const saleUpdate: any = {};
                const needsSaleDropbox = !existingSale.carpeta_dropbox && dropboxUrl;
                const needsSaleBrief = !existingSale.proyecto_brief && brief;
                const needsSaleDeadline = !existingSale.deadline && card.due;

                if (needsSaleDropbox) {
                  saleUpdate.carpeta_dropbox = dropboxUrl;
                }
                if (needsSaleBrief) {
                  saleUpdate.proyecto_brief = brief;
                }
                if (needsSaleDeadline) {
                  saleUpdate.deadline = card.due.split("T")[0];
                }

                if (Object.keys(saleUpdate).length > 0) {
                  const { error: saleUpdErr } = await supabase
                    .from("ventas")
                    .update(saleUpdate)
                    .eq("id", ventaId);
                  if (!saleUpdErr) {
                    // Update in-memory copy
                    if (needsSaleDropbox) existingSale.carpeta_dropbox = dropboxUrl;
                    if (needsSaleBrief) existingSale.proyecto_brief = brief;
                    if (needsSaleDeadline) existingSale.deadline = card.due.split("T")[0];
                  }
                }
              }
            }
          } else if (insErr) {
            console.error(`[Sync Helper] Error insertando proyecto ${projectName}: ${insErr.message} (Código: ${insErr.code}, Detalles: ${insErr.details || 'ninguno'})`);
          }
        }
      }
    }

    return {
      success: true,
      insertedCount,
      updatedCount,
      totalSynced: allCards.length
    };
  } catch (error: any) {
    console.error("[Sync Helper] Trello Sync error:", error);
    return {
      success: false,
      insertedCount: 0,
      updatedCount: 0,
      totalSynced: 0,
      error: error.message || "Error al sincronizar proyectos con Trello."
    };
  }
}

export async function syncGhlClients(): Promise<SyncResult> {
  try {
    const token = process.env.GHL_ACCESS_TOKEN;
    const locationId = process.env.GHL_LOCATION_ID;

    if (!token || !locationId) {
      return {
        success: false,
        insertedCount: 0,
        updatedCount: 0,
        totalSynced: 0,
        error: "Las credenciales de GHL no están configuradas en las variables de entorno."
      };
    }

    console.log("[Sync Helper] Iniciando sincronización de contactos desde GHL...");
    let allContacts: any[] = [];
    let startAfter: number | null = null;
    let startAfterId: string | null = null;
    let pageCount = 0;

    do {
      let url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`;
      if (startAfter && startAfterId) {
        url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Version": "2021-07-28",
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error de API GHL: ${res.statusText} - ${errText}`);
      }

      const data = await res.json();
      const contacts = data.contacts || [];
      allContacts = [...allContacts, ...contacts];
      
      startAfter = data.meta?.startAfter || null;
      startAfterId = data.meta?.startAfterId || null;
      pageCount++;
    } while (startAfter && startAfterId && pageCount < 10);

    console.log(`[Sync Helper] Obtenidos ${allContacts.length} contactos de GHL.`);

    const dbClients = await fetchAllRows("clientes", "*");
    const dbClientsMapById = new Map<string, any>();
    const dbClientsMapByEmail = new Map<string, any>();
    const dbClientsMapByName = new Map<string, any>();

    if (dbClients) {
      for (const c of dbClients) {
        if (c.ghl_contact_id) dbClientsMapById.set(c.ghl_contact_id, c);
        if (c.email) dbClientsMapByEmail.set(c.email.toLowerCase().trim(), c);
        if (c.nombre) dbClientsMapByName.set(c.nombre.toLowerCase().trim(), c);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const ghlContact of allContacts) {
      const firstName = ghlContact.firstName || "";
      const lastName = ghlContact.lastName || "";
      const ghlName = (
        ghlContact.contactName ||
        ghlContact.name ||
        [firstName, lastName].filter(Boolean).join(" ") ||
        `GHL - ${ghlContact.id}`
      ).trim();

      const ghlEmail = ghlContact.email ? ghlContact.email.toLowerCase().trim() : "";
      const ghlPhone = ghlContact.phone || "";
      const ghlCompany = ghlContact.companyName || "";
      const ghlCountry = ghlContact.country || "";

      // Try to parse platform profile link from customFields
      let ghlPlatformLink = "";
      if (ghlContact.customFields && Array.isArray(ghlContact.customFields)) {
        for (const field of ghlContact.customFields) {
          const val = String(field.value || "");
          if (val.startsWith("http") && (
            val.includes("workana.com") || 
            val.includes("freelancer.com") || 
            val.includes("upwork.com") || 
            val.includes("fiverr.com")
          )) {
            ghlPlatformLink = val;
            break;
          }
        }
      }

      let matchedClient = dbClientsMapById.get(ghlContact.id);
      if (!matchedClient && ghlEmail) {
        matchedClient = dbClientsMapByEmail.get(ghlEmail);
      }
      if (!matchedClient) {
        matchedClient = dbClientsMapByName.get(ghlName.toLowerCase());
      }

      if (matchedClient) {
        const updates: any = {};
        
        // Rule of gold: Supabase is source of truth. Only write if empty in Supabase.
        if (!matchedClient.ghl_contact_id) updates.ghl_contact_id = ghlContact.id;
        if (!matchedClient.email && ghlEmail) updates.email = ghlEmail;
        if (!matchedClient.telefono && ghlPhone) updates.telefono = ghlPhone;
        if (!matchedClient.empresa && ghlCompany) updates.empresa = ghlCompany;
        if (!matchedClient.pais && ghlCountry) updates.pais = ghlCountry;
        if (!matchedClient.link_usuario_plataforma && ghlPlatformLink) updates.link_usuario_plataforma = ghlPlatformLink;

        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from("clientes")
            .update(updates)
            .eq("id", matchedClient.id);
          if (updErr) {
            console.error(`[Sync Helper] Error actualizando cliente ${matchedClient.nombre}: ${updErr.message} (Código: ${updErr.code}, Detalles: ${updErr.details || 'ninguno'})`);
          } else {
            updatedCount++;
          }
        }
      } else {
        const { error: insErr } = await supabase.from("clientes").insert([
          {
            nombre: ghlName,
            email: ghlEmail || null,
            telefono: ghlPhone || null,
            empresa: ghlCompany || null,
            pais: ghlCountry || null,
            link_usuario_plataforma: ghlPlatformLink || null,
            ghl_contact_id: ghlContact.id,
            creado_en: ghlContact.dateAdded || new Date().toISOString(),
          },
        ]);
        if (insErr) {
          console.error(`[Sync Helper] Error insertando cliente ${ghlName}: ${insErr.message} (Código: ${insErr.code}, Detalles: ${insErr.details || 'ninguno'})`);
        } else {
          insertedCount++;
          dbClientsMapByName.set(ghlName.toLowerCase(), { nombre: ghlName });
        }
      }
    }

    console.log(
      `[Sync Helper] Sincronización GHL completada. Insertados: ${insertedCount}, Actualizados: ${updatedCount}.`
    );

    return {
      success: true,
      insertedCount,
      updatedCount,
      totalSynced: allContacts.length
    };
  } catch (error: any) {
    console.error("[Sync Helper] GHL Sync error:", error);
    return {
      success: false,
      insertedCount: 0,
      updatedCount: 0,
      totalSynced: 0,
      error: error.message || "Error al sincronizar clientes con GHL."
    };
  }
}
