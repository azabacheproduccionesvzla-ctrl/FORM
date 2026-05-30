interface TrelloCardData {
  projectName: string;
  clientName: string;
  desc: string;
  urgent: boolean;
  dueDateStr: string | null;
  isExistingProject: boolean;
  montoStr?: string;
  tipoVenta?: string;
}

export async function processTrelloCard(
  data: TrelloCardData
): Promise<{ success: boolean; url?: string; id?: string; error?: string }> {
  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const listNuevos = process.env.TRELLO_ID_LIST_NUEVOS || "5b6dce32c6725d037217ab3b";
    const listRecurrentes = process.env.TRELLO_ID_LIST_RECURRENTES || "5b6dce32c6725d037217ab3b";

    if (!key || !token) {
      console.warn("Trello credentials not fully configured in env variables.");
      return {
        success: false,
        error: "Trello credentials not configured in environment variables.",
      };
    }

    const cardTitle = `${data.projectName} - ${data.clientName}`;
    let targetListId = data.isExistingProject ? listRecurrentes : listNuevos;

    if (data.isExistingProject) {
      const searchUrl = new URL("https://api.trello.com/1/search");
      searchUrl.searchParams.append("key", key);
      searchUrl.searchParams.append("token", token);
      searchUrl.searchParams.append("query", `name:"${cardTitle}"`);
      searchUrl.searchParams.append("modelTypes", "cards");
      searchUrl.searchParams.append("card_fields", "id,url,idList");

      const searchRes = await fetch(searchUrl.toString(), { method: "GET" });
      const searchData = await searchRes.json();

      if (searchRes.ok && searchData.cards && searchData.cards.length > 0) {
        const card = searchData.cards[0];
        targetListId = card.idList || listRecurrentes;

        const updateUrl = new URL(`https://api.trello.com/1/cards/${card.id}`);
        updateUrl.searchParams.append("key", key);
        updateUrl.searchParams.append("token", token);
        updateUrl.searchParams.append("idList", targetListId);
        updateUrl.searchParams.append("pos", "top");
        if (data.dueDateStr) {
          updateUrl.searchParams.append("due", data.dueDateStr);
        }

        await fetch(updateUrl.toString(), { method: "PUT" });

        const commentUrl = new URL(`https://api.trello.com/1/cards/${card.id}/actions/comments`);
        commentUrl.searchParams.append("key", key);
        commentUrl.searchParams.append("token", token);
        commentUrl.searchParams.append("text", `Nueva venta en proyecto existente:\n\nTipo de venta: ${data.tipoVenta || "N/A"}\nMonto: ${data.montoStr || "N/A"}`);

        await fetch(commentUrl.toString(), { method: "POST" });

        return {
          success: true,
          url: card.url,
          id: card.id,
        };
      }
    }

    const createUrl = new URL("https://api.trello.com/1/cards");
    createUrl.searchParams.append("key", key);
    createUrl.searchParams.append("token", token);
    createUrl.searchParams.append("idList", targetListId);
    createUrl.searchParams.append("name", cardTitle);
    createUrl.searchParams.append("desc", data.desc);
    createUrl.searchParams.append("pos", "bottom");
    createUrl.searchParams.append("idMembers", "6234bce84174cf4ea0ee02fb,5728ceaca2d6d5913b8cb5cd,5ff29a0bd4a465505546a8b3,58e43e1d3360cf5e81ee5e0a");

    const labelId = data.urgent ? "68ac8a1c6b2b8bdfa33fce90" : "67c5eddd229eaba704057ca0";
    createUrl.searchParams.append("idLabels", labelId);

    if (data.dueDateStr) {
      createUrl.searchParams.append("due", data.dueDateStr);
    }

    const createRes = await fetch(createUrl.toString(), {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      throw new Error(`Trello card creation failed: ${JSON.stringify(createData)}`);
    }

    return {
      success: true,
      url: createData.shortUrl || createData.url,
      id: createData.id,
    };
  } catch (err: any) {
    console.error("Trello helper error:", err);
    return {
      success: false,
      error: err.message || "Unknown error creating/updating Trello card.",
    };
  }
}
