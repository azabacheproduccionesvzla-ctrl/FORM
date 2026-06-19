interface TrelloCardData {
  projectName: string;
  clientName: string;
  desc: string;
  urgent: boolean;
  dueDateStr: string | null;
  isExistingProject: boolean;
  montoStr?: string;
  tipoVenta?: string;
  trelloMembers?: string[];
  plataforma?: string;
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

    const cleanedProjectName = data.projectName
      .replace(/^azabache\s+producciones\s*-\s*/i, "")
      .replace(/^azabache\s+producciones\s*/i, "")
      .trim();
    const cardTitle = `${cleanedProjectName} - ${data.clientName}`;
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
    const defaultMembers = data.trelloMembers && data.trelloMembers.length > 0
      ? data.trelloMembers.join(",")
      : "6234bce84174cf4ea0ee02fb,5728ceaca2d6d5913b8cb5cd,5ff29a0bd4a465505546a8b3,58e43e1d3360cf5e81ee5e0a";
    createUrl.searchParams.append("idMembers", defaultMembers);

    const labelIds: string[] = [];
    if (data.urgent) {
      labelIds.push("68ac8a1c6b2b8bdfa33fce90"); // Proyecto con urgencia (Red)
    }

    const platformClean = (data.plataforma || "").trim().toLowerCase();
    if (platformClean === "workana") {
      labelIds.push("682674016777bf325dde1043"); // W (Purple)
    } else if (platformClean.startsWith("freelancer")) {
      labelIds.push("6826740a96130023ca343375"); // F (Blue)
    } else if (["zelle", "binance", "efectivo", "paypal", "shopify"].includes(platformClean)) {
      labelIds.push("67c5eddd229eaba704057ca0"); // Whatsapp (Green)
    }

    if (labelIds.length > 0) {
      createUrl.searchParams.append("idLabels", labelIds.join(","));
    }

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

export async function updateTrelloCardName(
  cardId: string,
  newProjectName: string,
  newClientName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return {
        success: false,
        error: "Trello credentials not configured in environment variables.",
      };
    }

    const cleanedProjectName = newProjectName
      .replace(/^azabache\s+producciones\s*-\s*/i, "")
      .replace(/^azabache\s+producciones\s*/i, "")
      .trim();
    const newTitle = `${cleanedProjectName} - ${newClientName}`;
    const updateUrl = new URL(`https://api.trello.com/1/cards/${cardId}`);
    updateUrl.searchParams.append("key", key);
    updateUrl.searchParams.append("token", token);
    updateUrl.searchParams.append("name", newTitle);

    const res = await fetch(updateUrl.toString(), {
      method: "PUT",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(`Failed to update Trello card name: ${JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Trello card name update error:", err);
    return {
      success: false,
      error: err.message || "Unknown error updating Trello card name.",
    };
  }
}

export async function updateTrelloCardDesc(
  cardId: string,
  newDesc: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return {
        success: false,
        error: "Trello credentials not configured in environment variables.",
      };
    }

    const updateUrl = new URL(`https://api.trello.com/1/cards/${cardId}`);
    updateUrl.searchParams.append("key", key);
    updateUrl.searchParams.append("token", token);
    updateUrl.searchParams.append("desc", newDesc);

    const res = await fetch(updateUrl.toString(), {
      method: "PUT",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(`Failed to update Trello card description: ${JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Trello card description update error:", err);
    return {
      success: false,
      error: err.message || "Unknown error updating Trello card description.",
    };
  }
}

export async function updateTrelloCardFields(
  cardId: string,
  fields: { name?: string; desc?: string; idMembers?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return {
        success: false,
        error: "Trello credentials not configured in environment variables.",
      };
    }

    const updateUrl = new URL(`https://api.trello.com/1/cards/${cardId}`);
    updateUrl.searchParams.append("key", key);
    updateUrl.searchParams.append("token", token);
    if (fields.name !== undefined) updateUrl.searchParams.append("name", fields.name);
    if (fields.desc !== undefined) updateUrl.searchParams.append("desc", fields.desc);
    if (fields.idMembers !== undefined) updateUrl.searchParams.append("idMembers", fields.idMembers);

    const res = await fetch(updateUrl.toString(), {
      method: "PUT",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(`Failed to update Trello card fields: ${JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Trello card fields update error:", err);
    return {
      success: false,
      error: err.message || "Unknown error updating Trello card fields.",
    };
  }
}

export async function getTrelloBoardMembers(): Promise<{ id: string; fullName: string; username: string }[]> {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const listId = process.env.TRELLO_ID_LIST_NUEVOS || "5b6dce32c6725d037217ab3b";

  const staticFallback = [
    { id: "6234bce84174cf4ea0ee02fb", fullName: "Christopher Alvarez", username: "christopheralvarez" },
    { id: "5728ceaca2d6d5913b8cb5cd", fullName: "User 2", username: "user2" },
    { id: "5ff29a0bd4a465505546a8b3", fullName: "User 3", username: "user3" },
    { id: "58e43e1d3360cf5e81ee5e0a", fullName: "User 4", username: "user4" }
  ];

  if (!key || !token) {
    return staticFallback;
  }

  try {
    // 1. Get board ID from list ID
    const boardUrl = `https://api.trello.com/1/lists/${listId}/board?key=${key}&token=${token}`;
    const boardRes = await fetch(boardUrl);
    if (!boardRes.ok) throw new Error("Failed to fetch board from list");
    const boardData = await boardRes.json();
    const boardId = boardData.id;

    // 2. Get board members
    const membersUrl = `https://api.trello.com/1/boards/${boardId}/members?key=${key}&token=${token}`;
    const membersRes = await fetch(membersUrl);
    if (!membersRes.ok) throw new Error("Failed to fetch board members");
    const membersData = await membersRes.json();

    if (Array.isArray(membersData)) {
      return membersData.map((m: any) => ({
        id: m.id,
        fullName: m.fullName || m.username,
        username: m.username
      }));
    }
    return staticFallback;
  } catch (err) {
    console.error("Error fetching Trello board members:", err);
    return staticFallback;
  }
}

export async function addTrelloCardComment(
  cardId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return {
        success: false,
        error: "Trello credentials not configured in environment variables.",
      };
    }

    const commentUrl = new URL(`https://api.trello.com/1/cards/${cardId}/actions/comments`);
    commentUrl.searchParams.append("key", key);
    commentUrl.searchParams.append("token", token);
    commentUrl.searchParams.append("text", text);

    const res = await fetch(commentUrl.toString(), {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(`Failed to add comment: ${JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Trello add comment error:", err);
    return {
      success: false,
      error: err.message || "Unknown error adding Trello comment.",
    };
  }
}

