interface DropboxConfig {
  refreshToken: string;
  appKey: string;
  appSecret: string;
}

async function getAccessToken(config: DropboxConfig): Promise<string> {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", config.refreshToken);
  params.append("client_id", config.appKey);
  params.append("client_secret", config.appSecret);

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to refresh Dropbox access token: ${errorText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access_token found in Dropbox token refresh response.");
  }

  return data.access_token;
}

export async function createDropboxFolder(
  clientName: string,
  projectName: string
): Promise<{ success: boolean; path?: string; url?: string; error?: string }> {
  try {
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    const appKey = process.env.DROPBOX_APP_KEY;
    const appSecret = process.env.DROPBOX_APP_SECRET;

    if (!refreshToken || !appKey || !appSecret) {
      console.warn("Dropbox credentials not fully configured in env variables.");
      return {
        success: false,
        error: "Dropbox credentials not configured in environment variables.",
      };
    }

    const accessToken = await getAccessToken({ refreshToken, appKey, appSecret });

    const year = new Date().getFullYear();
    const cleanClientName = clientName.replace(/[\/\\:*?"<>|]/g, "_").trim();
    const cleanProjectNameRaw = projectName
      .replace(/^azabache\s+producciones\s*-\s*/i, "")
      .replace(/^azabache\s+producciones\s*/i, "")
      .trim();
    const cleanProjectName = cleanProjectNameRaw.replace(/[\/\\:*?"<>|]/g, "_").trim();
    
    const folderPath = `/ENTREGA/${year}/${cleanClientName} - ${cleanProjectName}`;

    const createRes = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: folderPath,
        autorename: false,
      }),
    });

    const createData = await createRes.json();
    let finalPath = folderPath;

    if (!createRes.ok) {
      if (
        createData.error &&
        createData.error[".tag"] === "path" &&
        createData.error.path &&
        createData.error.path[".tag"] === "conflict"
      ) {
        console.log(`[Dropbox] Folder already exists: ${folderPath}`);
      } else {
        throw new Error(`Dropbox folder creation failed: ${JSON.stringify(createData)}`);
      }
    } else {
      finalPath = createData.metadata.path_display || folderPath;
    }

    const linkRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: finalPath,
        settings: {
          requested_visibility: "public"
        }
      }),
    });

    const linkData = await linkRes.json();

    if (!linkRes.ok) {
      if (
        linkData.error &&
        linkData.error[".tag"] === "shared_link_already_exists"
      ) {
        const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: finalPath,
            direct_only: true
          }),
        });
        const listData = await listRes.json();
        if (listRes.ok && listData.links && listData.links.length > 0) {
          return {
            success: true,
            path: finalPath,
            url: listData.links[0].url
          };
        }
      }
      throw new Error(`Dropbox shared link creation failed: ${JSON.stringify(linkData)}`);
    }

    return {
      success: true,
      path: finalPath,
      url: linkData.url
    };
  } catch (err: any) {
    console.error("Dropbox helper error:", err);
    return {
      success: false,
      error: err.message || "Unknown error creating Dropbox folder or link.",
    };
  }
}

export async function renameDropboxFolder(
  oldClientName: string,
  oldProjectName: string,
  newClientName: string,
  newProjectName: string,
  creadoEn: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    const appKey = process.env.DROPBOX_APP_KEY;
    const appSecret = process.env.DROPBOX_APP_SECRET;

    if (!refreshToken || !appKey || !appSecret) {
      return {
        success: false,
        error: "Dropbox credentials not configured in environment variables.",
      };
    }

    const year = new Date(creadoEn).getFullYear();
    const cleanOldClient = oldClientName.replace(/[\/\\:*?"<>|]/g, "_").trim();
    const cleanOldProjRaw = oldProjectName
      .replace(/^azabache\s+producciones\s*-\s*/i, "")
      .replace(/^azabache\s+producciones\s*/i, "")
      .trim();
    const cleanOldProj = cleanOldProjRaw.replace(/[\/\\:*?"<>|]/g, "_").trim();
    const oldPath = `/ENTREGA/${year}/${cleanOldClient} - ${cleanOldProj}`;

    const cleanNewClient = newClientName.replace(/[\/\\:*?"<>|]/g, "_").trim();
    const cleanNewProjRaw = newProjectName
      .replace(/^azabache\s+producciones\s*-\s*/i, "")
      .replace(/^azabache\s+producciones\s*/i, "")
      .trim();
    const cleanNewProj = cleanNewProjRaw.replace(/[\/\\:*?"<>|]/g, "_").trim();
    const newPath = `/ENTREGA/${year}/${cleanNewClient} - ${cleanNewProj}`;

    if (oldPath.toLowerCase() === newPath.toLowerCase()) {
      return { success: true };
    }

    const accessToken = await getAccessToken({ refreshToken, appKey, appSecret });

    console.log(`[Dropbox] Renombrando carpeta de "${oldPath}" a "${newPath}"`);

    const res = await fetch("https://api.dropboxapi.com/2/files/move_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_path: oldPath,
        to_path: newPath,
        allow_shared_folder: true,
        autorename: false,
        allow_ownership_transfer: true,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // If the old folder lookup fails, it means the folder wasn't there (maybe errors in setup).
      // We log a warning and return success so we don't block the rest of the PUT endpoint.
      if (
        data.error &&
        data.error[".tag"] === "lookup_failed"
      ) {
        console.warn(`[Dropbox Rename] Carpeta origen no encontrada: ${oldPath}. Saltando renombrado.`);
        return { success: true };
      }
      throw new Error(`Dropbox move failed: ${JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Dropbox rename folder error:", err);
    return {
      success: false,
      error: err.message || "Unknown error renaming Dropbox folder.",
    };
  }
}
